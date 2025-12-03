/* ===== Firebase ===== */
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "firebase/auth";
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
  getDocs,
} from "firebase/firestore";

/* ===== URL params & session storage ===== */
const params = new URLSearchParams(window.location.search);
const channelId = params.get("id");

if (!channelId) {
  console.warn("[channel-preview] Missing channel id in URL.");
} else {
  // Store the channelId so other pages can reuse it
  sessionStorage.setItem("channelId", channelId);
}

/* ===== DOM elements ===== */
const titleEl = document.getElementById("channelTitle");
const memberJoinCard = document.getElementById("memberJoinCard");
const ownerHostCard = document.getElementById("ownerHostCard");
const continueBtn = document.getElementById("continueBtn");

const startIceBreakerBtn = document.getElementById("startIceBreakerBtn");
const endIceBreakerBtn = document.getElementById("endIceBreakerBtn");
const joinQrImg = document.getElementById("joinQr");
const sessionLiveBadge = document.getElementById("sessionLiveBadge");

// Owner message and QR container (inside owner card)
const ownerHostMessageEl = ownerHostCard?.querySelector("p.text-secondary");
const ownerQrWrapperEl = ownerHostCard?.querySelector(
  ".d-flex.justify-content-center.mb-3"
);

//Avatar DOMs
const ownerAvatarImg = document.querySelector(".owner-avatar");
const membersContainer = document.querySelector("#membersAvatarsContainer");
const userAvatar = document.querySelector("#memberJoinCard .user-avatar");

/* ===== Local state ===== */
let channelData = null;
let currentUser = null;
let sessionEnded = false;

// Track the latest session for this channel
let activeSessionId = null;
let unsubSessionWatch = null;

/* ===== UI helpers ===== */
// Show either member view or owner view
function showMemberView() {
  memberJoinCard?.classList.remove("d-none");
  ownerHostCard?.classList.add("d-none");
}
// Show owner view
function showOwnerView() {
  memberJoinCard?.classList.add("d-none");
  ownerHostCard?.classList.remove("d-none");
}
// Show / hide "Session Live" badge
function showSessionLiveBadge() {
  sessionLiveBadge?.classList.remove("d-none");
}
// Hide "Session Live" badge
function hideSessionLiveBadge() {
  sessionLiveBadge?.classList.add("d-none");
}
// Owner UI when there is NO live session (idle state)
function setOwnerIdleUI() {
  startIceBreakerBtn?.classList.remove("d-none");
  endIceBreakerBtn?.classList.add("d-none");
  hideSessionLiveBadge();

  // Show invite message and QR code
  if (ownerHostMessageEl) {
    ownerHostMessageEl.textContent =
      "Use the link or scan this QR code to join the channel.";
  }
  // Show QR code
  if (ownerQrWrapperEl) {
    ownerQrWrapperEl.classList.remove("d-none");
  }
  activeSessionId = null;
}

/* ===== Owner UI states ===== */
// Owner UI when there is an active live session
function setOwnerActiveUI() {
  startIceBreakerBtn?.classList.add("d-none");
  endIceBreakerBtn?.classList.remove("d-none");
  showSessionLiveBadge();

  // Show live session message and QR code
  if (ownerHostMessageEl) {
    ownerHostMessageEl.textContent =
      "Use the link or scan this QR code to join the channel.";
  }
  // Show QR code
  if (ownerQrWrapperEl) {
    ownerQrWrapperEl.classList.remove("d-none");
  }
}

//Show avatars' initials
function avatarInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ===== Owner UI when session has ended ===== */
function setOwnerEndedUI() {
  startIceBreakerBtn?.classList.add("d-none");
  endIceBreakerBtn?.classList.add("d-none");
  hideSessionLiveBadge();
  // Show session ended message, hide QR code
  if (ownerHostMessageEl) {
    ownerHostMessageEl.textContent =
      "This ice-breaker session has ended. You can create a new channel if you want to run it again.";
  }
  // Hide QR code
  if (ownerQrWrapperEl) {
    ownerQrWrapperEl.classList.add("d-none");
  }
}

