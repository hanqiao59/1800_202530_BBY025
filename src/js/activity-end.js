/* ===== Firebase Imports ===== */
import { auth, db } from "./firebase-config.js";
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
  // Fallback: go back to main page if params are missing
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
  // User is logged in → initialize friend system
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

  const members = [];

  /* ==== Dynamic members from Firestore (real participants) ==== */
  if (channelId) {
    const membersRef = collection(db, "channels", channelId, "members");
    let membersSnapshot;
    try {
      membersSnapshot = await getDocs(membersRef);
    } catch (err) {
      console.error("Failed to fetch members:", err);
      friendsContainer.innerHTML =
        '<p class="text-danger">Failed to load members.</p>';
      return;
    }

    for (const docSnap of membersSnapshot.docs) {
      const memberId = docSnap.id;

      // Skip current user
      if (memberId === currentUser.uid) continue;

      // Fetch user profile from /users/{uid}
      let userSnap;
      try {
        userSnap = await getDoc(doc(db, "users", memberId));
      } catch (err) {
        console.warn(`Failed to fetch user ${memberId}:`, err);
        continue;
      }
      if (!userSnap.exists()) continue;

      const data = userSnap.data();

      members.push({
        id: memberId,
        name: data.name || "Unknown",
        bio: data.bio || "",
        colorClass: null, // Real users: use .avatar
        profileUrl: null, // Real users don't have a hard-coded profile page
      });
    }
  }

  /* ==== Hard-coded demo members  ==== */
  const demoMembers = [
    {
      id: "demo-b",
      name: "Berry Berrison",
      bio: "Hi! I'm Barry, a term 1 computer system technology student at BCIT. Looking to connect with like-minded peers! ",
      colorClass: "avatar-1",
      profileUrl: "others-profile.html",
    },
    {
      id: "demo-c",
      name: "Chris",
      bio: "Game Lover",
      colorClass: "avatar-2",
      profileUrl: null,
    },
    {
      id: "demo-f",
      name: "Felix",
      bio: "",
      colorClass: "avatar-3",
      profileUrl: null,
    },
    {
      id: "demo-j",
      name: "John",
      bio: "",
      colorClass: "avatar-4",
      profileUrl: null,
    },
    {
      id: "demo-m",
      name: "Martin",
      bio: "",
      colorClass: "avatar-5",
      profileUrl: null,
    },
    {
      id: "demo-n",
      name: "Noah",
      bio: "",
      colorClass: "avatar-1",
      profileUrl: null,
    },
    {
      id: "demo-s",
      name: "Sofia",
      bio: "",
      colorClass: "avatar-2",
      profileUrl: null,
    },
    {
      id: "demo-l",
      name: "Liam Lee",
      bio: "",
      colorClass: "avatar-3",
      profileUrl: null,
    },
    {
      id: "demo-k",
      name: "Kai Kim",
      bio: "Open to new friends",
      colorClass: "avatar-4",
      profileUrl: null,
    },
  ];

  // Combine real members + demo members
  demoMembers.forEach((m) => members.push(m));

  // If for some reason there are still no members, show an empty state
  if (members.length === 0) {
    friendsContainer.innerHTML = `<p>Nobody was in this session.</p>
    <div class="text-muted small">Well, that's a shame :/</div>`;
    return;
  }

  /* ==== Render all members ==== */
  members.forEach((member) => {
    const div = document.createElement("div");
    div.className =
      "friend d-inline-flex align-items-center gap-2 px-3 py-2 mb-2 rounded-3";

    const initials = getInitials(member.name);

    let avatarClass;
    if (member.colorClass) {
      avatarClass = `${member.colorClass} rounded-circle d-flex justify-content-center align-items-center`;
    } else {
      avatarClass =
        "avatar rounded-circle d-flex justify-content-center align-items-center";
    }

    const avatarHtml = `
      <div class="${avatarClass}" style="width:40px;height:40px;">
        ${initials}
      </div>
    `;

    // If profileUrl exists, wrap avatar + text into html
    const infoInner = `
      <div class="d-flex align-items-center gap-2 flex-shrink-1" style="min-width:0">
        ${avatarHtml}
        <div>
          <p class="fw-semibold mb-0 text-truncate" style="max-width: 150px;">${
            member.name
          }</p>
          <p class="text-muted small mb-0 text-truncate" style="max-width: 150px;">${
            member.bio || ""
          }</p>
        </div>
      </div>
    `;

    const mainBlock = member.profileUrl
      ? `<a href="${member.profileUrl}" class="text-decoration-none text-reset">${infoInner}</a>`
      : infoInner;

    div.innerHTML = `
      ${mainBlock}
      <i class="bi bi-person-plus add-friend-btn fs-5 ms-2"
         data-id="${member.id}"
         style="cursor:pointer;font-size:1.2rem"></i>
    `;

    friendsContainer.appendChild(div);
  });

  /* ==== Attach click listener for Add Friend ==== */
  if (!friendsContainer.hasListenerAttached) {
    friendsContainer.hasListenerAttached = true;

    friendsContainer.addEventListener("click", async (e) => {
      const btn = e.target.closest(".add-friend-btn");
      if (!btn) return;

      const targetUserId = btn.dataset.id;
      const currentUserId = currentUser.uid;

      // Demo users only update UI, no Firestore writes
      if (targetUserId.startsWith("demo-")) {
        btn.classList.remove("bi-person-plus");
        btn.classList.add("bi-check-lg");
        btn.style.color = "green";
        btn.style.cursor = "default";
        btn.style.pointerEvents = "none";
        return;
      }

      // Prevent sending the same request multiple times
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
