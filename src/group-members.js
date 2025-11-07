import { db } from "/src/firebaseConfig.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth } from "/src/firebaseConfig.js";
import { onAuthStateChanged } from "firebase/auth";

import {
  loginUser,
  signupUser,
  authErrorMessage,
  logoutUser,
  onAuthReady,
} from "./authentication.js";

async function showMember() {
  const search = doc.querySelector("#members-go-here");
  const dataList = doc.querySelector("#members-list");
  const SearchTemplate = doc.querySelector("#ListTemplate");
  if (search.textContent == null) {
    const usersRef = doc(db, "users", uid);
    const usersList = await getDoc(usersRef);
  }
  if (user) {
    const currentUser = user.uid;
  } else {
    logoutUser({ redirectTo: "index.html" });
  }
}