/* ===== Watch last session for owner ===== */
function watchOwnerSession() {
  if (!channelId || !currentUser) return;

  const sessionsRef = collection(db, "channels", channelId, "sessions");
  const q = query(sessionsRef, orderBy("createdAt", "desc"), limit(1));

  // Unsubscribe previous watcher if any
  if (unsubSessionWatch) unsubSessionWatch();

  // Listen for latest session changes
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

      // Update UI based on session status
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
  console.log("[channel-preview] Current user:", user?.uid || "none");

  // Validate channelId
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
    // ===== Load members and render avatars =====
    const membersRef = collection(db, "channels", channelId, "members");
    onSnapshot(membersRef, async (membersSnap) => {
      try {
        let members = membersSnap.docs.map((d) => d.id);

        const profiles = [];
        for (let id of members) {
          const userDoc = await getDoc(doc(db, "users", id));
          if (userDoc.exists()) {
            profiles.push({ id, ...userDoc.data() });
          }
        }

        // ---- Render Owner Avatar ----
        if (ownerAvatarImg) {
          const ownerProfile = profiles.find(
            (m) => m.id === channelData.createdBy
          );

          const ownerName =
            (currentUser && currentUser.uid === channelData.createdBy
              ? currentUser.displayName
              : ownerProfile?.name) || "Owner";

          ownerAvatarImg.textContent = avatarInitials(ownerName);
          console.log("[channel-preview] Set owner avatar initials.");
        }

        /* ---- MEMBERS SECTION (excluding owner) ---- */
        const nonOwnerMembers = profiles.filter(
          (p) => p.id !== channelData.createdBy && p.name
        );

        membersContainer.innerHTML = ""; // clear old avatars

        /* ---- CURRENT USER AVATAR ---- */
        if (userAvatar && currentUser) {
          const nameFromAuth = currentUser.displayName;
          userAvatar.textContent = avatarInitials(nameFromAuth);
          console.log("[channel-preview] Set user avatar initials.");
        } else {
          console.log("[channel-preview] No current user for avatar.");
        }

        if (nonOwnerMembers.length === 0) {
          const msg = document.createElement("span");
          msg.className = "text-muted d-block my-2";
          msg.textContent = "No members yet";
          membersContainer.appendChild(msg);
          console.log("[channel-preview] No non-owner members to show.");
          return;
        } else {
          // Render up to 5 avatars
          nonOwnerMembers.slice(0, 5).forEach((p) => {
            const avatar = document.createElement("span");
            avatar.className =
              "member-avatar rounded-circle bg-secondary-subtle fw-bold " +
              "d-inline-flex justify-content-center align-items-center me-1";
            avatar.textContent = avatarInitials(p.name);
            membersContainer.appendChild(avatar);
          });

          // (+X more)
          if (nonOwnerMembers.length > 5) {
            const link = document.createElement("a");
            link.href = "group-members.html";
            link.className = "small ms-2";
            link.textContent = `+${nonOwnerMembers.length - 5} more`;
            membersContainer.appendChild(link);
          }
        }
      } catch (err) {
        console.error("[channel-preview] Failed to render members:", err);
      }
    });

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

    // Show owner view if user is the owner
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

      // Owner: create a new live session (stay on this page)
      startIceBreakerBtn?.addEventListener("click", async () => {
        if (!currentUser || !channelId) return;

        // Prevent starting a new session if one is already active
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

          // UI will be updated by watchOwnerSession()
          console.log(
            "[channel-preview] Session started by owner, id =",
            newSessionRef.id
          );
        } catch (err) {
          console.error("[channel-preview] Failed to create session:", err);
          alert("Failed to start the session. Please try again.");
          startIceBreakerBtn.disabled = false;
        }
      });

      // Owner: end the active live session
      endIceBreakerBtn?.addEventListener("click", async () => {
        if (!currentUser || !channelId || !activeSessionId) return;

        endIceBreakerBtn.disabled = true;

        // Update session status to "end"
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
          // UI will be updated by watchOwnerSession()
        } catch (err) {
          console.error("[channel-preview] Failed to end session:", err);
          alert("Failed to end the session. Please try again.");
          endIceBreakerBtn.disabled = false;
        }
      });
    } else {
      // Non-owner: just show "Ready to Join" member card
      showMemberView();
    }
  } catch (err) {
    console.error("[channel-preview] Failed to load channel:", err);
    if (titleEl) titleEl.textContent = "Failed to load channel";
  }
});
