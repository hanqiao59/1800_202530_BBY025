import { onAuthStateChanged } from "firebase/auth";
import { auth } from "/src/firebaseConfig.js";
import { logoutUser } from "/src/authentication.js";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "/src/styles/style.css";

class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.renderFooter();
    this.renderAuthControls();
  }
  renderFooter() {
    this.innerHTML = `
            <footer class=" p-3 text-center">
              <div class="d-block p-3 opacity-75 fs-5">
              <div><a class="link-light link-underline link-underline-opacity-0" href="index.html">Home</a></div>
              <br />
              <div id="authControls"></div>
              <br />
              <div><a class="link-light link-underline link-underline-opacity-0" href="main.html">Channel</a></div>
              <br />
              <div><a class="link-light link-underline link-underline-opacity-0" href="account.html">Account</a></div>
              <br />
              <div><a class="link-light link-underline link-underline-opacity-0" href="#about">About</a></div>
              <br />
              <div><a class="link-light link-underline link-underline-opacity-0" href="#support">Support</a></div>
              </div>
              <br />
              <div
                  class="flex-column container text-center mx-auto p-1 postion-relative"
                  style="width: 200px"
             >
              <div class="d-flex p-2">
                  <img src="images/logo.png" width="35" height="35" />
                  <div class="fs-3 px-2 fw-bold">PeerLink</div>
              </div>

              <div
                  class="opacity-50 text-nowrap translate-middle-x fs-6 ms-3 px-2"
              >
              Helps you break the ice and make new friends!
              </div>
              <span
                  class="d-flex flex-row mb-2 opacity-50 align-items-center text-center mx-auto px-3 py-2"
              >
                  <img
                      src="images/instagram.png"
                      width="25"
                      height="25"
                      class="flex-grow-3 ms-1"
                  />
                  <img
                      src="images/communication.png"
                      width="25"
                      height="25"
                      class="flex-grow-3 ms-5"
                  />
                  <img
                      src="images/discord.png"
                      width="25"
                      height="25"
                      class="flex-grow-3 ms-5"
                  />
             </span>
             </div>
           </footer> `;
  }

  renderAuthControls() {
    const authControls = this.querySelector("#authControls");
    if (!authControls) return;

    onAuthStateChanged(auth, (user) => {
      if (user) {
        authControls.innerHTML = `
            <a class="link-light link-underline link-underline-opacity-0" id="signOutBtn" href="index.html">
              Log Out
            </a>`;
        authControls
          .querySelector("#signOutBtn")
          ?.addEventListener("click", logoutUser);
      } else {
        authControls.innerHTML = `
            <a class="link-light link-underline link-underline-opacity-0" id="loginBtn" href="login.html">Log In</a>`;
      }
    });
  }
}

customElements.define("site-footer", SiteFooter);
