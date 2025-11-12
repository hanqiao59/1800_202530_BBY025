// Ice-Breaker text chat
import { auth, db } from "/src/firebaseConfig.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

/* ===== Fixed IDs===== */
const channelId = "6SW6tqQxJuPop1Z7xbIP";
const sessionId = "pR87qS0FqDBO60MGKZo1";

/* ===== DOM ===== */
const titleEl = document.getElementById("session-title");
const presence = document.getElementById("presence");
const listEl = document.getElementById("messages");
const formEl = document.getElementById("composer");
const inputEl = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

import { onAuthStateChanged } from "firebase/auth";
onAuthStateChanged(auth, (u) => {
  uid = u?.uid || null;
  displayName = u?.displayName || u?.email || "Anon";
  console.log("[auth] uid=", uid);
});

/* ===== Auth snapshot (assumed non-null) ===== */
let uid = auth.currentUser?.uid || null;
let displayName =
  auth.currentUser?.displayName || auth.currentUser?.email || "Anon";

/* ===== Title (null-safe) ===== */
if (titleEl) titleEl.textContent = `Ice-Breaker: ${channelId} / ${sessionId}`;

/* ===== Utils ===== */
function atBottom(el, th = 48) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < th;
}
function scrollToBottom(el) {
  el.scrollTop = el.scrollHeight;
}
function fmtTime(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const msgsRef = collection(
  db,
  "channels",
  channelId,
  "sessions",
  sessionId,
  "messages"
);

/* ===== Render one message bubble ===== */
function renderMsg(docSnap) {
  const data = docSnap.data();
  const mine = data.uid === uid;

  const row = document.createElement("div");
  row.className = `d-flex mb-2 ${
    mine ? "justify-content-end" : "justify-content-start"
  }`;

  const col = document.createElement("div");
  col.className = "d-flex flex-column align-items-start";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${mine ? "bubble-me" : "bubble-them"} shadow-sm`;
  bubble.textContent = data.text || "";

  const meta = document.createElement("div");
  meta.className = "meta mt-1";
  meta.textContent = `${mine ? "You" : data.name || "Anon"} • ${fmtTime(
    data.createdAt
  )}`;

  col.appendChild(bubble);
  col.appendChild(meta);
  row.appendChild(col);
  return row;
}

/* ===== Live query ===== */
let unsub = null;
async function startLiveQuery() {
  const q = query(msgsRef, orderBy("createdAt", "asc"), limit(200));

  listEl.innerHTML = "";
  let wasAtBtm = true;

  unsub = onSnapshot(
    q,
    (snap) => {
      wasAtBtm = atBottom(listEl);
      listEl.innerHTML = "";
      snap.forEach((docSnap) => listEl.appendChild(renderMsg(docSnap)));
      if (presence)
        presence.textContent = `${snap.size} message${
          snap.size === 1 ? "" : "s"
        }`;
      if (wasAtBtm) scrollToBottom(listEl);
    },
    (err) => {
      console.error(err);
      if (presence) presence.textContent = "Live updates unavailable";
    }
  );
}

/* ===== Send ===== */
async function sendMessage(text) {
  if (!text || !uid) return;
  await addDoc(msgsRef, {
    text: text.trim(),
    uid,
    name: displayName,
    createdAt: serverTimestamp(),
  });
}

/* ===== Composer  ===== */
function wireComposer() {
  if (!formEl || !inputEl || !sendBtn) return;

  const updateBtn = () => {
    sendBtn.disabled = !inputEl.value.trim();
  };
  inputEl.addEventListener("input", updateBtn);
  updateBtn();

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = "";
    sendBtn.disabled = true;

    try {
      await sendMessage(text);
      scrollToBottom(listEl);
      inputEl.focus();
      updateBtn();
    } catch (err) {
      console.error(err);
      inputEl.value = text;
      inputEl.focus();
      updateBtn();
    }
  });
}

/* ===== Boot ===== */
(function bootChat() {
  try {
    wireComposer();
    startLiveQuery().catch(console.error);
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<div class="alert alert-danger">Failed to start the chat. Please refresh.</div>`;
  }
})();

/* ===== Emoji picker  ===== */
(() => {
  const picker = document.getElementById("emojiPicker");
  if (!picker) return;
  const summary = picker.querySelector("summary");
  const panel = picker.querySelector(".panel");
  const inputEl = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");

  picker.addEventListener("click", (e) => {
    const btn = e.target.closest(".e");
    if (!btn || !inputEl) return;
    e.preventDefault();
    const emo = btn.textContent || "";
    const s = inputEl.selectionStart ?? inputEl.value.length;
    const t = inputEl.selectionEnd ?? inputEl.value.length;
    inputEl.value = inputEl.value.slice(0, s) + emo + inputEl.value.slice(t);
    const pos = s + emo.length;
    requestAnimationFrame(() => inputEl.setSelectionRange(pos, pos));
    if (sendBtn) sendBtn.disabled = !inputEl.value.trim();
    picker.open = false;
    inputEl.focus();
  });

  picker.addEventListener("toggle", () => {
    if (!picker.open || !summary || !panel) return;

    panel.style.visibility = "hidden";
    panel.style.display = "block";

    const m = 8; // 边距
    const r = summary.getBoundingClientRect();
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;

    let left = r.left;
    let top = r.bottom + m;

    if (top + ph > window.innerHeight - m) {
      top = r.top - ph - m; // 翻到上方
    }
    if (left + pw > window.innerWidth - m) left = window.innerWidth - pw - m;
    if (left < m) left = m;

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.visibility = "visible";
  });

  ["resize", "scroll"].forEach((evt) => {
    window.addEventListener(evt, () => {
      if (picker.open) picker.dispatchEvent(new Event("toggle"));
    });
  });
})();

/* ===== Quick reactions ===== */
(() => {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".rxn");
    if (!btn) return;
    const countEl = btn.querySelector(".count");
    const n = parseInt(countEl?.textContent || "0", 10) || 0;

    if (btn.classList.contains("active")) {
      btn.classList.remove("active");
      if (countEl) countEl.textContent = String(Math.max(0, n - 1));
    } else {
      btn.classList.add("active");
      if (countEl) countEl.textContent = String(n + 1);
    }
  });
})();
