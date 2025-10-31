import { onAuthStateChanged } from "firebase/auth";

import { auth } from "/src/firebaseConfig.js";
import { logoutUser } from "/src/authentication.js";

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
        class="d-flex justify-content-between align-items-center p-3 border-bottom bg-white position-fixed top-0 w-100"
      >
        <div class="brand d-flex align-items-center gap-2">
          <img
            src="./images/logo.png"
            alt="PeerLink Logo"
            width="32"
            height="32"
          />
          <span class="fw-semibold fs-5">PeerLink</span>
        </div>
        <button
          class="btn border-0 position-relative"
          id="menuBtn"
          aria-label="Open menu"
          aria-expanded="false"
        >
          <span class="icon-wrap d-inline-block" aria-hidden="true">
            <i class="bi bi-list icon-hamburger"></i>
            <i class="bi bi-x-lg icon-close"></i>
          </span>
        </button>
      </div>
    </header>

    <!-- Drawer -->
    <div id="drawer" class="drawer position-fixed top-0 start-0 w-100 h-100">
      <div
        class="drawer-panel ms-auto h-100 d-flex flex-column justify-content-between p-4 shadow"
      >
        <div>
          <ul class="nav flex-column fs-5 fw-semibold">
            <li class="nav-item">
              <a href="#home" class="nav-link text-dark">HOME</a>
            </li>
            <li class="nav-item">
              <a href="#login" class="nav-link text-dark">LOG IN</a>
            </li>
            <li class="nav-item">
              <a href="#channel" class="nav-link text-dark">CHANNEL</a>
            </li>
            <li class="nav-item">
              <a href="#account" class="nav-link text-dark">ACCOUNT</a>
            </li>
            <li class="nav-item">
              <a href="#about" class="nav-link text-dark">ABOUT</a>
            </li>
            <li class="nav-item">
              <a href="#support" class="nav-link text-dark">SUPPORT</a>
            </li>
          </ul>
        </div>

        <div id="authControls" class="auth-controls d-flex align-items-center gap-2 my-2 my-lg-0"></div>
        <div class="d-flex gap-3 fs-4">
          <a href="#instagram" class="text-dark" title="Instagram"
            ><i class="bi bi-instagram"></i
          ></a>
          <a href="#facebook" class="text-dark" title="Facebook"
            ><i class="bi bi-facebook"></i
          ></a>
          <a href="#discord" class="text-dark" title="Discord"
            ><i class="bi bi-discord"></i
          ></a>
        </div>
      </div>
    </div>
        `;
  }

  renderAuthControls() {
    const authControls = this.querySelector("#authControls");

    // Initialize with invisible placeholder to maintain layout space
    authControls.innerHTML = `<div class="btn btn-outline-light" style="visibility: hidden; min-width: 80px;">Log out</div>`;

    onAuthStateChanged(auth, (user) => {
      let updatedAuthControl;
      if (user) {
        updatedAuthControl = `<button class="btn btn-outline-light" id="signOutBtn" type="button" style="min-width: 80px;">Log out</button>`;
        authControls.innerHTML = updatedAuthControl;
        const signOutBtn = authControls.querySelector("#signOutBtn");
        signOutBtn?.addEventListener("click", logoutUser);
      } else {
        updatedAuthControl = `<a class="btn btn-outline-light" id="loginBtn" href="/index.html" style="min-width: 80px;">Log in</a>`;
        authControls.innerHTML = updatedAuthControl;
      }
    });
  }
}

customElements.define("site-navbar", SiteNavbar);
