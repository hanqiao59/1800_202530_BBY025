import { db } from "/src/firebaseConfig.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth } from "/src/firebaseConfig.js";
import { checkAuthState } from "/src/authentication.js";

const search = document.getElementById("#members-go-here");

const SearchTemplate = document.getElementById("#ListTemplate");

checkAuthState(auth, (user) => {
  if (!user) {
    console.log("You are not signed in.");
  } else {
    const userRef = doc(db, "users");
  }
});

const memberList = [];
async function populateSearchList(dataListID, members) {
  const dataList = document.getElementById(dataListID);

  if (!Array.isArray(members)) {
    console.log("The input is not an Array.");
  }

  members.forEach((member) => {
    const options = document.createElement("option");
    options.value = member;
    dataList.appendChild(options);
  });
}

populateSearchList("members-list", memberList);
