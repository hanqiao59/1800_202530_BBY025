// src/channel-preview.js
// Channel preview page: shows channel info and different UI for owner vs member.
// Owner can start / end one live ice-breaker session per channel.

import { auth, db } from "/src/firebaseConfig.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// 1) Read channelId from the URL (?id=...)
const params = new URLSearchParams(window.location.search);
const channelId = params.get("id");

// 2) DOM elements
const titleEl = document.getElementById("channelTitle");
const memberJoinCard = document.getElementById("memberJoinCard");
const ownerHostCard = document.getElementById("ownerHostCard");
const continueBtn = document.getElementById("continueBtn");

const startIceBreakerBtn = document.getElementById("startIceBreakerBtn");
const endIceBreakerBtn = document.getElementById("endIceBreakerBtn");
const joinQrImg = document.getElementById("joinQr");
const sessionLiveBadge = document.getElementById("sessionLiveBadge");

let channelData = null;
let currentUser = null;

// Track the latest non-ended session for this channel
let activeSessionId = null;
let unsubSessionWatch = null;

/* ===== UI helpers ===== */

function showMemberView() {
  memberJoinCard?.classList.remove("d-none");
  ownerHostCard?.classList.add("d-none");
}

function showOwnerView() {
  memberJoinCard?.classList.add("d-none");
  ownerHostCard?.classList.remove("d-none");
}

function showSessionLiveBadge() {
  sessionLiveBadge?.classList.remove("d-none");
}

function hideSessionLiveBadge() {
  sessionLiveBadge?.classList.add("d-none");
}

// Owner UI when there is NO live session (or the last one ended)
function setOwnerIdleUI() {
  startIceBreakerBtn?.classList.remove("d-none");
  endIceBreakerBtn?.classList.add("d-none");
  hideSessionLiveBadge();
  activeSessionId = null;
}

// Owner UI when there is an ACTIVE session
function setOwnerActiveUI() {
  startIceBreakerBtn?.classList.add("d-none");
  endIceBreakerBtn?.classList.remove("d-none");
  showSessionLiveBadge();
}

/* ===== Watch last session for owner (to avoid creating duplicates) ===== */

function watchOwnerSession() {
  if (!channelId || !currentUser) return;

  const sessionsRef = collection(db, "channels", channelId, "sessions");
  // Just order by createdAt, newest first. No composite index required.
  const q = query(sessionsRef, orderBy("createdAt", "desc"), limit(1));

  if (unsubSessionWatch) unsubSessionWatch();

  unsubSessionWatch = onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        console.log("[channel-preview] No sessions yet for this channel.");
        setOwnerIdleUI();
        return;
      }

      const last = snap.docs[0];
      const data = last.data();
      const status = data.status || "active";

      console.log("[channel-preview] Latest session:", last.id, status);

      if (status === "active") {
        activeSessionId = last.id;
        setOwnerActiveUI();
      } else if (status === "end") {
        // Last session is ended → owner can start a new one
        setOwnerIdleUI();
      } else {
        // Any other status (e.g., "pending") treat as live for UI purposes
        activeSessionId = last.id;
        setOwnerActiveUI();
      }
    },
    (err) => {
      console.error("[channel-preview] Failed to watch active session:", err);
    }
  );
}

/* ===== Main auth + channel load ===== */

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!channelId) {
    if (titleEl) titleEl.textContent = "No channel ID provided";
    return;
  }

  try {
    // Load the channel document
    const snap = await getDoc(doc(db, "channels", channelId));
    if (!snap.exists()) {
      if (titleEl) titleEl.textContent = "Channel not found";
      return;
    }

    channelData = snap.data();

    // Show channel name
    if (titleEl) {
      titleEl.textContent = channelData.name || "Untitled Channel";
    }

    // Build invite link (what is inside the QR code)
    const inviteUrl = new URL("channel-preview.html", window.location.href);
    inviteUrl.searchParams.set("id", channelId);

    // Configure "Continue" button for regular members
    if (continueBtn) {
      const tagsUrl = new URL("select-tags.html", window.location.href);
      tagsUrl.searchParams.set("channelId", channelId);
      continueBtn.setAttribute("href", tagsUrl.href);
    }

    // Determine if current user is the channel owner
    const isOwner =
      user && channelData.createdBy && channelData.createdBy === user.uid;

    if (isOwner) {
      // ===== OWNER VIEW =====
      showOwnerView();

      // Generate QR code from invite link (simple external service)
      if (joinQrImg) {
        const qrApi = "https://api.qrserver.com/v1/create-qr-code/";
        const qrSrc =
          qrApi + "?size=200x200&data=" + encodeURIComponent(inviteUrl.href);
        joinQrImg.src = qrSrc;
      }

      // Watch for latest session to determine UI state (idle / active)
      watchOwnerSession();

      // Wire "Start" button → create a new session (only if none is active)
      startIceBreakerBtn?.addEventListener("click", async () => {
        if (!currentUser || !channelId) return;

        // Extra guard: do not create if we already know an active session
        if (activeSessionId) {
          alert("A session is already live for this channel.");
          return;
        }

        startIceBreakerBtn.disabled = true;

        try {
          const sessionsRef = collection(db, "channels", channelId, "sessions");
          await addDoc(sessionsRef, {
            ownerId: currentUser.uid,
            status: "active", // start directly as active
            createdAt: serverTimestamp(),
            endedAt: null,
          });

          // No need to manually update UI: watchOwnerSession() will pick it up.
        } catch (err) {
          console.error("Failed to create session:", err);
          alert("Failed to start the ice breaker. Please try again.");
        } finally {
          startIceBreakerBtn.disabled = false;
        }
      });

      // Wire "End" button → mark the current session as ended
      endIceBreakerBtn?.addEventListener("click", async () => {
        if (!currentUser || !channelId || !activeSessionId) return;

        endIceBreakerBtn.disabled = true;

        try {
          const ref = doc(
            db,
            "channels",
            channelId,
            "sessions",
            activeSessionId
          );
          await setDoc(
            ref,
            {
              status: "end",
              endedAt: serverTimestamp(),
            },
            { merge: true }
          );
          // watchOwnerSession() will update the UI back to idle state
        } catch (err) {
          console.error("Failed to end session:", err);
          alert("Failed to end the session. Please try again.");
        } finally {
          endIceBreakerBtn.disabled = false;
        }
      });
    } else {
      // ===== MEMBER VIEW =====
      showMemberView();
    }
  } catch (err) {
    console.error("Failed to load channel:", err);
    if (titleEl) titleEl.textContent = "Failed to load channel";
  }
});
