import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../js/firebase-config.js";
import { logoutUser } from "../js/authentication.js";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "../styles/style.css";

class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.renderFooter();
    this.renderAuthControls();
  }
  renderFooter() {
    this.innerHTML = `    <footer class="bg-light border-top py-4">
      <div class="container">
        <!-- links -->
        <nav class="mb-3">
          <ul class="nav flex-column align-items-center gap-2 fs-5">
            <li class="nav-item">
              <a class="nav-link text-body" href="index.html">Home</a>
            </li>
            <li class="nav-item">
              <a class="nav-link text-body" href="main.html">Dashboard</a>
            </li>
            <li class="nav-item">
              <a class="nav-link text-body" href="profile.html">Account</a>
            </li>
            <li class="nav-item">
              <a class="nav-link text-body" href="#about">About</a>
            </li>
            <li class="nav-item">
              <a class="nav-link text-body" href="#support">Support</a>
            </li>
            <li class="nav-item" id="authControls">
            </li>
          </ul>
        </nav>

        <!-- brand logo -->
        <div class="d-flex flex-column align-items-center text-center">
          <div class="d-flex flex-column align-items-center text-center">
            <a
              href="index.html"
              class="d-flex align-items-center mb-2 text-decoration-none text-dark"
            >
              <img
                src="images/logo.png"
                width="35"
                height="35"
                alt="PeerLink Logo"
                class="me-2"
              />
              <span class="fs-3 fw-bold">PeerLink</span>
            </a>
          </div>

          <div class="text-body-tertiary small mb-3 text-center">
            Let's break the ice and make new friends!
          </div>

          <!-- socials -->
          <div
            class="d-flex align-items-center justify-content-center gap-4 mb-1"
          >
            <a
              href="https://www.instagram.com/"
              class="opacity-75 hover-opacity-100"
            >
              <img
                src="images/instagram.png"
                width="25"
                height="25"
                alt="Instagram"
              />
            </a>
            <a
              href="https://www.facebook.com/"
              class="opacity-75 hover-opacity-100"
            >
              <img
                src="images/communication.png"
                width="25"
                height="25"
                alt="Chat"
              />
            </a>
            <a href="https://discord.com/" class="opacity-75 hover-opacity-100">
              <img
                src="images/discord.png"
                width="25"
                height="25"
                alt="Discord"
              />
            </a>
          </div>

          <div class="text-body-tertiary small mt-2 text-center">© 2025 PeerLink</div>
        </div>
      </div>
    </footer>`;
  }

  renderAuthControls() {
    const authControls = this.querySelector("#authControls");
    if (!authControls) return;

    onAuthStateChanged(auth, (user) => {
      if (user) {
        authControls.innerHTML = `
            <a class="nav-link link-dark" id="signOutBtn" href="index.html">
              Log Out
            </a>`;
        authControls
          .querySelector("#signOutBtn")
          ?.addEventListener("click", logoutUser);
      } else {
        authControls.innerHTML = `
            <a class="nav-link link-dark" id="loginBtn" href="login.html">Log In</a>`;
      }
    });
  }
}

customElements.define("site-footer", SiteFooter);
