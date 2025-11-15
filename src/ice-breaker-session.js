// src/ice-breaker-session.js
// Ice-Breaker text chat with session status (pending / active / end)

import { auth, db } from "/src/firebaseConfig.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/* ===== URL params ===== */
const params = new URLSearchParams(window.location.search);
const channelId = params.get("channelId");
const sessionId = params.get("sessionId");

// Basic validation
if (!channelId || !sessionId) {
  console.error("Missing channelId or sessionId in URL");
  const listEl = document.getElementById("messages");
  const presence = document.getElementById("presence");
  if (presence) presence.textContent = "Session not found.";
  if (listEl) {
    listEl.innerHTML =
      '<div class="text-center text-muted small py-4">Session link is invalid.</div>';
  }
  // Stop further execution
  throw new Error("Missing channelId or sessionId in URL");
}

/* ===== DOM ===== */
const titleEl = document.getElementById("session-title");
const presence = document.getElementById("presence");
const listEl = document.getElementById("messages");
const formEl = document.getElementById("composer");
const inputEl = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

/* ===== Auth state ===== */
let uid = auth.currentUser?.uid || null;
let displayName =
  auth.currentUser?.displayName || auth.currentUser?.email || "Anon";

onAuthStateChanged(auth, (u) => {
  uid = u?.uid || null;
  displayName = u?.displayName || u?.email || "Anon";
  console.log("[auth] uid=", uid);

  // If we already loaded session data, re-apply owner-related logic later if needed
});

/* ===== Title  ===== */
if (titleEl) {
  titleEl.textContent = `Ice-Breaker: ${channelId} / ${sessionId}`;
}

/* ===== Firestore refs ===== */

// Session document: channels/{channelId}/sessions/{sessionId}
const sessionRef = doc(db, "channels", channelId, "sessions", sessionId);

// Messages subcollection: channels/{channelId}/sessions/{sessionId}/messages
const msgsRef = collection(
  db,
  "channels",
  channelId,
  "sessions",
  sessionId,
  "messages"
);

/* ===== Session status ===== */

// "pending" | "active" | "end"
let status = "active"; // default; will be overwritten from Firestore

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

function setComposerEnabled(enabled) {
  if (!formEl || !inputEl || !sendBtn) return;
  inputEl.disabled = !enabled;
  sendBtn.disabled = !enabled || !inputEl.value.trim();
}

/* ===== Message bubble ===== */
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

/* ===== Live query for messages (only when active) ===== */
let unsub = null;

async function startLiveQuery() {
  if (unsub) return; // already running

  const q = query(msgsRef, orderBy("createdAt", "asc"), limit(200));

  listEl.innerHTML = "";
  let wasAtBtm = true;

  unsub = onSnapshot(
    q,
    (snap) => {
      wasAtBtm = atBottom(listEl);
      listEl.innerHTML = "";
      snap.forEach((docSnap) => listEl.appendChild(renderMsg(docSnap)));

      if (presence) {
        presence.textContent = `${snap.size} message${
          snap.size === 1 ? "" : "s"
        }`;
      }
      if (wasAtBtm) scrollToBottom(listEl);
    },
    (err) => {
      console.error(err);
      if (presence) presence.textContent = "Live updates unavailable";
    }
  );
}

function stopLiveQuery() {
  if (unsub) {
    unsub();
    unsub = null;
  }
}

/* ===== Status → UI ===== */

function applySessionStatus() {
  console.log("[session] status =", status);

  if (status === "pending") {
    // Waiting for host to start
    stopLiveQuery();
    setComposerEnabled(false);

    if (presence) {
      presence.textContent = "Waiting for owner to start…";
    }
    if (listEl) {
      listEl.innerHTML =
        '<div class="text-center text-muted small py-4">Waiting for owner to start this session…</div>';
    }
  } else if (status === "active") {
    // Normal chat
    setComposerEnabled(true);
    if (presence && !unsub) {
      presence.textContent = "Session is active";
    }
    startLiveQuery().catch(console.error);
  } else if (status === "end") {
    // Session ended
    stopLiveQuery();
    setComposerEnabled(false);

    if (presence) {
      presence.textContent = "This session has ended.";
    }

    // Redirect everyone in this session to the end screen
    const url = new URL("activity-end.html", window.location.href);
    url.searchParams.set("channelId", channelId);
    url.searchParams.set("sessionId", sessionId);

    window.location.href = url.href;
  }
}

/* ===== Watch session doc for status changes ===== */
async function watchSession() {
  try {
    const firstSnap = await getDoc(sessionRef);
    if (!firstSnap.exists()) {
      console.warn("Session document does not exist:", sessionRef.path);
      if (presence) {
        presence.textContent = "Session not found.";
      }
      return;
    }

    const data = firstSnap.data();
    status = data.status || "active";
    applySessionStatus();

    // Live updates for status
    onSnapshot(
      sessionRef,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        status = d.status || "active";
        applySessionStatus();
      },
      (err) => {
        console.error("Session snapshot error:", err);
      }
    );
  } catch (err) {
    console.error("Failed to watch session:", err);
    if (presence) {
      presence.textContent = "Failed to load session.";
    }
  }
}

/* ===== Send ===== */
async function sendMessage(text) {
  if (!text || !uid) return;
  if (status !== "active") return; // only allow sending when session is active

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
    if (inputEl.disabled) {
      sendBtn.disabled = true;
    } else {
      sendBtn.disabled = !inputEl.value.trim();
    }
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
  if (!channelId || !sessionId) return; // safety check

  try {
    wireComposer();
    watchSession().catch(console.error);
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
    if (!inputEl.disabled && sendBtn) sendBtn.disabled = !inputEl.value.trim();
    picker.open = false;
    inputEl.focus();
  });

  picker.addEventListener("toggle", () => {
    if (!picker.open || !summary || !panel) return;

    panel.style.visibility = "hidden";
    panel.style.display = "block";

    const m = 8;
    const r = summary.getBoundingClientRect();
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;

    let left = r.left;
    let top = r.bottom + m;

    if (top + ph > window.innerHeight - m) {
      top = r.top - ph - m;
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
