// src/app.js
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "/src/styles/style.css";

/* ========== Menu Drawer ========== */
const menuBtn = document.getElementById("menuBtn");
const drawer = document.getElementById("drawer");
const panel = drawer?.querySelector(".drawer-panel");

function openMenu() {
  document.body.classList.add("menu-open");
}
function closeMenu() {
  document.body.classList.remove("menu-open");
}

menuBtn?.addEventListener("click", () => {
  document.body.classList.contains("menu-open") ? closeMenu() : openMenu();
});

drawer?.addEventListener("click", (e) => {
  if (panel && !panel.contains(e.target)) closeMenu();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});
