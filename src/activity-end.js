/* ===== Firebase Imports ===== */
import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  collection,
  getDocs,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

/* ===== URL Params ===== */
const params = new URLSearchParams(window.location.search);
const channelId = params.get("channelId");
const sessionId = params.get("sessionId");
const link = document.getElementById("viewHistoryLink");

/* ===== Update History Link ===== */
// If we have channelId and sessionId, set the link to the history page
if (link && channelId && sessionId) {
  const url = new URL("ice-breaker-session.html", window.location.href);
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("mode", "history");

  link.href = url.href;
} else if (link) {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "main.html";
  });
}

/* ===== Firebase Auth State Listener ===== */
onAuthStateChanged(auth, async (user) => {
  // User not logged in
  if (!user) {
    console.error("⛔ No Firebase user logged in.");
    return;
  }
  // User is logged in
  initializeFriendSystem(user);
});

/* ===== Initialize Friend System ===== */
async function initializeFriendSystem(currentUser) {
  const friendsContainer = document.querySelector(".friends-list");

  const membersRef = collection(db, "channels", channelId, "members");
  const membersSnapshot = await getDocs(membersRef);

  const members = [];

  if (!friendsContainer) {
    console.error("❌ .friends-list container not found!");
    return;
  }

  membersSnapshot.forEach((doc) => {
    if (doc.id !== currentUser.uid) {
      members.push({ id: doc.id, ...doc.data() });
    }
  });

  // Clear existing content
  friendsContainer.innerHTML = "";

  // Populate members
  members.forEach((member) => {
    const div = document.createElement("div");
    div.className =
      "friend d-flex align-items-center justify-content-between p-2 mb-2 rounded";

    div.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <div class="avatar bg-secondary-subtle rounded-circle" 
             style="width:40px;height:40px;"></div>
        <div>
          <p class="fw-semibold mb-0">${member.name}</p>
          <p class="text-muted small mb-0">${member.bio}</p>
        </div>
      </div>
      <i class="bi bi-person-plus add-friend-btn"
         data-id="${member.id}"
         style="cursor:pointer;font-size:1.2rem"></i>
    `;

    friendsContainer.appendChild(div);
  });

  // Add click listener for friend requests
  friendsContainer.addEventListener("click", async (e) => {
    const btn = e.target.closest(".add-friend-btn");
    if (!btn) return;

    const targetUserId = btn.dataset.id;
    const currentUserId = currentUser.uid;

    // UI: Prevent double sending
    btn.classList.remove("bi-person-plus");
    btn.classList.add("bi-hourglass-split");

    try {
      const currentUserRef = doc(
        db,
        "channels",
        channelId,
        "users",
        currentUserId
      );
      const targetUserRef = doc(
        db,
        "channels",
        channelId,
        "users",
        targetUserId
      );

      // Add outgoing request for current user
      await updateDoc(currentUserRef, {
        "friendRequests.outgoing": arrayUnion(targetUserId),
      });

      // Add incoming request for target user
      await updateDoc(targetUserRef, {
        "friendRequests.incoming": arrayUnion(currentUserId),
      });

      // Success UI
      btn.classList.remove("bi-hourglass-split");
      btn.classList.add("bi-check-lg");
      btn.style.color = "green";
      btn.style.cursor = "default";
    } catch (err) {
      // Error UI
      btn.classList.remove("bi-hourglass-split");
      btn.classList.add("bi-exclamation-circle");
      btn.style.color = "red";
    }
  });
}
