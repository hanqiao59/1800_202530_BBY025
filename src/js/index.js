import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase-config.js";

onAuthStateChanged(auth, (user) => {
  if (user) {
    // Already logged in → skip index page
    window.location.replace("/main.html");
  }
});
