import { db } from "./firebaseConfig.js";

import { collection, onSnapshot } from "firebase/firestore";

const searchInput = document.getElementById("membersSearch");
const searchResult = document.getElementById("searchedResults");
const dropdown = document.getElementById("customDropdown");
const searchIcon = document.getElementById("searchGlass");

let membersData = {};
let dropdownItems = [];
let currentFocus = -1;

const channelId = sessionStorage.getItem("channelId");

if (!channelId) {
  console.error("channelId not found in sessionStorage");
}

function updatingMembers() {
  const membersRef = collection(db, "channels", channelId, "members");

  onSnapshot(membersRef, (snapshot) => {
    membersData = {};
    dropdown.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const member = docSnap.data();
      if (!member?.name) return;

      membersData[member.name] = member;

      const avatarURL =
        member.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          member.name
        )}&background=6c757d&color=ffffff&size=128&rounded=true`;

      const item = document.createElement("div");
      item.className =
        "dropdown-item d-flex align-items-center p-2 border-bottom bg-white";
      item.style.cursor = "pointer";

      item.innerHTML = `
        <img src="${avatarURL}" 
          style="width:40px;height:40px;border-radius:50%;object-fit:cover;margin-right:10px;">
        <span>${member.name}</span>
      `;

      item.onclick = () => selectMember(member);

      dropdown.appendChild(item);
    });
    // Add initial "No results"
    addNoResultsMessage();
    dropdownItems = [...dropdown.querySelectorAll(".dropdown-item")];
  });
}

function selectMember(member) {
  dropdown.classList.remove("show");
  searchInput.value = member.name;
  showMemberProfile(member, true);
}

function showMemberProfile(member, scrollIntoView = false) {
  const avatarURL =
    member.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      member.name
    )}&background=6c757d&color=ffffff&size=128&rounded=true`;

  searchResult.innerHTML = `
    <div class="member-profile d-flex align-items-center p-3 bg-light rounded shadow-sm mt-3">
      <img src="${avatarURL}" 
           style="width:70px;height:70px;border-radius:50%;object-fit:cover;margin-right:15px;">
      <div>
        <h4 class="mb-1">${member.name}</h4>
        <p class="text-muted mb-0">Currently in this session</p>
      </div>
    </div>
  `;

  if (scrollIntoView) {
    const profileCard = document.querySelector(".member-profile");
    profileCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function addNoResultsMessage() {
  const msg = document.createElement("div");
  msg.dataset.noresult = true;
  msg.className = "text-center text-muted p-2";
  msg.style.display = "none";
  msg.innerText = "No members found";
  dropdown.appendChild(msg);
}

function updateNoResultsMessage(show) {
  const msg = dropdown.querySelector("[data-noresult]");
  if (msg) msg.style.display = show ? "block" : "none";
}

function showNotFoundMessage(name) {
  searchResult.innerHTML = `
    <div class="p-3 bg-danger-subtle rounded mt-3">
      <strong>${name}</strong> was not found in this session.
    </div>
  `;
}

searchIcon.addEventListener("click", () => {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return;

  const exact = Object.values(membersData).find(
    (m) => m.name.toLowerCase() === query
  );

  const partial = Object.values(membersData).filter((m) =>
    m.name.toLowerCase().includes(query)
  );

  if (exact) {
    selectMember(exact);
  } else if (partial.length > 0) {
    selectMember(partial[0]);
  } else {
    showNotFoundMessage(searchInput.value.trim());
  }

  dropdown.classList.remove("show");
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  dropdown.classList.add("show");

  let visibleCount = 0;

  dropdownItems.forEach((item) => {
    const span = item.querySelector("span");
    const nameLower = span.innerText.toLowerCase();
    const matchIndex = nameLower.indexOf(query);

    if (query && matchIndex > -1) {
      // Bold matching text
      const originalName = span.innerText;
      span.innerHTML =
        originalName.substring(0, matchIndex) +
        `<span class="match">${originalName.substring(
          matchIndex,
          matchIndex + query.length
        )}</span>` +
        originalName.substring(matchIndex + query.length);
    } else {
      span.innerHTML = span.textContent; // reset
    }

    const match = nameLower.includes(query);
    item.style.display = match ? "flex" : "none";
    if (match) visibleCount++;
  });

  updateNoResultsMessage(visibleCount === 0);
  currentFocus = -1;
  setActiveItem([]);
});

searchInput.addEventListener("keydown", (e) => {
  const visibleItems = dropdownItems.filter(
    (item) => item.style.display !== "none"
  );

  if (e.key === "ArrowDown") {
    e.preventDefault();
    currentFocus++;
    if (currentFocus >= visibleItems.length) currentFocus = 0;
    setActiveItem(visibleItems);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    currentFocus--;
    if (currentFocus < 0) currentFocus = visibleItems.length - 1;
    setActiveItem(visibleItems);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (currentFocus > -1 && visibleItems[currentFocus]) {
      visibleItems[currentFocus].click();
    } else {
      // fallback: search button behavior
      searchIcon.click();
    }
  }
});

function setActiveItem(items) {
  // Remove active from all items (including hidden)
  dropdownItems.forEach((item) => item.classList.remove("active"));

  // Add active to focused visible item
  if (currentFocus > -1 && items[currentFocus]) {
    items[currentFocus].classList.add("active");
    items[currentFocus].scrollIntoView({ block: "nearest" });
  }
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-container")) {
    dropdown.classList.remove("show");
  }
});

updatingMembers();
