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
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/* ==== DOM references ==== */
const params = new URLSearchParams(window.location.search);
const channelId = params.get("channelId");
const sessionId = params.get("sessionId");
const sessionNameEl = document.getElementById("sessionChannelName");
const sessionTagsEl = document.getElementById("sessionTags");
const presence = document.getElementById("presence");
const listEl = document.getElementById("messages");
const formEl = document.getElementById("composer");
const inputEl = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const activityTitleEl = document.getElementById("activityTitle");
const activityPromptEl = document.getElementById("activityPrompt");

// Validate required params
if (!channelId || !sessionId) {
  console.warn("[session] Missing channelId or sessionId in URL.");
}

/* ==== Auth state ==== */
let uid = auth.currentUser?.uid || null;
let displayName =
  auth.currentUser?.displayName || auth.currentUser?.email || "Anon";

// session status + flags
let status = "pending"; // "pending" | "active" | "end"
let activityLoaded = false;
let lastSessionSaved = false;

onAuthStateChanged(auth, (u) => {
  uid = u?.uid || null;
  displayName = u?.displayName || u?.email || "Anon";

  // If auth becomes ready after the session is already active,
  // make sure we still load the activity prompt and remember last session.
  if (uid && status === "active") {
    if (!activityLoaded) {
      loadActivityPromptForUser().catch(console.error);
    }
    if (!lastSessionSaved) {
      rememberLastSessionForUser().catch(console.error);
    }
  }

  // If auth becomes ready while session is already ended,
  // we still want to show the activity prompt and interest tag in read-only mode.
  if (uid && status === "end" && !activityLoaded) {
    loadActivityPromptForUser().catch(console.error);
  }
});

/* ==== Firestore references ==== */
const sessionRef =
  channelId && sessionId
    ? doc(db, "channels", channelId, "sessions", sessionId)
    : null;

const msgsRef =
  channelId && sessionId
    ? collection(db, "channels", channelId, "sessions", sessionId, "messages")
    : null;

/* ==== Load channel metadata ==== */
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

/* ==== Scroll helpers ==== */
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

/* ==== Messages live query ==== */
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
  if (!msgsRef || unsubMsgs) return;

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

/* ==== Activity prompt loading ==== */
async function loadActivityPromptForUser() {
  if (activityLoaded) return;
  if (!channelId || !sessionId) return;

  try {
    let category = null;
    let label = null;

    // read tags from session document
    if (sessionRef) {
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        const sData = sessionSnap.data();
        if (Array.isArray(sData.tags) && sData.tags.length) {
          // Use the first tag as the "label" and map it to a category
          const fromSession = pickCategoryFromInterests([sData.tags[0]]);
          category = fromSession.category;
          label = fromSession.label; // will be sData.tags[0]
        }
      }
    }

    // if no category from session tags, try to infer from user's interests
    if (!category) {
      // If auth is not ready yet, skip for now; we'll try again once uid is set
      if (!uid) {
        console.log(
          "[activity] uid not ready and no session tags; will try again later"
        );
        return;
      }

      // Read this member's interests under the current channel
      const memberRef = doc(db, "channels", channelId, "members", uid);
      const memberSnap = await getDoc(memberRef);

      let interests = [];
      if (memberSnap.exists()) {
        const data = memberSnap.data();
        if (Array.isArray(data.interests)) {
          interests = data.interests;
        }
      }

      const picked = pickCategoryFromInterests(interests);
      category = picked.category;
      label = picked.label;

      // If still no category, show a fallback and stop
      if (!category) {
        if (activityTitleEl) activityTitleEl.textContent = "Ice-breaker prompt";
        if (activityPromptEl)
          activityPromptEl.textContent =
            "Something went wrong while loading your prompt.";
        activityLoaded = true;
        return;
      }

      // Save label as session.tags (only if the session does not have tags yet)
      if (label) {
        renderSessionTag(label);
        saveSessionTagsIfEmpty([label]).catch(console.error);
      } else {
        renderSessionTag(null);
      }
    } else {
      // We already have category + label from session tags
      renderSessionTag(label);
    }

    // Now load activities for the chosen category
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
      activityLoaded = true;
      return;
    }

    // Make ordering stable by sorting docs by id
    const docs = snap.docs.slice().sort((a, b) => a.id.localeCompare(b.id));

    // Deterministic "random" index based on sessionId + category
    const key = `${sessionId || "default"}:${category}`;
    const idx = deterministicIndex(key, docs.length);
    const chosen = docs[idx];
    const data = chosen.data();

    if (activityTitleEl) {
      activityTitleEl.textContent = data.title || "Ice-breaker prompt";
    }
    if (activityPromptEl) {
      activityPromptEl.textContent =
        data.prompt || "Share something about your interests!";
    }

    activityLoaded = true;
  } catch (err) {
    console.error("[activity] Failed to load prompt:", err);
    if (activityTitleEl) activityTitleEl.textContent = "Ice-breaker prompt";
    if (activityPromptEl)
      activityPromptEl.textContent =
        "Failed to load the prompt. Please try refreshing the page.";
    activityLoaded = true;
  }
}

