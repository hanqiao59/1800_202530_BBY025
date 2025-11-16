// src/ice-breaker-session.js
// Ice-breaker text chat with session status (pending / active / end)
// and interest-based activity prompts.

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
  where,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/* ============================================================
   1) IDs from URL
   ============================================================ */

// Expect ?channelId=...&sessionId=... in the URL
const params = new URLSearchParams(window.location.search);
const channelId = params.get("channelId");
const sessionId = params.get("sessionId");
const sessionNameEl = document.getElementById("sessionChannelName");
const sessionTagsEl = document.getElementById("sessionTags");

if (!channelId || !sessionId) {
  console.warn("[session] Missing channelId or sessionId in URL.");
}

/* ============================================================
   2) DOM references
   ============================================================ */

const titleEl = document.getElementById("session-title");
const presence = document.getElementById("presence");
const listEl = document.getElementById("messages");
const formEl = document.getElementById("composer");
const inputEl = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

// Activity prompt area
const activityTitleEl = document.getElementById("activityTitle");
const activityPromptEl = document.getElementById("activityPrompt");

/* ============================================================
   3) Auth state
   ============================================================ */
let uid = auth.currentUser?.uid || null;
let displayName =
  auth.currentUser?.displayName || auth.currentUser?.email || "Anon";

onAuthStateChanged(auth, (u) => {
  uid = u?.uid || null;
  displayName = u?.displayName || u?.email || "Anon";
  console.log("[auth] uid =", uid);
});

/* ============================================================
   4) Firestore references
   ============================================================ */
if (titleEl && channelId && sessionId) {
  titleEl.textContent = `Ice-Breaker: ${channelId} / ${sessionId}`;
}

const sessionRef =
  channelId && sessionId
    ? doc(db, "channels", channelId, "sessions", sessionId)
    : null;

const msgsRef =
  channelId && sessionId
    ? collection(db, "channels", channelId, "sessions", sessionId, "messages")
    : null;

// Load channel name once for the session info header
async function loadChannelMeta() {
  if (!channelId || !sessionNameEl) return;

  try {
    const snap = await getDoc(doc(db, "channels", channelId));
    if (snap.exists()) {
      const data = snap.data();
      sessionNameEl.textContent = data.name || "Untitled channel";
    }
  } catch (err) {
    console.error("[session] Failed to load channel name:", err);
  }
}

/* ============================================================
   5) Session status + helpers
   ============================================================ */
// "pending" | "active" | "end"
let status = "pending"; // will be overwritten from Firestore

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

/* ============================================================
   6) Message rendering + live query
   ============================================================ */
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

let unsubMsgs = null;

async function startLiveQuery() {
  if (!msgsRef || unsubMsgs) return; // already running or no ref

  const q = query(msgsRef, orderBy("createdAt", "asc"), limit(200));

  listEl.innerHTML = "";
  let wasAtBtm = true;

  unsubMsgs = onSnapshot(
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
  if (unsubMsgs) {
    unsubMsgs();
    unsubMsgs = null;
  }
}

/* ============================================================
   7) Interest-based activity prompt
   ============================================================ */
let activityLoaded = false;

async function loadActivityPromptForUser() {
  if (activityLoaded) return;
  if (!channelId || !sessionId || !uid) return;

  activityLoaded = true;

  try {
    // 1) Read this member's interests under the current channel
    const memberRef = doc(db, "channels", channelId, "members", uid);
    const memberSnap = await getDoc(memberRef);

    let interests = [];
    if (memberSnap.exists()) {
      const data = memberSnap.data();
      if (Array.isArray(data.interests)) {
        interests = data.interests;
      }
    }

    const { category, label } = pickCategoryFromInterests(interests);
    renderSessionTag(label);

    if (!category) {
      console.warn("[activity] No matching category found, skipping.");
      if (activityTitleEl) activityTitleEl.textContent = "Ice-breaker prompt";
      if (activityPromptEl)
        activityPromptEl.textContent = "Something went wrong!!";
      return;
    }

    // 2) Query /activities for this category
    const activitiesRef = collection(db, "activities");
    const q = query(
      activitiesRef,
      where("category", "==", category),
      limit(10)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      console.warn("[activity] No activities for category:", category);
      if (activityTitleEl) activityTitleEl.textContent = "Ice-breaker prompt";
      if (activityPromptEl)
        activityPromptEl.textContent =
          "No prompt found for this category. Feel free to chat about your interests!";
      return;
    }

    // 3) Pick one random document from the result
    const docs = snap.docs;
    const chosen = docs[Math.floor(Math.random() * docs.length)];
    const data = chosen.data();

    if (activityTitleEl) {
      activityTitleEl.textContent = data.title || "Ice-breaker prompt";
    }
    if (activityPromptEl) {
      activityPromptEl.textContent =
        data.prompt || "Share something about your interests!";
    }

    console.log(
      "[activity] Loaded prompt:",
      data.title,
      " / ",
      data.prompt,
      "(category:",
      category,
      ")"
    );
  } catch (err) {
    console.error("[activity] Failed to load prompt:", err);
    if (activityTitleEl) activityTitleEl.textContent = "Ice-breaker prompt";
    if (activityPromptEl)
      activityPromptEl.textContent =
        "Failed to load the prompt. Please try refreshing the page.";
  }
}

/* ============================================================
   8) Session status → UI
   ============================================================ */
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
        '<div class="text-center text-muted small py-4">Something went wrong.</div>';
    }
  } else if (status === "active") {
    // Normal live chat
    setComposerEnabled(true);
    if (presence) {
      presence.textContent = "Session is live";
      presence.classList.add(
        "badge",
        "bg-success-subtle",
        "text-success",
        "px-3",
        "py-2",
        "rounded-pill"
      );
    }
    startLiveQuery().catch(console.error);

    // Load activity prompt once when the session becomes active
    loadActivityPromptForUser().catch(console.error);
  } else if (status === "end") {
    // Session has ended
    stopLiveQuery();
    setComposerEnabled(false);

    if (presence) {
      presence.textContent = "This session has ended.";
      presence.classList.remove(
        "badge",
        "bg-success-subtle",
        "text-success",
        "px-3",
        "py-2",
        "rounded-pill"
      );
    }
    if (listEl) {
      listEl.innerHTML =
        '<div class="text-center text-muted small py-4">This ice-breaker session has ended. Thanks for joining!</div>';
    }
  }
}

