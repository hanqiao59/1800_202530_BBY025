import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAvbVTPcuyiNFzLqsXxNOWYxicpDNJWkiM",
  authDomain: "peerlink-group-project-1800.firebaseapp.com",
  projectId: "peerlink-group-project-1800",
  appId: "1:715710165789:web:cba6413e1a86dd0d3567f4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const editBtn = document.getElementById("editBtn");
const tagSelection = document.getElementById("tag-selection");
const selectedTagsDiv = document.getElementById("selected-tags");

const allTags = [
  "Technology",
  "Art",
  "Music",
  "Gaming",
  "Fitness",
  "Cooking",
  "Travel",
  "Movies",
  "Science",
  "Reading",
  "Fashion",
  "Sports",
];

let selectedTags = [];
let editing = false;
let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    console.log("Logged in as:", user.email);
    await loadUserInterests(user.uid);
  } else {
    console.log("No user logged in — signing in test user...");
    await signInWithEmailAndPassword(
      auth,
      "test@example.com",
      "password123"
    ).catch((err) => console.log(err.message));
  }
});

function renderSelectedTags() {
  selectedTagsDiv.innerHTML = "";
  if (selectedTags.length === 0) {
    selectedTagsDiv.innerHTML = "<p>No interests selected.</p>";
  } else {
    selectedTags.forEach((tag) => {
      const el = document.createElement("span");
      el.className = "tag selected";
      el.textContent = tag;
      selectedTagsDiv.appendChild(el);
    });
  }
}

function renderTagSelection() {
  tagSelection.innerHTML = "";
  allTags.forEach((tag) => {
    const el = document.createElement("span");
    el.className = "tag" + (selectedTags.includes(tag) ? " selected" : "");
    el.textContent = tag;
    el.addEventListener("click", () => toggleTag(tag, el));
    tagSelection.appendChild(el);
  });
}

function toggleTag(tag, element) {
  if (selectedTags.includes(tag)) {
    selectedTags = selectedTags.filter((t) => t !== tag);
    element.classList.remove("selected");
  } else {
    selectedTags.push(tag);
    element.classList.add("selected");
  }
}

editBtn.addEventListener("click", async () => {
  if (!editing) {
    editing = true;
    tagSelection.classList.add("active");
    renderTagSelection();
    editBtn.textContent = "Save";
  } else {
    editing = false;
    tagSelection.classList.remove("active");
    editBtn.textContent = "Edit";
    renderSelectedTags();

    if (currentUser) {
      await saveInterests(currentUser.uid, selectedTags);
    } else {
      console.log("User not logged in");
    }
  }
});

async function saveInterests(userId, selectedTags) {
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, { interests: selectedTags }, { merge: true });
  console.log("✅ Interests saved for:", userId);
}

async function loadUserInterests(userId) {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    selectedTags = snap.data().interests || [];
  } else {
    selectedTags = [];
  }
  renderSelectedTags();
}
