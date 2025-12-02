import { auth, db } from "/src/js/firebaseConfig.js";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const nameEl = document.getElementById("profileName");
const bioEl = document.getElementById("profileBio");
const interestsEl = document.getElementById("profileInterests");
const avatarEl = document.getElementById("profileAvatar");

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

    const fullName = data.fullName || data.name || "User";
    nameEl.innerText = fullName;

    avatarEl.innerText = fullName.charAt(0).toUpperCase();

    bioEl.innerText = data.bio || "No bio provided.";

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