/* ==== Remember last session on user profile ==== */
async function rememberLastSessionForUser() {
  if (lastSessionSaved) return;
  if (!uid || !channelId || !sessionId) return;

  try {
    const userRef = doc(db, "users", uid);
    await setDoc(
      userRef,
      {
        lastSession: {
          channelId,
          sessionId,
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true }
    );

    lastSessionSaved = true;
    console.log("[session] lastSession saved on user profile");
  } catch (err) {
    console.error("[session] Failed to save lastSession:", err);
  }
}

/* ==== Save session tags helper ==== */
async function saveSessionTagsIfEmpty(tags) {
  if (!sessionRef) return;
  if (!Array.isArray(tags) || !tags.length) return;

  try {
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) return;

    const data = snap.data();
    if (Array.isArray(data.tags) && data.tags.length) {
      // Session already has tags, do not overwrite
      return;
    }

    await updateDoc(sessionRef, {
      tags: tags, // e.g. ["Gaming"] / ["Tech & Coding"]
    });

    console.log("[session] tags saved on session:", tags);
  } catch (err) {
    console.error("[session] Failed to save session tags:", err);
  }
}

/* ==== Session status handling ==== */
function applySessionStatus() {
  console.log("[session] status =", status);

  if (status === "pending") {
    // Session not started yet
    stopLiveQuery();
    setComposerEnabled(false);

    if (presence) {
      presence.textContent = "Waiting for host to start…";
    }
    if (listEl) {
      listEl.innerHTML =
        '<div class="text-center text-muted small py-4">The session has not started yet.</div>';
    }
  } else if (status === "active") {
    // Live chat
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
    rememberLastSessionForUser().catch(console.error);
  } else if (status === "end") {
    // Session ended
    stopLiveQuery();
    setComposerEnabled(false);

    // Even for ended sessions, we still want to show the activity prompt
    // and the interest tag in read-only mode.
    if (!activityLoaded) {
      loadActivityPromptForUser().catch(console.error);
    }

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

/* ==== Session watcher ==== */
function watchSession() {
  if (!sessionRef) {
    if (presence) presence.textContent = "Session not found.";
    return;
  }

  onSnapshot(
    sessionRef,
    (snap) => {
      if (!snap.exists()) {
        console.warn("Session document does not exist:", sessionRef.path);
        if (presence) presence.textContent = "Session not found.";
        return;
      }
      const d = snap.data();
      status = d.status || "active";
      applySessionStatus();
    },
    (err) => {
      console.error("Session snapshot error:", err);
      if (presence) presence.textContent = "Failed to load session.";
    }
  );
}

/* ==== Send new messages ==== */
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

/* ==== Composer wiring ==== */
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

/* ==== Bootstrapping ==== */
(function bootChat() {
  try {
    wireComposer();
    loadChannelMeta().catch(console.error);
    watchSession();
  } catch (err) {
    console.error(err);
    if (listEl) {
      listEl.innerHTML =
        '<div class="alert alert-danger">Failed to start the chat. Please refresh.</div>';
    }
  }
})();

/* ==== Emoji picker ==== */
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

/* ==== Reaction buttons (local-only) ==== */
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

/* ==== Interest category helpers ==== */
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
    if (s.includes("traveling")) {
      candidates.push({ category: "traveling", label: raw });
    }
  });

  if (!candidates.length) {
    return { category: null, label: null };
  }

  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  return choice;
}

/* ==== Session tag rendering ==== */
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

/* ==== Deterministic index helper ==== */
function deterministicIndex(key, n) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return n > 0 ? hash % n : 0;
}

/* ==== Leave session button ==== */
const leaveSessionBtn = document.getElementById("leaveSessionBtn");
leaveSessionBtn?.addEventListener("click", () => {
  window.location.href = "main.html";
});
