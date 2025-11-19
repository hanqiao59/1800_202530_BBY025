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
        )}&background=transparent&color=ffffff&size=128&rounded=true`;
      }
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
      // Find all channels you created (no longer limit(1))
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

// Reset input when modal is closed
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

/* ========== Recent Session Card ========== */
function decorateTagLabel(tag) {
  const s = String(tag).toLowerCase();
  if (s.includes("gaming")) return "🎮 " + tag;
  if (s.includes("tech") || s.includes("code")) return "💻 " + tag;
  if (s.includes("traveling")) return "✈️ " + tag;
  return tag;
}

async function showRecentSession() {
  const card = document.getElementById("recentSessionCard");
  const nameEl = document.getElementById("recentSessionChannelName");
  const linkEl = document.getElementById("recentSessionLink");
  const badgeEl = document.getElementById("recentSessionBadge");
  const textEl = document.getElementById("recentSessionText");
  const tagsEl = document.getElementById("recentSessionTags");
  const btnEl = document.getElementById("recentSessionButton");

  if (!card || !nameEl || !linkEl) return;

  try {
    const { onAuthReady } = await import("./authentication.js");

    onAuthReady(async (user) => {
      if (!user) {
        card.classList.add("d-none");
        return;
      }

      loadUserStats(user).catch(console.error);

      try {
        // read user document
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          card.classList.add("d-none");
          return;
        }

        const data = userSnap.data();
        const lastSession = data.lastSession;

        if (!lastSession || !lastSession.channelId || !lastSession.sessionId) {
          card.classList.add("d-none");
          return;
        }

        const { channelId, sessionId } = lastSession;

        // read session document
        const sessionRef = doc(
          db,
          "channels",
          channelId,
          "sessions",
          sessionId
        );
        const sessionSnap = await getDoc(sessionRef);

        if (!sessionSnap.exists()) {
          card.classList.add("d-none");
          return;
        }

        const sessionData = sessionSnap.data();
        const status = sessionData.status || "active";

        // read channel document
        const channelRef = doc(db, "channels", channelId);
        const channelSnap = await getDoc(channelRef);

        if (!channelSnap.exists()) {
          card.classList.add("d-none");
          return;
        }

        const ch = channelSnap.data();
        const channelName = ch.name || "Channel";

        // Owner does not see recent session card
        if (ch.createdBy && ch.createdBy === user.uid) {
          card.classList.add("d-none");
          return;
        }

        nameEl.textContent = channelName;

        // Update badge/text/button based on status
        if (badgeEl && textEl && btnEl) {
          if (status === "active") {
            badgeEl.textContent = "Live";
            badgeEl.classList.remove("bg-secondary-subtle", "text-secondary");
            badgeEl.classList.add("bg-success-subtle", "text-success");

            textEl.textContent =
              "You recently joined this session. You can jump back in at any time.";

            btnEl.textContent = "Rejoin Session";
          } else if (status === "end") {
            badgeEl.textContent = "Past";
            badgeEl.classList.remove("bg-success-subtle", "text-success");
            badgeEl.classList.add("bg-secondary-subtle", "text-secondary");

            textEl.textContent =
              "This session has ended. You can still review the session.";

            btnEl.textContent = "View Session";
          } else {
            // Unknown status, do not show
            card.classList.add("d-none");
            return;
          }
        } else {
          if (status !== "active") {
            card.classList.add("d-none");
            return;
          }
        }

        // 5) Render interest tags
        if (tagsEl) {
          tagsEl.innerHTML = "";

          const tags = Array.isArray(sessionData.tags) ? sessionData.tags : [];

          if (tags.length) {
            tags.slice(0, 3).forEach((t) => {
              const span = document.createElement("span");
              span.className =
                "badge rounded-2 text-dark me-2 fw-normal px-2 py-2";
              span.textContent = decorateTagLabel(t);
              tagsEl.appendChild(span);
            });
          } else {
            const span = document.createElement("span");
            span.className =
              "badge rounded-2 bg-secondary-subtle text-dark me-2 fw-normal px-2 py-2";
            span.textContent = decorateTagLabel("Ice-breaker");
            tagsEl.appendChild(span);
          }
        }

        // 6) Set link URL
        const url = new URL("ice-breaker-session.html", window.location.href);
        url.searchParams.set("channelId", channelId);
        url.searchParams.set("sessionId", sessionId);
        linkEl.href = url.href;

        card.classList.remove("d-none");
      } catch (err) {
        console.error("[dashboard] Failed to load recent session:", err);
        card.classList.add("d-none");
      }
    });
  } catch (err) {
    console.warn("[auth] authentication.js Failed in showRecentSession:", err);
    card?.classList.add("d-none");
  }
}

showRecentSession();

// load stats for current user
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
