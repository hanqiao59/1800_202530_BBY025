// edit-profile.js
import { auth, db } from "./firebaseConfig.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Initialize storage correctly
const storage = getStorage();

// DOM elements
const bannerInput = document.getElementById("banner");
const profileInput = document.getElementById("profilePhoto");
const nameInput = document.getElementById("name");
const bioInput = document.getElementById("bio");
const form = document.querySelector(".edit-profile-form");
const submitButton = form ? form.querySelector('button[type="submit"]') : null;

let currentUserUID = null;

/** Upload file safely and return download URL */
async function uploadFileSafe(file, path) {
  try {
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  } catch (err) {
    console.error("upload error", err);
    return null;
  }
}

/** Load existing Firestore user data */
async function loadUserData(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    console.warn("User doc does not exist:", uid);
    return;
  }

  const data = snap.data();

  nameInput.value = data.fullName || data.name || "";
  bioInput.value = data.bio || "";
}

/** Save profile */
async function handleSubmit(e) {
  e.preventDefault();

  if (!currentUserUID) return alert("Not logged in");

  submitButton.disabled = true;

  const userRef = doc(db, "users", currentUserUID);

  const updateData = {
    fullName: nameInput.value.trim(),
    bio: bioInput.value.trim(),
  };

  try {
    // Banner upload
    if (bannerInput.files.length > 0) {
      const file = bannerInput.files[0];
      const url = await uploadFileSafe(
        file,
        `users/${currentUserUID}/banner.jpg`
      );
      if (url) updateData.banner = url; // correct field name
    }

    // Profile photo upload
    if (profileInput.files.length > 0) {
      const file = profileInput.files[0];
      const url = await uploadFileSafe(
        file,
        `users/${currentUserUID}/profile.jpg`
      );
      if (url) updateData.profilePicture = url; // correct field name
    }

    await setDoc(userRef, updateData, { merge: true });

    alert("Profile updated!");
  } catch (err) {
    console.error("Save error:", err);
    alert("Error saving profile.");
  } finally {
    submitButton.disabled = false;
  }
}

/** Auth listener */
onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");

  currentUserUID = user.uid;

  await loadUserData(user.uid);
  form.addEventListener("submit", handleSubmit);
});
