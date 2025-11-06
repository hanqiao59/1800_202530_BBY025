import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "/src/styles/style.css";

class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
            <footer class=" p-3 text-center">
              <div class="d-block p-3 opacity-75 fs-5">
              <div>Home</div>
              <br />
              <div>Log In</div>
              <br />
              <div>Channel</div>
              <br />
              <div>Account</div>
              <br />
              <div>About</div>
              <br />
              <div>Support</div>
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
                  class="opacity-50 postion-absolute top-100 start-0 translate-middle text-center text-nowrap fs-6"
              >
              Lorem Ispum is simply dummy text of the printing and
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
}

customElements.define("site-footer", SiteFooter);
