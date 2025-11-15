// src/channel-preview.js
import { auth, db } from "/src/firebaseConfig.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
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
const joinQrImg = document.getElementById("joinQr");

let channelData = null;
let currentUser = null;

// 3) Wait for auth state, then load channel and setup UI
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!channelId) {
    if (titleEl) titleEl.textContent = "No channel ID provided";
    return;
  }

  try {
    // 3.1 Load the channel document
    const snap = await getDoc(doc(db, "channels", channelId));
    if (!snap.exists()) {
      if (titleEl) titleEl.textContent = "Channel not found";
      return;
    }

    channelData = snap.data();

    // Show the channel name
    if (titleEl) {
      titleEl.textContent = channelData.name || "Untitled Channel";
    }

    // Build the invite link (same idea as your main.js create-channel flow)
    const inviteUrl = new URL("channel-preview.html", window.location.href);
    inviteUrl.searchParams.set("id", channelId);

    // 3.2 Configure the "Continue" button for non-owner
    if (continueBtn) {
      const tagsUrl = new URL("select-tags.html", window.location.href);
      tagsUrl.searchParams.set("channelId", channelId);
      continueBtn.setAttribute("href", tagsUrl.href);
    }

    // 3.3 Determine if the current user is the owner
    const isOwner =
      user && channelData.createdBy && channelData.createdBy === user.uid;

    if (isOwner) {
      // ===== OWNER VIEW =====
      // Show host card, hide member "Ready to Join" card
      ownerHostCard?.classList.remove("d-none");
      memberJoinCard?.classList.add("d-none");

      // Optional: generate a QR code for the invite link
      // Here we use a simple third-party QR service. You can swap it later.
      if (joinQrImg) {
        const qrApi = "https://api.qrserver.com/v1/create-qr-code/";
        const qrSrc =
          qrApi + "?size=200x200&data=" + encodeURIComponent(inviteUrl.href);
        joinQrImg.src = qrSrc;
      }

      // Wire the "Start ice breaker session" button
      startIceBreakerBtn?.addEventListener("click", async () => {
        try {
          // Create a new session under this channel
          const sessionsRef = collection(db, "channels", channelId, "sessions");
          const sessionDoc = await addDoc(sessionsRef, {
            ownerId: user.uid,
            status: "pending",
            createdAt: serverTimestamp(),
            endedAt: null,
          });

          // Navigate to the ice-breaker session page
          const url = new URL("ice-breaker-session.html", window.location.href);
          url.searchParams.set("channelId", channelId);
          url.searchParams.set("sessionId", sessionDoc.id);
          window.location.href = url.href;
        } catch (err) {
          console.error("Failed to create session:", err);
          alert("Failed to start the ice breaker. Please try again.");
        }
      });
    } else {
      // ===== MEMBER VIEW =====
      // Show "Ready to Join" card, hide host controls
      memberJoinCard?.classList.remove("d-none");
      ownerHostCard?.classList.add("d-none");
    }
  } catch (err) {
    console.error("Failed to load channel:", err);
    if (titleEl) titleEl.textContent = "Failed to load channel";
  }
});
