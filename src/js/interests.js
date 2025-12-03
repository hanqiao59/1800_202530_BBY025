import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

const editBtn = document.getElementById("editBtn");
const tagSelection = document.getElementById("tag-selection");
const selectedTagsDiv = document.getElementById("selected-tags");
const editDivider = document.createElement("hr");
editDivider.className = "divider";
editDivider.style.display = "none";
selectedTagsDiv.insertAdjacentElement("afterend", editDivider);

const allTags = [
  "Tech",
  "Art",
  "Music",
  "Gaming",
  "Fitness",
  "Cooking",
  "Traveling",
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
    return;
  }

  selectedTags.forEach((tag) => {
    const el = document.createElement("span");
    el.className = "tag selected";
    el.textContent = tag;
    selectedTagsDiv.appendChild(el);
  });
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

    //divider
    editDivider.style.display = "block";
  } else {
    editing = false;
    tagSelection.classList.remove("active");
    editBtn.textContent = "Edit";
    renderSelectedTags();

    editDivider.style.display = "none";

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

  selectedTags = snap.exists() ? snap.data().interests || [] : [];

  renderSelectedTags();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const userData = userSnap.data();

    document.querySelector("h2").textContent = userData.name || "Unknown User";

    const firstLetter = (userData.name || "U").charAt(0).toUpperCase();
    document.querySelector(".profile-picture").textContent = firstLetter;
  }
});
