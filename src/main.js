import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";

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
