import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";

/* Menu Drawer Functionality */
const menuBtn = document.getElementById("menuBtn");
const drawer = document.getElementById("drawer");
const panel = drawer.querySelector(".drawer-panel");

function openMenu() {
  document.body.classList.add("menu-open");
}

function closeMenu() {
  document.body.classList.remove("menu-open");
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

/* Bootstrap Tooltips Initialization */
document.addEventListener("DOMContentLoaded", function () {
  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  [...tooltipTriggerList].forEach((el) => new bootstrap.Tooltip(el));
});

/* Join Link Modal */
const modalEl = document.getElementById("joinChannelModal");

// Clear the input when the modal is hidden
modalEl?.addEventListener("hidden.bs.modal", () => {
  const input = document.getElementById("inviteLink");
  if (input) input.value = "";
});

// Paste clipboard content into the input field when the "Paste" button is clicked
document.getElementById("pasteBtn")?.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    const input = document.getElementById("inviteLink");
    if (text) {
      input.value = text;
      input.focus();
    }
  } catch (e) {
    console.warn("Clipboard read not allowed");
  }
});

/* ===== Dashboard Greeting（动态导入 authentication.js） ===== */
(async function showDashboard() {
  const nameEl = document.getElementById("name-goes-here");
  if (!nameEl) return;

  try {
    const { onAuthReady } = await import("./authentication.js");

    onAuthReady((user) => {
      if (!user) {
        location.href = "index.html";
        return;
      }

      const name = user.displayName || user.email;
      nameEl.textContent = `${name}!`;
    });
  } catch (err) {
    console.warn("[auth] authentication.js 加载失败：", err);
  }
})();
