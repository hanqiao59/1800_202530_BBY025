/* ===== Firebase imports ===== */
import { auth, db } from "/src/js/firebaseConfig.js";
import { onAuthStateChanged } from "firebase/auth";
import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
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

    // No user: hide the whole section
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

      // No hosted channels at all
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

        // Latest session is ended → skip
        if (status === "end") {
          continue;
        }

        items.push({ id: chId, name: chData.name || "Untitled Channel" });
      }

      // No available hosted channels to show
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

/* ========== Simple search filter for recent sessions ========== */
const searchInput = document.getElementById("dashboardSearch");

if (searchInput) {
  // Prevent the whole page from refreshing when pressing Enter
  const searchForm = searchInput.closest("form");
  searchForm?.addEventListener("submit", (e) => e.preventDefault());

  searchInput.addEventListener("input", () => {
    const term = searchInput.value.trim().toLowerCase();

    const cards = document.querySelectorAll(".recent-session-card");
    cards.forEach((card) => {
      const nameText =
        card.querySelector(".recent-session-name")?.textContent.toLowerCase() ||
        "";

      const tagsText =
        card.querySelector(".recent-session-tags")?.textContent.toLowerCase() ||
        "";

      // Match if term is in name or tags
      const match = !term || nameText.includes(term) || tagsText.includes(term);

      card.classList.toggle("d-none", !match);
    });
  });
}

/* ========== Join Channel Modal ========== */
const modalEl = document.getElementById("joinChannelModal");

// Reset input when modal is closed
modalEl?.addEventListener("hidden.bs.modal", () => {
  const input = document.getElementById("inviteLink");
  // Clear the input field
  if (input) input.value = "";
});

// Handle the Paste button (reads from clipboard)
document.getElementById("pasteBtn")?.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    const input = document.getElementById("inviteLink");
    // Paste into the input field
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
const joinSubmitBtn = joinForm?.querySelector('button[type="submit"]');

// Disable the default form submission behavior
joinForm?.addEventListener("submit", (e) => e.preventDefault());

// Change the submit button to a regular button so it won't trigger the form
joinSubmitBtn?.setAttribute("type", "button");

// Extract the channel ID from a full link or raw ID string
function extractChannelId(value) {
  // Empty input
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
  // Invalid or missing ID
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
// Elements
const createModalEl = document.getElementById("createChannelModal");
const form = document.getElementById("createChannelForm");
const nameInput = document.getElementById("channelName");
const submitBtn = document.getElementById("createChannelSubmit");
const errEl = document.getElementById("createChannelError");
const openChannelBtn = document.getElementById("openChannelBtn");
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

  // Reset the open-channel link as well
  if (openChannelBtn) {
    openChannelBtn.href = "#";
  }
});

// Handle Create Channel form submission
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();

  // Validate name
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

    // Set the "Open Channel" button link
    if (openChannelBtn) {
      openChannelBtn.href = link;
    }
    // Show step 2 (invite link)
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

