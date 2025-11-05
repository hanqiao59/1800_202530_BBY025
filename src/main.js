// src/main.js
import * as bootstrap from "bootstrap";
/* ========== Bootstrap Tooltips ========== */
document.addEventListener("DOMContentLoaded", () => {
  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  [...tooltipTriggerList].forEach((el) => new bootstrap.Tooltip(el));
});

/* ========== Join Link Modal ========== */
const modalEl = document.getElementById("joinChannelModal");

modalEl?.addEventListener("hidden.bs.modal", () => {
  const input = document.getElementById("inviteLink");
  if (input) input.value = "";
});

document.getElementById("pasteBtn")?.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    const input = document.getElementById("inviteLink");
    if (text && input) {
      input.value = text.trim();
      input.focus();
    }
  } catch {
    console.warn("Clipboard read not allowed");
  }
});

const joinForm = document.querySelector("#joinChannelModal form");

joinForm?.addEventListener("submit", (e) => {
  if (!joinForm.checkValidity()) {
    e.preventDefault();
    joinForm.reportValidity();
    return;
  }
});

/* ========== Dashboard Greeting ========== */
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
    console.warn("[auth] authentication.js Failed:", err);
  }
})();

window.addEventListener("DOMContentLoaded", () => {
  document.body.removeAttribute("data-cloak");
});
