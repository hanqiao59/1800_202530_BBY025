/* ==== Firebase ==== */
import { auth, db } from "/src/js/firebaseConfig.js";
import { onAuthStateChanged } from "firebase/auth";
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

/* ==== URL params ==== */
const params = new URLSearchParams(window.location.search);
const channelId = params.get("channelId");
const sessionId = params.get("sessionId");
const viewMode = params.get("mode");
const isHistoryView = viewMode === "history";

/* ==== DOM  ==== */
const sessionNameEl = document.getElementById("sessionChannelName");
const sessionTagsEl = document.getElementById("sessionTags");
const listEl = document.getElementById("messages");
const formEl = document.getElementById("composer");
const inputEl = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const activityTitleEl = document.getElementById("activityTitle");
const activityPromptEl = document.getElementById("activityPrompt");
const leaveSessionBtn = document.getElementById("leaveSessionBtn");

// validate required params
if (!channelId || !sessionId) {
  console.warn("[session] Missing channelId or sessionId in URL.");
}

/* ==== Session state ==== */
// "pending" | "active" | "end"
// will be overwritten from Firestore
let status = "pending";

/* ==== Auth state ==== */
let uid = auth.currentUser?.uid || null;
let displayName =
  auth.currentUser?.displayName || auth.currentUser?.email || "Anon";

onAuthStateChanged(auth, (u) => {
  uid = u?.uid || null;
  displayName = u?.displayName || u?.email || "Anon";

  if (uid && status === "active") {
    // load activity prompt if not loaded yet
    if (!activityLoaded) {
      loadActivityPromptForUser().catch(console.error);
    }
    // ensure last session is remembered
    if (!lastSessionSaved) {
      rememberLastSessionForUser().catch(console.error);
    }
    recordSessionParticipation().catch(console.error);
    // restart live query if not started yet
    if (!unsubMsgs) {
      startLiveQuery().catch(console.error);
    }
  }
});

/* ==== Firestore references ==== */
// session document reference
const sessionRef =
  channelId && sessionId
    ? doc(db, "channels", channelId, "sessions", sessionId)
    : null;
// messages collection reference
const msgsRef =
  channelId && sessionId
    ? collection(db, "channels", channelId, "sessions", sessionId, "messages")
    : null;