/* ========== Session Cards  ========== */
async function showAllSessionsForUser(user) {
  const container = document.getElementById("recentSessionsContainer");
  const template = document.getElementById("recentSessionTemplate");
  if (!container || !template) return;

  // clear previous items
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
    // Read sessions the user has joined
    const joinedRef = collection(db, "users", user.uid, "joinedSessions");
    const qJoined = query(joinedRef, orderBy("joinedAt", "desc"));
    const joinedSnap = await getDocs(qJoined);

    loadingEl.remove();

    // No joined sessions
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

      // Invalid data
      if (!channelId || !sessionId) continue;

      const sessionRef = doc(db, "channels", channelId, "sessions", sessionId);
      const channelRef = doc(db, "channels", channelId);

      const [sessionSnap, channelSnap] = await Promise.all([
        getDoc(sessionRef),
        getDoc(channelRef),
      ]);

      // Missing session or channel
      if (!sessionSnap.exists() || !channelSnap.exists()) continue;

      const sessionData = sessionSnap.data();
      const channelData = channelSnap.data();

      // If the user is the creator of the channel, skip showing it here
      if (channelData.createdBy && channelData.createdBy === user.uid) {
        continue;
      }

      const status = sessionData.status || "active";
      const channelName = channelData.name || "Channel";
      const tags = Array.isArray(sessionData.tags) ? sessionData.tags : [];

      // Build session URL
      let url;
      if (status === "end") {
        url = new URL("activity-end.html", window.location.href);
      } else {
        url = new URL("ice-breaker-session.html", window.location.href);
      }
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

      // Channel name
      if (nameEl) nameEl.textContent = channelName;

      // Status badge and text
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

      // Description text
      if (textEl) {
        if (status === "active") {
          textEl.textContent =
            "You recently joined this session. You can jump back in at any time.";
        } else {
          textEl.textContent =
            "This session has ended. You can view the summary and activity history.";
        }
      }

      // Tags (up to 3)
      if (tagsEl) {
        tagsEl.innerHTML = "";
        if (tags.length) {
          tags.slice(0, 3).forEach((t) => {
            const span = document.createElement("span");
            span.className =
              "badge rounded-2 text-dark me-2 fw-semibold px-2 py-2";
            span.textContent = decorateTagLabel(t);
            tagsEl.appendChild(span);
          });
        }
      }

      // Set link and button text
      if (linkEl) {
        linkEl.href = url.href;
      }
      // Button text
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

/* ========== Stats: Activities joined + Channels hosted ========== */
async function loadUserStats(user) {
  const activitiesEl = document.getElementById("statActivitiesJoined");
  const channelsEl = document.getElementById("statChannels");

  // No stats elements found
  if (!activitiesEl && !channelsEl) return;

  try {
    const joinedRef = collection(db, "users", user.uid, "joinedSessions");
    const joinedSnapPromise = getDocs(joinedRef);
    // Read channels created by the user
    const channelsQ = query(
      collection(db, "channels"),
      where("createdBy", "==", user.uid)
    );
    const channelsSnapPromise = getDocs(channelsQ);

    // Await both queries in parallel
    const [joinedSnap, channelsSnap] = await Promise.all([
      joinedSnapPromise,
      channelsSnapPromise,
    ]);

    // Channels stat: Number of channels created
    if (channelsEl) {
      channelsEl.textContent = String(channelsSnap.size);
    }

    // Activities stat: Number of sessions joined
    let activitiesCount = 0;

    // No joined sessions
    if (!joinedSnap.empty) {
      const channelIds = new Set();
      joinedSnap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.channelId) channelIds.add(d.channelId);
      });

      // Fetch all channel owners in parallel
      const ownerMap = {};
      const ownerFetches = [];

      channelIds.forEach((cid) => {
        const cRef = doc(db, "channels", cid);
        ownerFetches.push(
          getDoc(cRef)
            .then((snap) => {
              if (snap.exists()) {
                const cData = snap.data();
                ownerMap[cid] = cData.createdBy || null;
              }
            })
            .catch((err) => {
              console.warn(
                "[dashboard] Failed to load channel for stats:",
                err
              );
            })
        );
      });

      await Promise.all(ownerFetches);

      // Count only those not created by the user
      joinedSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const cid = d.channelId;
        const ownerId = ownerMap[cid];

        // Skip if the user is the owner
        if (ownerId && ownerId === user.uid) {
          return;
        }

        activitiesCount += 1;
      });
    }

    // Update the activities stat element
    if (activitiesEl) {
      activitiesEl.textContent = String(activitiesCount);
    }
  } catch (err) {
    console.error("[dashboard] Failed to load user stats:", err);
    if (activitiesEl) activitiesEl.textContent = "–";
    if (channelsEl) channelsEl.textContent = "–";
  }
}
