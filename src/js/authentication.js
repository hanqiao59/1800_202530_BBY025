import { auth, db } from "./firebase-config.js";

// Import specific functions from the Firebase Auth SDK
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import { doc, setDoc } from "firebase/firestore";

// Log in an existing user
export async function loginUser(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Sign up a new user and create a Firestore document for them
export async function signupUser(name, email, password) {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  const user = userCredential.user;
  await updateProfile(user, { displayName: name });

  try {
    await setDoc(doc(db, "users", user.uid), {
      name: name,
      email: email,
    });
    console.log("Firestore user document created successfully!");
  } catch (error) {
    console.error("Error creating user document in Firestore:", error);
  }

  return user;
}

// Logout the current user
export async function logoutUser() {
  await signOut(auth);
  window.location.href = "index.html";
}

// Check authentication state and redirect if necessary
export function checkAuthState() {
  onAuthStateChanged(auth, (user) => {
    if (window.location.pathname.endsWith("main.html")) {
      if (user) {
      } else {
        window.location.replace("index.html");
      }
    }
  });
}

// Listen for authentication state changes
export function onAuthReady(callback) {
  return onAuthStateChanged(auth, callback);
}

// Map Firebase Auth error codes to user-friendly messages
export function authErrorMessage(error) {
  const code = (error?.code || "").toLowerCase();

  const map = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/email-already-in-use": "Email is already in use.",
    "auth/weak-password": "Password too weak (min 6 characters).",
    "auth/missing-password": "Password cannot be empty.",
    "auth/network-request-failed": "Network error. Try again.",
  };

  return map[code] || "Something went wrong. Please try again.";
}
