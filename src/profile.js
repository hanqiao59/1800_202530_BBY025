// profile.js
// --------------------------------------------------
// Loads profile data from Firestore
// Generates a letter avatar instead of using storage
// --------------------------------------------------

import { auth, db } from "/src/firebaseConfig.js";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// DOM elements
const nameEl = document.getElementById("profileName");
const bioEl = document.getElementById("profileBio");
const interestsEl = document.getElementById("profileInterests");
const avatarEl = document.getElementById("profileAvatar");

// Wait for login
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    nameEl.innerText = "Not logged in";
    return;
  }

  loadProfile(user.uid);
});

async function loadProfile(uid) {
  try {
    const docRef = doc(db, "users", uid);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      nameEl.innerText = "New User";
      bioEl.innerText = "No bio yet.";
      return;
    }

    const data = snap.data();

    // Set name
    const fullName = data.fullName || data.name || "User";
    nameEl.innerText = fullName;

    // Set avatar letter
    avatarEl.innerText = fullName.charAt(0).toUpperCase();

    // Set bio
    bioEl.innerText = data.bio || "No bio provided.";

    // Set interests list
    interestsEl.innerHTML = "";
    if (Array.isArray(data.interests)) {
      data.interests.forEach((interest) => {
        const badge = document.createElement("span");
        badge.className = "badge bg-secondary";
        badge.innerText = interest;
        interestsEl.appendChild(badge);
      });
    }

  } catch (error) {
    console.error("Error loading profile:", error);
  }
}
