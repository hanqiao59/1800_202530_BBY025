/* ===== Firebase Imports ===== */
import { auth, db } from "/src/js/firebaseConfig.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  collection,
  getDocs,
  updateDoc,
  arrayUnion,
  getDoc,
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
  if (!friendsContainer) {
    console.error("❌ .friends-list container not found!");
    return;
  }
  // Clear existing content
  friendsContainer.innerHTML = "";

  //Load channel members
  const membersRef = collection(db, "channels", channelId, "members");
  let membersSnapshot;
  try {
    membersSnapshot = await getDocs(membersRef);
  } catch (err) {
    console.error("Failed to fetch members:", err);
    friendsContainer.innerHTML = `<p class="text-danger">Failed to load members.</p>`;
    return;
  }

  const members = [];
  for (const docSnap of membersSnapshot.docs) {
    const memberId = docSnap.id;

    if (memberId === currentUser.uid) continue; // skip self

    // fetch global user info
    let userSnap;
    try {
      userSnap = await getDoc(doc(db, "users", memberId));
    } catch (err) {
      console.warn(`Failed to fetch user ${memberId}:`, err);
      continue;
    }
    if (!userSnap.exists()) continue;

    const userData = {
      id: memberId,
      name: userSnap.data().name || "Unknown",
      bio: userSnap.data().bio || "",
    };

    members.push(userData);
  }

  // Populate members
  if (members.length === 0) {
    friendsContainer.innerHTML = `<p>Nobody was in this session.</p>
    <div class="text-muted small">Well, that's a shame :/</div>`;
    return;
  }
  members.forEach((member) => {
    const div = document.createElement("div");
    div.className =
      "friend d-flex flex-wrap align-items-center justify-content-between p-2 mb-2 rounded";

    div.innerHTML = `
      <div class="d-flex align-items-center gap-2 flex-shrink-1" style="min-width:0">
        <div class="avatar bg-secondary-subtle rounded-circle d-flex justify-content-center align-items-center" 
     style="width:40px;height:40px;">${getInitials(member.name)}</div>
        <div>
          <p class="fw-semibold mb-0 text-truncate" style="max-width: 150px;">${
            member.name
          }</p>
          <p class="text-muted small mb-0 text-truncate" style="max-width: 150px;">${
            member.bio || ""
          }</p>
        </div>
      </div>
      <i class="bi bi-person-plus add-friend-btn fs-5 ms-2"
         data-id="${member.id}"
         style="cursor:pointer;font-size:1.2rem"></i>
    `;

    friendsContainer.appendChild(div);
  });

  // Attach click listener once
  if (!friendsContainer.hasListenerAttached) {
    friendsContainer.hasListenerAttached = true;

    // Add click listener for friend requests
    friendsContainer.addEventListener("click", async (e) => {
      const btn = e.target.closest(".add-friend-btn");
      if (!btn) return;

      const targetUserId = btn.dataset.id;
      const currentUserId = currentUser.uid;

      // Prevent double sending
      if (btn.dataset.sending === "true") return;
      btn.dataset.sending = "true";

      btn.classList.remove("bi-person-plus");
      btn.classList.add("bi-hourglass-split");

      try {
        const currentUserRef = doc(db, "users", currentUserId);

        // Add outgoing request for current user
        await updateDoc(currentUserRef, {
          "friendRequests.outgoing": arrayUnion(targetUserId),
        });

        // Success UI
        btn.classList.remove("bi-hourglass-split");
        btn.classList.add("bi-check-lg");
        btn.style.color = "green";
        btn.style.cursor = "default";
        btn.style.pointerEvents = "none";
      } catch (err) {
        // Error UI
        console.error("Failed to send friend request:", err);
        btn.classList.remove("bi-hourglass-split");
        btn.classList.add("bi-person-plus");
        btn.dataset.sending = "false"; // allow retry
        btn.style.color = "red";
      }
    });
  }
}

/* ===== Helper: Get initials from name ===== */
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
