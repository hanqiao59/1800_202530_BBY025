import { db } from "/src/firebaseConfig.js";

import { collection, onSnapshot } from "firebase/firestore";

const searchInput = document.getElementById("membersSearch");
const memberList = document.getElementById("membersList");
const searchIcon = document.getElementById("searchGlass");
const searchResult = document.getElementById("searchedResults");

let currentMembers = {};

function updatingMembers() {
  const members = collection(db, `channels/${channelId}/members`);

  onSnapshot(members, (snapshot) => {
    currentMembers = {};
    memberList.innerHTML = "";

    snapshot.forEach((doc) => {
      const member = doc.data();
      currentMembers[member.name] = true;

      const option = document.createElement("option");
      option.value = member.name;
      memberList.appendChild(option);
    });
    console.log("Members updated:", Object.keys(currentMembers));
  });
}

function searchMembers() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    searchResult.innerHTML = "Please enter a name to start searching.";
    return;
  }

  const found = Object.keys(currentMembers).find(
    (name) => name.toLowerCase() === query
  );

  if (found) {
    searchResult.innerHTML = `<p>${found} is in the session</p>`;
  } else {
    searchResult.innerHTML = `<p class="container-fluid bg-dark-subtle mb-3 fs-5">${searchInput.value.trim()} not found.</p>`;
  }
}

searchIcon.addEventListener("click", searchMembers);
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    searchMembers();
  }
});

updatingMembers();
