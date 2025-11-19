/* ========== IMPORTS ========== */
import { auth, db } from "./firebaseConfig.js";
import {
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  onAuthStateChanged,
} from "firebase/auth";

/* ========== MAIN PROFILE LOADING ========== */
(async function showUserProfile() {
  const nameEl = document.getElementById("User-Name");
  const avatarEl = document.getElementById("userAvatar");
  const bannerEl = document.getElementById("userBanner");

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const uid = user.uid;
    const userRef = doc(db, "users", uid);

    // Real-time updates
    onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      /* ===== Display Name ===== */
      if (data.displayName) {
        nameEl.textContent = data.displayName;
      } else if (user.displayName) {
        nameEl.textContent = user.displayName;
      } else {
        nameEl.textContent = "User";
      }

      /* ===== Avatar ===== */
      if (data.photoURL) {
        avatarEl.src = data.photoURL;
      } else if (user.photoURL) {
        avatarEl.src = user.photoURL;
      } else {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
          nameEl.textContent
        )}&background=6c757d&color=ffffff&size=128&rounded=true`;
      }

      /* ===== Banner ===== */
      if (data.bannerURL) {
        bannerEl.src = data.bannerURL;
      }
    });
  });
})();
