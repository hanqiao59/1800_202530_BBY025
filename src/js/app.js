import "bootstrap";
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

// Toggle menu on button click
menuBtn?.addEventListener("click", () => {
  document.body.classList.contains("menu-open") ? closeMenu() : openMenu();
});

// Close menu when clicking outside the panel
drawer?.addEventListener("click", (e) => {
  if (panel && !panel.contains(e.target)) closeMenu();
});

// Close menu on Escape key press
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});