/* ============================================================
   9) Watch session doc for status changes
   ============================================================ */
async function watchSession() {
  if (!sessionRef) {
    if (presence) presence.textContent = "Session not found.";
    return;
  }

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

    // Subscribe to further status changes
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

/* ============================================================
   10) Sending messages
   ============================================================ */

async function sendMessage(text) {
  if (!text || !uid || !msgsRef) return;
  if (status !== "active") return; // only allow sending when active

  await addDoc(msgsRef, {
    text: text.trim(),
    uid,
    name: displayName,
    createdAt: serverTimestamp(),
  });
}

/* ============================================================
   11) Composer wiring
   ============================================================ */

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

/* ============================================================
   12) Boot
   ============================================================ */

(function bootChat() {
  try {
    wireComposer();
    loadChannelMeta().catch(console.error);
    watchSession().catch(console.error);
  } catch (err) {
    console.error(err);
    if (listEl) {
      listEl.innerHTML =
        '<div class="alert alert-danger">Failed to start the chat. Please refresh.</div>';
    }
  }
})();

/* ============================================================
   13) Emoji picker
   ============================================================ */

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

/* ============================================================
   14) Quick reactions 
   ============================================================ */

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

// Decide which category to use based on user's interests.
// If multiple tags match (e.g. "Gaming" and "Traveling"),
// randomly pick ONE of them.
// Returns { category: "gaming" | "tech" | "traveling" | null, label: string | null }
function pickCategoryFromInterests(interests = []) {
  const candidates = [];

  interests.forEach((raw) => {
    const s = String(raw).toLowerCase();

    if (s.includes("gaming")) {
      candidates.push({ category: "gaming", label: raw });
    }
    if (s.includes("tech") || s.includes("code")) {
      candidates.push({ category: "tech", label: raw });
    }
    if (s.includes("travel")) {
      candidates.push({ category: "traveling", label: raw });
    }
  });

  if (!candidates.length) {
    return { category: null, label: null };
  }

  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  return choice;
}

// Render ONLY the chosen interest tag in the session info card
function renderSessionTag(label) {
  if (!sessionTagsEl) return;

  sessionTagsEl.innerHTML = "";

  const pill = document.createElement("span");
  pill.className = "tag-pill me-1";

  if (label) {
    pill.textContent = label;
  } else {
    pill.textContent = "No interest selected";
    pill.classList.add("text-muted");
  }

  sessionTagsEl.appendChild(pill);
}

// Leave session: go back to dashboard (or channel preview)
const leaveSessionBtn = document.getElementById("leaveSessionBtn");
leaveSessionBtn?.addEventListener("click", () => {
  // Change this to the page you want:
  // e.g. "main.html" (dashboard) or `channel-preview.html?id=${channelId}`
  window.location.href = "main.html";
});
