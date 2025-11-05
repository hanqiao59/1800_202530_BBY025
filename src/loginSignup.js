// src/auth-ui.js
// -------------------------------------------------------------
// Handles all authentication-related UI features:
// 1) Drawer: dynamic Log In / Log Out button (based on Firebase Auth state)
// 2) Login / Signup page: form toggling, validation, submission
// -------------------------------------------------------------
import { auth } from "/src/firebaseConfig.js";
import { onAuthStateChanged } from "firebase/auth";

import {
  loginUser,
  signupUser,
  authErrorMessage,
  logoutUser,
  onAuthReady,
} from "./authentication.js";

/* ============================================================
   1) Drawer Section: Log In / Log Out button toggle
   ============================================================ */
function initAuthControls(root = document) {
  const host = root.querySelector("#authControls");
  if (!host) return; // No placeholder found → skip

  onAuthStateChanged(auth, (user) => {
    if (user) {
      // When logged in → show "LOG OUT" button
      host.innerHTML = `
        <button class="nav-link btn btn-link text-body-tertiary p-0"
                id="signOutBtn" type="button">
          LOG OUT
        </button>`;

      host.querySelector("#signOutBtn")?.addEventListener("click", () => {
        // Optional redirect after sign out
        logoutUser({ redirectTo: "index.html" });
      });
    } else {
      // When logged out → show "LOG IN" link
      host.innerHTML = `
        <a class="nav-link text-body-tertiary" id="loginBtn" href="login.html">
          LOG IN
        </a>`;
    }
  });
}

/* ============================================================
   2) Login / Signup Page Section
   ============================================================ */
function initLoginSignup() {
  // Detect whether this is a login/signup page by checking for these elements
  const alertEl = document.getElementById("authAlert");
  const loginView = document.getElementById("loginView");
  const signupView = document.getElementById("signupView");
  const toSignupBtn = document.getElementById("toSignup");
  const toLoginBtn = document.getElementById("toLogin");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const REDIRECT_URL = "main.html";

  // If none of these elements exist → not a login/signup page
  if (!loginForm && !signupForm && !loginView && !signupView) return;

  // Redirect immediately if the user is already logged in
  onAuthReady((user) => {
    if (user) location.replace(REDIRECT_URL);
  });

  // ----- Helper functions -----
  const setVisible = (el, visible) => el?.classList.toggle("d-none", !visible);

  let errorTimeout;
  const showError = (msg) => {
    if (!alertEl) return;
    alertEl.textContent = msg || "";
    alertEl.classList.remove("d-none");
    clearTimeout(errorTimeout);
    errorTimeout = setTimeout(hideError, 5000); // Auto-hide after 5s
  };

  const hideError = () => {
    if (!alertEl) return;
    alertEl.classList.add("d-none");
    alertEl.textContent = "";
    clearTimeout(errorTimeout);
  };

  const setSubmitDisabled = (form, disabled) => {
    const btn = form?.querySelector('[type="submit"]');
    if (btn) btn.disabled = !!disabled;
  };

  // ----- Toggle between Login and Signup views -----
  toSignupBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    hideError();
    setVisible(loginView, false);
    setVisible(signupView, true);
    signupView?.querySelector("input")?.focus();
  });

  toLoginBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    hideError();
    setVisible(signupView, false);
    setVisible(loginView, true);
    loginView?.querySelector("input")?.focus();
  });

  // ----- Handle Login form submission -----
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const email = document.querySelector("#loginEmail")?.value?.trim() ?? "";
    const password = document.querySelector("#loginPassword")?.value ?? "";

    if (!email || !password) {
      showError("Please enter your email and password.");
      return;
    }

    setSubmitDisabled(loginForm, true);
    try {
      await loginUser(email, password);
      location.replace(REDIRECT_URL); // Prevent back navigation to login page
    } catch (err) {
      console.error(err);
      showError(authErrorMessage(err));
    } finally {
      setSubmitDisabled(loginForm, false);
    }
  });

  // ----- Handle Signup form submission -----
  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const name = document.querySelector("#signupName")?.value?.trim() ?? "";
    const email = document.querySelector("#signupEmail")?.value?.trim() ?? "";
    const password = document.querySelector("#signupPassword")?.value ?? "";

    if (!name || !email || !password) {
      showError("Please fill in name, email, and password.");
      return;
    }

    setSubmitDisabled(signupForm, true);
    try {
      await signupUser(name, email, password);
      location.replace(REDIRECT_URL);
    } catch (err) {
      console.error(err);
      showError(authErrorMessage(err));
    } finally {
      setSubmitDisabled(signupForm, false);
    }
  });
}

/* ============================================================
   Auto-initialize both features when DOM is ready
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initAuthControls(document); // Drawer login/logout toggle
  initLoginSignup(); // Login/signup form handling
});
