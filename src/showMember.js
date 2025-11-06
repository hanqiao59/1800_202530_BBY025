import { db } from "./firebaseConfig.js";
import { doc, getDoc } from "firebase/firestore";

async function showMember() {
  const memberEl = await getDoc(doc(db, "users", user.uid));
}

(async function showAvatar() {
  const nameEl = document.getElementById("User-Name");
  const roleEl = document.getElementById("User-Role");
  const avatarEl = document.getElementById("userAvatar");
  if (!nameEl) return;

  try {
    const { onAuthReady } = await import("./authentication.js");
    onAuthReady((user) => {
      if (!user) {
        location.href = "login.html";
        return;
      }
      const name = user.displayName;
      nameEl.textContent = `${name}`;
      if (!avatarEl) {
        return (innerHTML = "${name.charAt(0).toUpperCase()}");
      } else if (user.photoURL) {
        avatarEl.src = user.photoURL;
      } else {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
          name
        )}&background=6c757d&color=ffffff&size=128&rounded=true`;
      }
    });
  } catch (err) {
    console.warn("[auth] authentication.js Failed:", err);
  }
})();
