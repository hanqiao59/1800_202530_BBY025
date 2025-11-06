// site-navbar.js
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "/src/firebaseConfig.js";
import { logoutUser } from "/src/authentication.js";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "/src/styles/style.css";

class SiteNavbar extends HTMLElement {
  connectedCallback() {
    this.renderNavbar();
    this.renderAuthControls();
  }

  renderNavbar() {
    this.innerHTML = `
      <!------------------------------>
      <!-- Header -->
      <header>
        <div
          id="topbar"
          class="d-flex justify-content-between align-items-center p-3 border-bottom position-fixed top-0 w-100"
        >
          <a
            href="index.html"
            class="brand d-flex align-items-center gap-2 text-decoration-none text-dark"
          >
            <img src="./images/logo.png" alt="PeerLink Logo" width="32" height="32" />
            <span class="fw-semibold fs-5">PeerLink</span>
          </a>

          <button class="btn border-0 position-relative" id="menuBtn">
            <span class="icon-wrap d-inline-block">
              <i class="bi bi-list icon-hamburger"></i>
              <i class="bi bi-x-lg icon-close"></i>
            </span>
          </button>
        </div>
      </header>

      <!-- Drawer -->
      <div id="drawer" class="drawer position-fixed top-0 start-0 w-100 h-100">
        <div
          class="drawer-panel ms-auto h-100 d-flex flex-column justify-content-between p-4 shadow bg-light"
        >
          <nav>
            <ul class="nav flex-column fs-5 fw-semibold">
              <li class="nav-item">
                <a href="index.html" class="nav-link text-body-tertiary">HOME</a>
              </li>
              <li class="nav-item">
                <a href="main.html" class="nav-link text-body-tertiary">CHANNEL</a>
              </li>
              <li class="nav-item">
                <a href="account.html" class="nav-link text-body-tertiary">ACCOUNT</a>
              </li>
              <li class="nav-item">
                <a href="#about" class="nav-link text-body-tertiary">ABOUT</a>
              </li>
              <li class="nav-item">
                <a href="#support" class="nav-link text-body-tertiary">SUPPORT</a>
              </li>
              <li class="nav-item" id="authControls"></li>
            </ul>
          </nav>

          <div class="d-flex gap-3 fs-4 mt-3">
            <a href="#instagram" class="text-black" title="Instagram"><i class="bi bi-instagram"></i></a>
            <a href="#facebook" class="text-dark" title="Facebook"><i class="bi bi-facebook"></i></a>
            <a href="#discord" class="text-dark" title="Discord"><i class="bi bi-discord"></i></a>
          </div>
        </div>
      </div>
    `;
  }

  renderAuthControls() {
    const authControls = this.querySelector("#authControls");
    if (!authControls) return;

    onAuthStateChanged(auth, (user) => {
      if (user) {
        authControls.innerHTML = `
          <button class="nav-link btn btn-link text-body-tertiary p-0" id="signOutBtn" type="button">
            LOG OUT
          </button>`;
        authControls
          .querySelector("#signOutBtn")
          ?.addEventListener("click", logoutUser);
      } else {
        authControls.innerHTML = `
          <a class="nav-link text-body-tertiary" id="loginBtn" href="login.html">LOG IN</a>`;
      }
    });
  }
}

customElements.define("site-navbar", SiteNavbar);
