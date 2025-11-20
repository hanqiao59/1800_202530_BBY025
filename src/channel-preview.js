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

// Read channelId from the URL (?id=...)
const params = new URLSearchParams(window.location.search);
const channelId = params.get("id");

//Store the Channel's ID inside StorageSession for the page.
sessionStorage.setItem("channelId", channelId);

// 2) DOM elements
const titleEl = document.getElementById("channelTitle");
const memberJoinCard = document.getElementById("memberJoinCard");
const ownerHostCard = document.getElementById("ownerHostCard");
const continueBtn = document.getElementById("continueBtn");

const startIceBreakerBtn = document.getElementById("startIceBreakerBtn");
const endIceBreakerBtn = document.getElementById("endIceBreakerBtn");
const joinQrImg = document.getElementById("joinQr");
const sessionLiveBadge = document.getElementById("sessionLiveBadge");

// Owner message and QR container
const ownerHostMessageEl = ownerHostCard?.querySelector("p.text-secondary");
const ownerQrWrapperEl = ownerHostCard?.querySelector(
  ".d-flex.justify-content-center.mb-3"
);

let channelData = null;
let currentUser = null;
let sessionEnded = false;

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

// Owner UI when there is NO live session (or the last one ended and we are idle)
function setOwnerIdleUI() {
  // Can start a new session
  startIceBreakerBtn?.classList.remove("d-none");
  endIceBreakerBtn?.classList.add("d-none");
  hideSessionLiveBadge();

  // Idle status message
  if (ownerHostMessageEl) {
    ownerHostMessageEl.textContent =
      "Use the link or scan this QR code to join the channel.";
  }
  if (ownerQrWrapperEl) {
    ownerQrWrapperEl.classList.remove("d-none");
  }

  activeSessionId = null;
}

// Owner UI when there is an ACTIVE session
function setOwnerActiveUI() {
  startIceBreakerBtn?.classList.add("d-none");
  endIceBreakerBtn?.classList.remove("d-none");
  showSessionLiveBadge();

  // Live status message
  if (ownerHostMessageEl) {
    ownerHostMessageEl.textContent =
      "Use the link or scan this QR code to join the channel.";
  }
  if (ownerQrWrapperEl) {
    ownerQrWrapperEl.classList.remove("d-none");
  }
}

// Owner UI when the latest session has ENDED
function setOwnerEndedUI() {
  startIceBreakerBtn?.classList.add("d-none");
  endIceBreakerBtn?.classList.add("d-none");
  hideSessionLiveBadge();

  // Change message to "ended"
  if (ownerHostMessageEl) {
    ownerHostMessageEl.textContent =
      "This ice-breaker session has ended. You can create a new channell if you want to run it again.";
  }

  // hide QR code
  if (ownerQrWrapperEl) {
    ownerQrWrapperEl.classList.add("d-none");
  }
}

/* ===== Watch last session for owner  ===== */
function watchOwnerSession() {
  if (!channelId || !currentUser) return;

  const sessionsRef = collection(db, "channels", channelId, "sessions");
  const q = query(sessionsRef, orderBy("createdAt", "desc"), limit(1));

  if (unsubSessionWatch) unsubSessionWatch();

  unsubSessionWatch = onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        console.log("[channel-preview] No sessions yet for this channel.");
        activeSessionId = null;
        sessionEnded = false;
        setOwnerIdleUI();
        return;
      }

      const last = snap.docs[0];
      const data = last.data();
      const status = data.status || "active";

      console.log("[channel-preview] Latest session:", last.id, status);

      if (status === "active") {
        activeSessionId = last.id;
        sessionEnded = false;
        setOwnerActiveUI();
      } else if (status === "end") {
        activeSessionId = last.id;
        sessionEnded = true;
        setOwnerEndedUI();
      } else {
        // Unknown status, treat as active
        activeSessionId = last.id;
        sessionEnded = false;
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

    // Build invite link for this channel
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
      showOwnerView();

      // Generate QR code from invite link
      if (joinQrImg) {
        const qrApi = "https://api.qrserver.com/v1/create-qr-code/";
        const qrSrc =
          qrApi + "?size=200x200&data=" + encodeURIComponent(inviteUrl.href);
        joinQrImg.src = qrSrc;
      }

      // Watch for latest session to determine UI state
      watchOwnerSession();

      // create new session
      startIceBreakerBtn?.addEventListener("click", async () => {
        if (!currentUser || !channelId) return;

        // If there is already an active session, do not create a new one
        if (activeSessionId && !sessionEnded) {
          alert("A session is already live for this channel.");
          return;
        }

        startIceBreakerBtn.disabled = true;

        try {
          const sessionsRef = collection(db, "channels", channelId, "sessions");
          const newSessionRef = await addDoc(sessionsRef, {
            ownerId: currentUser.uid,
            status: "active",
            createdAt: serverTimestamp(),
            endedAt: null,
          });

          activeSessionId = newSessionRef.id;
          sessionEnded = false;

          // If the owner clicks Start, go directly into this session
          const url = new URL("ice-breaker-session.html", window.location.href);
          url.searchParams.set("channelId", channelId);
          url.searchParams.set("sessionId", newSessionRef.id);
          window.location.href = url.href;
        } catch (err) {
          console.error("Failed to create session:", err);
          alert("Failed to start the ice breaker. Please try again.");
          startIceBreakerBtn.disabled = false;
        }
      });

      // "End" button → mark the current session as ended
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
          // watchOwnerSession() will update the UI to ended state
        } catch (err) {
          console.error("Failed to end session:", err);
          alert("Failed to end the session. Please try again.");
          endIceBreakerBtn.disabled = false;
        }
      });
    } else {
      // Non-owner: just show "Ready to Join" member card
      showMemberView();
    }
  } catch (err) {
    console.error("Failed to load channel:", err);
    if (titleEl) titleEl.textContent = "Failed to load channel";
  }
});
