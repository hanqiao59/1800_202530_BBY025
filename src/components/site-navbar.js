import { auth } from "/src/firebaseConfig.js";
import { logoutUser } from "/src/authentication.js";

class SiteNavbar extends HTMLElement {
  connectedCallback() {
    this.renderNavbar();
    this.renderAuthControls();
  }

  renderNavbar() {}

  renderAuthControls() {}
}

customElements.define("site-navbar", SiteNavBar);
