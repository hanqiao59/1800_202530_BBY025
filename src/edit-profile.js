// edit-profile.js
import { auth, db, storage } from "./firebaseConfig.js";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// DOM elements
const bannerInput = document.getElementById("banner");
const profileInput = document.getElementById("profilePhoto");
const nameInput = document.getElementById("name");
const bioInput = document.getElementById("bio");

const bannerPreview = document.querySelector(".banner-preview");
const profilePreview = document.querySelector(".profile-preview");

const form = document.querySelector(".edit-profile-form");
const submitButton = form?.querySelector('button[type="submit"]');

let currentUserUID = null;

/* Upload file to Firebase Storage */
async function uploadFile(file, path) {
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

/* Load existing data into form + previews */
async function loadUserData(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) return;

  const data = snap.data();

  // Load text fields
  nameInput.value = data.fullName || data.name || "";
  bioInput.value = data.bio || "";

  // Load banner preview
  if (data.banner) {
    bannerPreview.innerHTML = "";
    bannerPreview.style.backgroundImage = `url('${data.banner}')`;
    bannerPreview.style.backgroundSize = "cover";
    bannerPreview.style.backgroundPosition = "center";
  }

  // Load profile picture preview
  if (data.profilePicture) {
    profilePreview.innerHTML = "";
    profilePreview.style.backgroundImage = `url('${data.profilePicture}')`;
    profilePreview.style.backgroundSize = "cover";
    profilePreview.style.backgroundPosition = "center";
  }
}

/* Save profile */
async function handleSubmit(e) {
  e.preventDefault();

  if (!currentUserUID) {
    alert("Not logged in");
    return;
  }

  submitButton.disabled = true;

  const userRef = doc(db, "users", currentUserUID);

  const updateData = {
    fullName: nameInput.value.trim(),
    bio: bioInput.value.trim(),
  };

  try {
    if (bannerInput.files.length > 0) {
      const file = bannerInput.files[0];
      const url = await uploadFile(file, `users/${currentUserUID}/banner.jpg`);
      updateData.banner = url;
    }

    if (profileInput.files.length > 0) {
      const file = profileInput.files[0];
      const url = await uploadFile(file, `users/${currentUserUID}/profile.jpg`);
      updateData.profilePicture = url;
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

/* Auth Listener */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUserUID = user.uid;

  // Load current data
  await loadUserData(user.uid);

  form.addEventListener("submit", handleSubmit);
});

/** Local previews */
bannerInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    const file = URL.createObjectURL(e.target.files[0]);
    bannerPreview.style.backgroundImage = `url('${file}')`;
    bannerPreview.innerHTML = "";
  }
});

profileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    const file = URL.createObjectURL(e.target.files[0]);
    profilePreview.style.backgroundImage = `url('${file}')`;
    profilePreview.innerHTML = "";
  }
});
