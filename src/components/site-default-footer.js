import { onAuthStateChanged } from "firebase/auth";
import { auth } from "/src/firebaseConfig.js";
import { logoutUser } from "/src/authentication.js";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "/src/styles/style.css";

class DefaultFooter extends HTMLElement {
  connectedCallback() {
    this.renderFooter();
    this.renderAuthControls();
  }
  renderFooter() {
    this.innerHTML = `
            <footer class="container-fluid bg-dark text-light py-4 text-center">
                <div class="row row-cols-auto justify-content-center gap-5 my-1">
                  <div class="col">
                    <a class="text-light text-opacity-50 link-light link-underline-opacity-0" href="index.html">PeerLink</a>
                  </div>
                  <div class="col">
                    <a class="text-light text-opacity-50 link-light link-underline-opacity-0" href="main.html">Homepage</a>
                  </div>
                  <div class="col">
                    <a class="text-light text-opacity-50 link-light link-underline-opacity-0" href="#about">About Us</a>
                  </div>
                  <div class="col">
                    <a class="text-light text-opacity-50 link-light link-underline-opacity-0" href="account.html">Account</a>
                  </div>
                  <div class="col">
                    <a class="text-light text-opacity-50 link-light link-underline-opacity-0" href="#support">Support</a>
                  </div>
                  <div class="col" id="authControls">
                  </div>
                </div>
                <div class="row row-cols-auto my-4 justify-content-center gap-3">
                  <div class="col">
                    <a class="icon-link icon-link-hover" style="--bs-icon-link-transform: matrix(1.5, 0, 0, 1.5, 0, -10);" href="index.html">
                      <i class="bi bi-ice-cubes"><img src="/images/logo.png" width="19px" height="19px" style="filter: grayscale(); opacity: 75%;" /></i>
                    </a>
                  </div>
                  <div class="col">
                    <a class="icon-link icon-link-hover opacity-50" style="--bs-icon-link-transform: matrix(1.5, 0, 0, 1.5, 0, -10);" href="#twitter-acc"><i class="bi bi-twitter" style="cornflowerblue"></i></a>
                  </div>
                  <div class="col">
                    <a class="icon-link icon-link-hover opacity-50" style="--bs-icon-link-transform: matrix(1.5, 0, 0, 1.5, 0, -10);" href="#discord-group"><i class="bi bi-discord" style="color: blue"></i></a>
                  </div>
                  <div class="col">
                    <a class="icon-link icon-link-hover opacity-50" style="--bs-icon-link-transform: matrix(1.5, 0, 0, 1.5, 0, -10);" href="#instagram-acc">
                      <i class="bi bi-instagram" style="color:rgba(255, 255, 255, 1)"></i>
                    </a>
                  </div>
                  <div class="col">
                    <a class="icon-link icon-link-hover opacity-50" style="--bs-icon-link-transform: matrix(1.5, 0, 0, 1.5, 0, -10);" href="#git-hub"><i class="bi bi-github" style="color: white"></i></a>
                  </div>
                </div>
                <div class="row">
                  <div class="text-light text-opacity-50"><i class="bi bi-c-circle"></i> 2025 PeerLink, made with <i class="bi bi-heart-fill" style="color: red"></i> by Team Zero.</div>
                </div>
            </footer> `;
  }

  renderAuthControls() {
    const authControls = this.querySelector("#authControls");
    if (!authControls) return;

    onAuthStateChanged(auth, (user) => {
      if (user) {
        authControls.innerHTML = `
            <a class="text-light text-opacity-50 link-light link-underline link-underline-opacity-0" id="signOutBtn" href="index.html">
              Log Out
            </a>`;
        authControls
          .querySelector("#signOutBtn")
          ?.addEventListener("click", logoutUser);
      } else {
        authControls.innerHTML = `
            <a class="text-light text-opacity-50 link-light link-underline link-underline-opacity-0" id="loginBtn" href="login.html">Log In</a>`;
      }
    });
  }
}

customElements.define("site-default-footer", DefaultFooter);
