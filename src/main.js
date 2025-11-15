// src/main.js
import { auth, db } from "/src/firebaseConfig.js";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

/* ========== Bootstrap Tooltips ========== */
document.addEventListener("DOMContentLoaded", () => {
  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  [...tooltipTriggerList].forEach((el) => new bootstrap.Tooltip(el));
});

/* ========== Dashboard Greeting ========== */
(async function showDashboard() {
  const nameEl = document.getElementById("userName");
  const avatarEl = document.getElementById("userAvatar");
  if (!nameEl) return;

  try {
    const { onAuthReady } = await import("./authentication.js");
    onAuthReady((user) => {
      if (!user) {
        location.href = "login.html";
        return;
      }
      const name = user.displayName || user.email;
      nameEl.textContent = `${name}!`;
      if (!avatarEl) {
        return (innerHTML = "${name.charAt(0).toUpperCase()}");
      } else if (user.photoURL) {
        avatarEl.src = user.photoURL;
      } else {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
          name
        )}&background=6c757d&color=ffffff&size=128&rounded=true`;
      }
    });
  } catch (err) {
    console.warn("[auth] authentication.js Failed:", err);
  }
})();

/* ========== Join Channel Modal ========== */
const modalEl = document.getElementById("joinChannelModal");

// Clear the input when the modal is closed
modalEl?.addEventListener("hidden.bs.modal", () => {
  const input = document.getElementById("inviteLink");
  if (input) input.value = "";
});

// Handle the Paste button (reads from clipboard)
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
const inviteInput = document.getElementById("inviteLink");
const joinSubmitBtn = joinForm?.querySelector('button[type="submit"]');

// Disable the default form submission behavior
joinForm?.addEventListener("submit", (e) => e.preventDefault());
// Change the submit button to a regular button so it won't trigger the form
joinSubmitBtn?.setAttribute("type", "button");

// Extract the channel ID from a full link or raw ID string
function extractChannelId(value) {
  if (!value) return null;
  const raw = value.trim();

  // Try parsing as a full URL first
  try {
    const u = new URL(raw, window.location.href);
    const id = u.searchParams.get("id");
    if (id) return id.trim();
  } catch {
    // Not a full URL, continue below
  }

  // Accept a plain Firestore document ID as fallback
  if (/^[A-Za-z0-9_-]{10,40}$/.test(raw)) return raw;

  return null;
}

// Handle the "Join Link" button click
joinSubmitBtn?.addEventListener("click", () => {
  // Use built-in browser validation for the URL field
  if (!joinForm.checkValidity()) {
    joinForm.reportValidity();
    return;
  }

  const id = extractChannelId(inviteInput?.value || "");

  if (!id) {
    alert("Invalid invite link. Please paste a link that contains ?id=...");
    inviteInput?.focus();
    return;
  }

  // Build an absolute URL so it always includes the ?id parameter
  const targetHref = `${
    window.location.origin
  }/channel-preview.html?id=${encodeURIComponent(id)}`;

  // Navigate to the preview page
  window.location.assign(targetHref);
});

/* ========== Create Channel Modal ========== */
const createModalEl = document.getElementById("createChannelModal");
const form = document.getElementById("createChannelForm");
const nameInput = document.getElementById("channelName");
const submitBtn = document.getElementById("createChannelSubmit");
const errEl = document.getElementById("createChannelError");

const step1 = document.getElementById("createChannelStep1");
const step2 = document.getElementById("createChannelStep2");
const inviteLinkOutput = document.getElementById("inviteLinkOutput");
const copyBtn = document.getElementById("copyLinkBtn");

let createdChannelId = null;

// Reset everything when modal is closed
createModalEl?.addEventListener("hidden.bs.modal", () => {
  form.reset();
  errEl.classList.add("d-none");
  step1.classList.remove("d-none");
  step2.classList.add("d-none");
  submitBtn.removeAttribute("disabled");
});

// Handle Create
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();

  if (!name) {
    errEl.textContent = "Channel name is required.";
    errEl.classList.remove("d-none");
    return;
  }

  submitBtn.setAttribute("disabled", "true");
  errEl.classList.add("d-none");

  try {
    // get current user
    let uid = null;
    await new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        uid = user?.uid || null;
        unsub();
        resolve();
      });
    });

    // add to Firestore
    const docRef = await addDoc(collection(db, "channels"), {
      name,
      createdAt: serverTimestamp(),
      createdBy: uid,
    });

    createdChannelId = docRef.id;

    // Generate invite link
    const link = new URL(
      `channel-preview.html?id=${createdChannelId}`,
      window.location.href
    ).href;
    inviteLinkOutput.value = link;

    // Show Step 2
    step1.classList.add("d-none");
    step2.classList.remove("d-none");
  } catch (err) {
    console.error(err);
    errEl.textContent = err.message || "Failed to create channel.";
    errEl.classList.remove("d-none");
  } finally {
    submitBtn.removeAttribute("disabled");
  }
});

// Copy link to clipboard
copyBtn?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(inviteLinkOutput.value);
    copyBtn.innerHTML = '<i class="bi bi-clipboard-check"></i>';
    setTimeout(
      () => (copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>'),
      1500
    );
  } catch {
    alert("Failed to copy link.");
  }
});

/* ========== Hosted channel banner ========== */
function showHostedChannel() {
  const banner = document.getElementById("hostedChannelBanner");
  const nameEl = document.getElementById("hostedChannelName");
  const linkEl = document.getElementById("hostedChannelLink");

  if (!banner || !nameEl || !linkEl) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      banner.classList.add("d-none");
      return;
    }

    try {
      // Look for channels where current user is the creator
      const q = query(
        collection(db, "channels"),
        where("createdBy", "==", user.uid),
        limit(1)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        // If not hosting any channel → hide banner
        banner.classList.add("d-none");
        return;
      }

      const docSnap = snap.docs[0];
      const data = docSnap.data();

      nameEl.textContent = data.name || "Untitled Channel";

      // Build link to channel-preview.html?id=...
      const url = new URL("channel-preview.html", window.location.href);
      url.searchParams.set("id", docSnap.id);
      linkEl.href = url.href;

      banner.classList.remove("d-none");
    } catch (err) {
      console.error("[dashboard] Failed to load hosted channel:", err);
      banner.classList.add("d-none");
    }
  });
}

showHostedChannel();
