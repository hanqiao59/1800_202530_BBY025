import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import { onAuthReady } from "./authentication.js";

const menuBtn = document.getElementById("menuBtn");
const drawer = document.getElementById("drawer");
const panel = drawer.querySelector(".drawer-panel");

function openMenu() {
  document.body.classList.add("menu-open");
  menuBtn.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  document.body.classList.remove("menu-open");
  menuBtn.setAttribute("aria-expanded", "false");
}

menuBtn.addEventListener("click", () => {
  document.body.classList.contains("menu-open") ? closeMenu() : openMenu();
});

drawer.addEventListener("click", (e) => {
  if (!panel.contains(e.target)) closeMenu();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

function showDashboard() {
  const nameElement = document.getElementById("name-goes-here"); // the <h1> element to display "Hello, {name}"

  // Wait for Firebase to determine the current authentication state.
  // onAuthReady() runs the callback once Firebase finishes checking the signed-in user.
  // The user's name is extracted from the Firebase Authentication object
  // You can "go to console" to check out current users.
  onAuthReady((user) => {
    if (!user) {
      // If no user is signed in → redirect back to login page.
      location.href = "index.html";
      return;
    }

    // If a user is logged in:
    // Use their display name if available, otherwise show their email.
    const name = user.displayName || user.email;

    // Update the welcome message with their name/email.
    if (nameElement) {
      nameElement.textContent = `${name}!`;
    }
  });
}

showDashboard();