/* ==== Load channel metadata ==== */
async function loadChannelMeta() {
  // load channel name
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

// scroll to bottom
function scrollToBottom(el) {
  el.scrollTop = el.scrollHeight;
}

/* ==== Formatting ==== */
function fmtTime(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/* ==== Composer enable/disable ==== */
function setComposerEnabled(enabled) {
  // enable or disable the message composer
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
  col.className = `d-flex flex-column ${
    mine ? "align-items-end text-end" : "align-items-start"
  }`;

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

  // ensure we have uid
  if (!uid) {
    console.warn("[session] No uid yet, delaying live query");
    return;
  }

  const q = query(msgsRef, orderBy("createdAt", "asc"), limit(200));

  listEl.innerHTML = "";
  let wasAtBtm = true;

  // start listening to messages
  unsubMsgs = onSnapshot(
    q,
    (snap) => {
      wasAtBtm = atBottom(listEl);
      listEl.innerHTML = "";
      snap.forEach((docSnap) => listEl.appendChild(renderMsg(docSnap)));

      if (wasAtBtm) scrollToBottom(listEl);
    },
    (err) => {
      console.error(err);
    }
  );
}

// stop listening to messages
function stopLiveQuery() {
  if (unsubMsgs) {
    unsubMsgs();
    unsubMsgs = null;
  }
}

/*==== Load activity prompt for user ====*/
let activityLoaded = false;
async function loadActivityPromptForUser() {
  // load activity prompt for the current user
  if (activityLoaded) return;
  // validate
  if (!channelId || !sessionId || !uid || !sessionRef) return;

  activityLoaded = true;
  try {
    const sessionSnap = await getDoc(sessionRef);
    // session doc must exist
    if (!sessionSnap.exists()) {
      console.warn("[activity] Session doc does not exist:", sessionRef.path);
      return;
    }

    const sData = sessionSnap.data();
    // if the session already has an activityTitle and activityPrompt, use it
    if (sData.activityTitle || sData.activityPrompt) {
      // show title
      if (activityTitleEl) {
        activityTitleEl.textContent =
          sData.activityTitle || "Ice-breaker prompt";
      }
      // show prompt
      if (activityPromptEl) {
        activityPromptEl.textContent =
          sData.activityPrompt ||
          "Share something about yourself or your interests!";
      }

      // if the session already has tags, render the first tag in the header
      if (Array.isArray(sData.tags) && sData.tags.length) {
        renderSessionTag(sData.tags[0]);
      }

      return;
    }

    // if not, use the current user's interests to select a category
    const memberRef = doc(db, "channels", channelId, "members", uid);
    const memberSnap = await getDoc(memberRef);

    let interests = [];
    // load interests from member profile
    if (memberSnap.exists()) {
      const data = memberSnap.data();
      if (Array.isArray(data.interests)) {
        interests = data.interests;
      }
    }

    const { category, label } = pickCategoryFromInterests(interests);
    renderSessionTag(label);

    // if the session does not have tags yet, save the current label
    if (label) {
      saveSessionTagsIfEmpty([label]).catch(console.error);
    }

    // if no category could be picked, skip
    if (!category) {
      console.warn("[activity] No matching category found, skipping.");
      if (activityTitleEl) activityTitleEl.textContent = "Ice-breaker prompt";
      if (activityPromptEl)
        activityPromptEl.textContent =
          "Something went wrong. Feel free to chat about your interests!";
      return;
    }

    // query activities for the chosen category
    const activitiesRef = collection(db, "activities");
    const q = query(
      activitiesRef,
      where("category", "==", category),
      limit(10)
    );

    const snap = await getDocs(q);
    // if no activities found, skip
    if (snap.empty) {
      console.warn("[activity] No activities for category:", category);
      if (activityTitleEl) activityTitleEl.textContent = "Ice-breaker prompt";
      if (activityPromptEl)
        activityPromptEl.textContent =
          "No prompt found for this category. Feel free to chat about your interests!";
      return;
    }

    const docs = snap.docs;
    const chosen = docs[Math.floor(Math.random() * docs.length)];
    const data = chosen.data();
    const finalTitle = data.title || "Ice-breaker prompt";
    const finalPrompt = data.prompt || "Share something about your interests!";

    // save to session doc
    await updateDoc(sessionRef, {
      activityId: chosen.id || null,
      activityCategory: category,
      activityTitle: finalTitle,
      activityPrompt: finalPrompt,
    });

    // render to DOM
    if (activityTitleEl) {
      activityTitleEl.textContent = finalTitle;
    }
    // render prompt
    if (activityPromptEl) {
      activityPromptEl.textContent = finalPrompt;
    }
  } catch (err) {
    console.error("[activity] Failed to load prompt:", err);
    if (activityTitleEl) activityTitleEl.textContent = "Ice-breaker prompt";
    if (activityPromptEl)
      activityPromptEl.textContent =
        "Failed to load the prompt. Please try refreshing the page.";
  }
}

/* ==== Remember last session on user profile ==== */
let lastSessionSaved = false;
// Save last session info to users/{uid}.lastSession
async function rememberLastSessionForUser() {
  // avoid duplicate writes
  if (lastSessionSaved) return;
  // validate
  if (!uid || !channelId || !sessionId) return;

  try {
    const userRef = doc(db, "users", uid);
    // update lastSession field
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

/* ==== Record session participation ==== */
async function recordSessionParticipation() {
  // validate
  if (!uid || !channelId || !sessionId) return;

  try {
    const ref = doc(db, "users", uid, "joinedSessions", sessionId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      // already recorded this session for this user, do nothing
      return;
    }

    // create the joinedSessions/{sessionId} doc
    await setDoc(ref, {
      channelId,
      sessionId,
      joinedAt: serverTimestamp(),
    });

    console.log("[session] recorded participation in joinedSessions");
  } catch (err) {
    console.error("[session] Failed to record participation:", err);
  }
}

/* ==== Save session tags helper ==== */
// Save session tags only if the session does not have tags yet
async function saveSessionTagsIfEmpty(tags) {
  if (!sessionRef) return;
  if (!Array.isArray(tags) || !tags.length) return;

  try {
    const snap = await getDoc(sessionRef);
    // session doc must exist
    if (!snap.exists()) return;

    const data = snap.data();
    if (Array.isArray(data.tags) && data.tags.length) {
      // Session already has tags, do not overwrite
      return;
    }

    // save tags to session doc
    await updateDoc(sessionRef, {
      tags: tags,
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

    if (listEl) {
      // show pending message
      listEl.innerHTML =
        '<div class="text-center text-muted small py-4">The session has not started yet.</div>';
    }
  } else if (status === "active") {
    // Live chat
    setComposerEnabled(true);
    startLiveQuery().catch(console.error);

    // Load activity prompt once when the session becomes active
    loadActivityPromptForUser().catch(console.error);
    rememberLastSessionForUser().catch(console.error);
    recordSessionParticipation().catch(console.error);
  } else if (status === "end") {
    // Session ended
    stopLiveQuery();
    setComposerEnabled(false);

    // Load activity prompt in case it wasn't loaded yet
    loadActivityPromptForUser().catch(console.error);

    if (isHistoryView) {
      // history mode: read-only view of messages
      if (listEl && !unsubMsgs) {
        startLiveQuery().catch(console.error);
      }
      return;
    }

    // normal mode: redirect to activity-end page
    if (listEl) {
      listEl.innerHTML =
        '<div class="text-center text-muted small py-4">This ice-breaker session has ended. Thanks for joining!</div>';
    }

    const url = new URL("activity-end.html", window.location.href);
    url.searchParams.set("channelId", channelId);
    url.searchParams.set("sessionId", sessionId);
    window.location.href = url.href;
  }
}

/* ==== Session watcher ==== */
// Listen for changes to session status
function watchSession() {
  // validate
  if (!sessionRef) {
    return;
  }

  // listen to session document changes
  onSnapshot(
    sessionRef,
    (snap) => {
      if (!snap.exists()) {
        console.warn("Session document does not exist:", sessionRef.path);
        return;
      }
      const d = snap.data();
      status = d.status || "active";
      applySessionStatus();
    },
    (err) => {
      console.error("Session snapshot error:", err);
    }
  );
}

/* ==== Send new messages ==== */
async function sendMessage(text) {
  // validate
  if (!text || !uid || !msgsRef) return;
  // only allow sending when active
  if (status !== "active") return;
  // add new message document
  await addDoc(msgsRef, {
    text: text.trim(),
    uid,
    name: displayName,
    createdAt: serverTimestamp(),
  });
}

/* ==== Composer wiring ==== */
function wireComposer() {
  // validate
  if (!formEl || !inputEl || !sendBtn) return;
  // update send button state
  const updateBtn = () => {
    if (inputEl.disabled) {
      sendBtn.disabled = true;
    } else {
      sendBtn.disabled = !inputEl.value.trim();
    }
  };
  // listen for input changes to update send button state
  inputEl.addEventListener("input", updateBtn);
  updateBtn();
  // listen for form submission
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

/* ==== Boot chat ==== */
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

  // insert emoji into input field
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

  // position the emoji panel
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

  // reposition on scroll/resize
  ["resize", "scroll"].forEach((evt) => {
    window.addEventListener(evt, () => {
      if (picker.open) picker.dispatchEvent(new Event("toggle"));
    });
  });
})();

/* ==== Reaction buttons ==== */
(() => {
  // handle reaction button clicks
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".rxn");
    if (!btn) return;
    const countEl = btn.querySelector(".count");
    const n = parseInt(countEl?.textContent || "0", 10) || 0;

    // toggle active state
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
  // simple keyword matching
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

  // pick a random candidate
  if (!candidates.length) {
    return { category: null, label: null };
  }
  // random choice
  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  return choice;
}

/* ==== Render session tag ==== */
function renderSessionTag(label) {
  if (!sessionTagsEl) return;

  sessionTagsEl.innerHTML = "";

  const pill = document.createElement("span");
  pill.className = "tag-pill me-1";
  // set label
  if (label) {
    pill.textContent = label;
  } else {
    pill.textContent = "No interest selected";
    pill.classList.add("text-muted");
  }

  sessionTagsEl.appendChild(pill);
}

/* ==== Leave session button ==== */
leaveSessionBtn?.addEventListener("click", () => {
  window.location.href = "main.html";
});
