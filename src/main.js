import { auth, db } from "/src/firebaseConfig.js";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
  orderBy,
} from "firebase/firestore";

import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

/* ========== Bootstrap Tooltips ========== */
document.addEventListener("DOMContentLoaded", () => {
  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  [...tooltipTriggerList].forEach((el) => new bootstrap.Tooltip(el));
});

/* ========== Helper: decorate tags with emojis ========== */
function decorateTagLabel(tag) {
  const s = String(tag).toLowerCase();
  if (s.includes("gaming")) return "🎮 " + tag;
  if (s.includes("tech") || s.includes("code")) return "💻 " + tag;
  if (s.includes("traveling")) return "✈️ " + tag;
  return tag;
}

/* ========== Dashboard Greeting + Stats + Sessions List ========== */
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

      const name = user.displayName || user.email || "User";
      nameEl.textContent = `${name}!`;

      // Avatar
      if (avatarEl) {
        if (user.photoURL) {
          avatarEl.src = user.photoURL;
        } else {
          avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
            name
          )}&background=transparent&color=ffffff&size=128&rounded=true`;
        }
      }

      // Stats: how many activities this user has joined
      loadUserStats(user).catch(console.error);

      // Session cards: show ALL joined sessions stacked in one section
      showAllSessionsForUser(user).catch(console.error);
    });
  } catch (err) {
    console.warn("[auth] authentication.js Failed:", err);
  }
})();

/* ========== Hosted channel banner ========== */
async function showHostedChannel() {
  const container = document.getElementById("hostedChannelContainer");
  const template = document.getElementById("hostedChannelBanner");
  if (!container || !template) return;

  const { onAuthReady } = await import("./authentication.js");

  onAuthReady(async (user) => {
    // clear previous items
    [...container.querySelectorAll(".hosted-channel-item")].forEach((el) =>
      el.remove()
    );

    if (!user) {
      container.classList.add("d-none");
      return;
    }

    try {
      // Find all channels you created
      const chQ = query(
        collection(db, "channels"),
        where("createdBy", "==", user.uid)
      );
      const chSnap = await getDocs(chQ);

      if (chSnap.empty) {
        container.classList.add("d-none");
        return;
      }

      const items = [];

      // Check the latest session of each channel one by one
      for (const chDoc of chSnap.docs) {
        const chData = chDoc.data();
        const chId = chDoc.id;

        const sessionsRef = collection(db, "channels", chId, "sessions");
        const sQ = query(sessionsRef, orderBy("createdAt", "desc"), limit(1));
        const sSnap = await getDocs(sQ);

        // No sessions: treat as an available channel to display
        if (sSnap.empty) {
          items.push({ id: chId, name: chData.name || "Untitled Channel" });
          continue;
        }

        // For channels with sessions: only show if the latest one is not ended
        const last = sSnap.docs[0];
        const status = (last.data().status || "active").toLowerCase();

        if (status === "end") {
          continue;
        }

        items.push({ id: chId, name: chData.name || "Untitled Channel" });
      }

      if (!items.length) {
        container.classList.add("d-none");
        return;
      }

      // At least one item to show → clone the template
      container.classList.remove("d-none");

      items.forEach((item) => {
        const clone = template.cloneNode(true);
        clone.id = ""; // Prevent duplicate id
        clone.classList.remove("d-none");
        clone.classList.add("hosted-channel-item");

        const nameEl = clone.querySelector(".hostedChannelName");
        const linkEl = clone.querySelector(".hostedChannelLink");

        if (nameEl) nameEl.textContent = item.name;

        if (linkEl) {
          const url = new URL("channel-preview.html", window.location.href);
          url.searchParams.set("id", item.id);
          linkEl.href = url.href;
        }

        container.appendChild(clone);
      });
    } catch (err) {
      console.error("[dashboard] Failed to load hosted channels:", err);
      container.classList.add("d-none");
    }
  });
}

showHostedChannel();

/* ========== Join Channel Modal ========== */
const modalEl = document.getElementById("joinChannelModal");

// Reset input when modal is closed
modalEl?.addEventListener("hidden.bs.modal", () => {
  const input = document.getElementById("inviteLink");
  if (input) input.value = "";
});

// Handle Paste button
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

// Join form & submit button
const joinForm = document.querySelector("#joinChannelModal form");
const inviteInput = document.getElementById("inviteLink");
const joinSubmitBtn = document.getElementById("joinSubmitBtn");

// Disable the default form submission behavior
joinForm?.addEventListener("submit", (e) => e.preventDefault());

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
const openChannelBtn = document.getElementById("openChannelBtn");

// Reset everything when modal is closed
createModalEl?.addEventListener("hidden.bs.modal", () => {
  form.reset();
  errEl.classList.add("d-none");
  step1.classList.remove("d-none");
  step2.classList.add("d-none");
  submitBtn.removeAttribute("disabled");

  // Reset the open-channel link as well
  if (openChannelBtn) {
    openChannelBtn.href = "#";
  }
});

// Handle Create Channel form submission
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Use built-in browser validation for the form
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  const name = nameInput.value.trim();

  // Disable button to prevent double-submits
  submitBtn.setAttribute("disabled", "true");
  errEl.classList.add("d-none");

  try {
    // Get current user ID
    const uid = auth.currentUser?.uid || null;

    if (!uid) {
      errEl.textContent = "You must be logged in to create a channel.";
      errEl.classList.remove("d-none");
      return;
    }

    // Add a new channel document to Firestore
    const docRef = await addDoc(collection(db, "channels"), {
      name,
      createdAt: serverTimestamp(),
      createdBy: uid,
    });

    // Generate invite link using the new document ID
    const link = new URL(
      `channel-preview.html?id=${docRef.id}`,
      window.location.href
    ).href;

    // Put the link into the readonly input
    inviteLinkOutput.value = link;

    // Set the "Open Channel" button link
    if (openChannelBtn) {
      openChannelBtn.href = link;
    }

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

// Handle Copy link button
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

/* ========== Session Cards (ALL joined sessions in one list) ========== */
async function showAllSessionsForUser(user) {
  const container = document.getElementById("recentSessionsContainer");
  const template = document.getElementById("recentSessionTemplate");
  if (!container || !template) return;

  // Clear previously generated cards (keep the template)
  container
    .querySelectorAll(".recent-session-card")
    .forEach((el) => el.remove());

  // loading indicator
  let loadingEl = container.querySelector(".recent-sessions-loading");
  if (!loadingEl) {
    loadingEl = document.createElement("div");
    loadingEl.className = "recent-sessions-loading text-muted small";
    loadingEl.textContent = "Loading your sessions...";
    container.appendChild(loadingEl);
  }

  try {
    //Read users/{uid}/joinedSessions, ordered by joinedAt descending
    const joinedRef = collection(db, "users", user.uid, "joinedSessions");
    const qJoined = query(joinedRef, orderBy("joinedAt", "desc"));
    const joinedSnap = await getDocs(qJoined);

    loadingEl.remove();

    if (joinedSnap.empty) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "text-muted small";
      emptyEl.textContent = "You have not joined any sessions yet.";
      container.appendChild(emptyEl);
      return;
    }

    // Create a card for each joined session
    for (const joinedDoc of joinedSnap.docs) {
      const data = joinedDoc.data();
      const channelId = data.channelId;
      const sessionId = data.sessionId;
      const joinedAt = data.joinedAt;

      if (!channelId || !sessionId) continue;

      const sessionRef = doc(db, "channels", channelId, "sessions", sessionId);
      const channelRef = doc(db, "channels", channelId);

      const [sessionSnap, channelSnap] = await Promise.all([
        getDoc(sessionRef),
        getDoc(channelRef),
      ]);

      if (!sessionSnap.exists() || !channelSnap.exists()) continue;

      const sessionData = sessionSnap.data();
      const channelData = channelSnap.data();

      const status = sessionData.status || "active";
      const channelName = channelData.name || "Channel";
      const tags = Array.isArray(sessionData.tags) ? sessionData.tags : [];

      // Build the session review URL with query parameters
      const url = new URL("ice-breaker-session.html", window.location.href);
      url.searchParams.set("channelId", channelId);
      url.searchParams.set("sessionId", sessionId);

      // clone template and fill data
      const card = template.cloneNode(true);
      card.id = ""; // Avoid duplicate id
      card.classList.remove("d-none");
      card.classList.add("recent-session-card");

      const nameEl = card.querySelector(".recent-session-name");
      const badgeEl = card.querySelector(".recent-session-badge");
      const textEl = card.querySelector(".recent-session-text");
      const tagsEl = card.querySelector(".recent-session-tags");
      const linkEl = card.querySelector(".recent-session-link");
      const btnEl = card.querySelector(".recent-session-button");

      if (nameEl) nameEl.textContent = channelName;

      if (badgeEl) {
        if (status === "active") {
          badgeEl.textContent = "Live";
          badgeEl.classList.remove("bg-secondary-subtle", "text-secondary");
          badgeEl.classList.add("bg-success-subtle", "text-success");
        } else {
          badgeEl.textContent = "Past";
          badgeEl.classList.remove("bg-success-subtle", "text-success");
          badgeEl.classList.add("bg-secondary-subtle", "text-secondary");
        }
      }

      if (textEl) {
        if (status === "active") {
          textEl.textContent =
            "You recently joined this session. You can jump back in at any time.";
        } else {
          textEl.textContent =
            "This session has ended. You can still review the session.";
        }
      }

      if (tagsEl) {
        tagsEl.innerHTML = "";
        if (tags.length) {
          tags.slice(0, 3).forEach((t) => {
            const span = document.createElement("span");
            span.className =
              "badge rounded-2 text-dark me-2 fw-semibold px-2 py-2 bg-light";
            span.textContent = decorateTagLabel(t);
            tagsEl.appendChild(span);
          });
        }
      }

      if (linkEl) {
        linkEl.href = url.href;
      }
      if (btnEl) {
        btnEl.textContent =
          status === "active" ? "Rejoin Session" : "View Session";
      }

      container.appendChild(card);
    }
  } catch (err) {
    console.error("[dashboard] Failed to load sessions:", err);
    loadingEl.textContent = "Failed to load your sessions.";
  }
}

/* ========== Stats: Activities joined ========== */
async function loadUserStats(user) {
  const joinedEl = document.getElementById("statActivitiesJoined");
  if (!joinedEl) return;

  try {
    const joinedRef = collection(db, "users", user.uid, "joinedSessions");
    const snap = await getDocs(joinedRef);

    joinedEl.textContent = String(snap.size);
  } catch (err) {
    console.error("[dashboard] Failed to load user stats:", err);
    joinedEl.textContent = "–";
  }
}
