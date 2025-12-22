/* ===== Firebase imports ===== */
import { auth, db } from "./firebase-config.js";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const content = document.getElementById("content");
const continueButton = document.getElementById("continue-btn");
const saveStatus = document.getElementById("saveStatus");

// Get channelId from URL parameters
const params = new URLSearchParams(window.location.search);
const channelId = params.get("channelId");
if (!channelId) {
  console.warn("No channelId provided in URL.");
}

const MAX = 4; //maximum number of selectable interest tags
let uid = auth.currentUser?.uid || null;
let selected = new Set();
let groups = {};
let locked = false;
let unsubActiveSession = null;

/* ===== Helper: create DOM element ===== */
const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);

  // Set attributes
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") {
      n.className = v;
    } else if (k === "dataset") {
      Object.assign(n.dataset, v);
    } else {
      n.setAttribute(k, v);
    }
  });

  // Append children (text or elements)
  children.forEach((c) => {
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });

  return n;
};

/* ===== Load & preload data ===== */
// Load all interest tags from Firestore and group them by category.
async function loadTags() {
  try {
    const q = query(
      collection(db, "interestTags"),
      orderBy("category"),
      orderBy("order")
    );

    const snap = await getDocs(q);

    groups = {};

    // Group tags by category
    snap.forEach((d) => {
      const { name, emoji = "", category = "Other", order = 999 } = d.data();
      const item = { name, emoji, order };
      (groups[category] ??= []).push(item);
    });
  } catch (e) {
    if (e.code === "failed-precondition") {
      console.error("Create Firestore composite index for (category, order).");
    } else if (e.code === "permission-denied") {
      console.error(
        "No permission to read /interestTags. Update Firestore rules."
      );
    }
    throw e;
  }
}

/* ===== Preload user's existing interests ===== */
async function preloadUser() {
  if (!uid) return;

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  const arr =
    snap.exists() && Array.isArray(snap.data().interests)
      ? snap.data().interests
      : [];

  selected = new Set(arr.slice(0, MAX));
}

/* ===== UI rendering & interaction ===== */
// Render a single interest tag for the given item.
function renderChip(item) {
  const chip = el(
    "button",
    {
      class:
        "btn btn-white border rounded-pill d-inline-flex align-items-center gap-2 px-3 py-2",
      type: "button",
      dataset: { tag: item.name },
    },
    el("span", { class: "fs-6" }, item.emoji || ""),
    el("span", { class: "small fw-semibold" }, item.name)
  );

  // if this item is selected
  if (selected.has(item.name)) {
    chip.classList.add("btn-primary", "text-white", "btn-outline-primary");
  }

  chip.addEventListener("click", () => {
    // Do nothing if interests are locked
    if (locked) return;

    const name = item.name;

    // Toggle selection
    if (selected.has(name)) {
      selected.delete(name);
    } else {
      if (selected.size >= MAX) return; // enforce max limit
      selected.add(name);
    }

    const on = selected.has(name);
    chip.classList.toggle("btn-primary", on);
    chip.classList.toggle("text-white", on);
    chip.classList.toggle("btn-outline-primary", on);
    updateContinue();
  });

  return chip;
}

/* ===== Render the search bar and all grouped interest tags ===== */
function renderUI() {
  content.innerHTML = "";

  // Search bar ui
  const searchForm = el(
    "form",
    { class: "p-0" },
    el(
      "div",
      {
        class:
          "d-flex align-items-center bg-white rounded-pill px-3 py-2 mb-4 border",
      },
      el("i", { class: "bi bi-search text-secondary me-2" }),
      el("input", {
        id: "q",
        type: "search",
        class: "form-control bg-transparent border-0",
        placeholder: "search...",
      })
    )
  );

  // Prevent full page reload on submit
  searchForm.addEventListener("submit", (e) => e.preventDefault());
  content.appendChild(searchForm);

  const listWrap = el("div");
  content.appendChild(listWrap);

  // Preferred section order; any other categories go after these
  const SECTION_ORDER = ["Popular", "Outdoors", "Technology", "Other"];

  // Redraw the list based on the current filter
  const redraw = (filter = "") => {
    listWrap.innerHTML = "";
    const f = filter.trim().toLowerCase();

    // Determine section order
    const orderedSections = [
      ...SECTION_ORDER.filter((s) => groups[s]),
      ...Object.keys(groups).filter((s) => !SECTION_ORDER.includes(s)),
    ];

    // Render each section
    orderedSections.forEach((section) => {
      const items = groups[section].filter((it) =>
        it.name.toLowerCase().includes(f)
      );

      if (!items.length) return;

      const title = el(
        "div",
        { class: "text-secondary fw-semibold small mb-2" },
        section
      );

      const row = el("div", { class: "d-flex flex-wrap gap-2" });
      items.forEach((it) => row.appendChild(renderChip(it)));

      listWrap.appendChild(el("div", {}, title, row));
    });
  };

  // Handle search input
  const q = searchForm.querySelector("#q");
  q.addEventListener("input", (e) => redraw(e.target.value));
  redraw();
}

/* ===== Update continue button state ===== */
function updateContinue() {
  if (!continueButton) return;

  if (locked) {
    // When locked (waiting for host), always keep button enabled
    // so user can click again to edit their interests.
    continueButton.disabled = false;
    return;
  }

  // When not locked, require at least one interest to be selected
  continueButton.disabled = selected.size === 0;
}

/* ===== Persistence & session watching ===== */
// Save the currently selected interests to Firestore
async function saveSelection() {
  if (!uid) return;

  const interests = Array.from(selected);
  const payload = {
    interests,
    updatedAt: serverTimestamp(),
  };

  if (saveStatus) {
    saveStatus.textContent = "Saving your interests…";
  }

  const writes = [];

  // Update user's document
  writes.push(setDoc(doc(db, "users", uid), payload, { merge: true }));
  if (channelId) {
    writes.push(
      setDoc(doc(db, "channels", channelId, "members", uid), payload, {
        merge: true,
      })
    );
  }

  await Promise.all(writes);

  // save to localStorage as well
  try {
    localStorage.setItem("selectedInterests", JSON.stringify(interests));
  } catch (e) {
    console.warn("[select-tags] Failed to store local selectedInterests:", e);
  }
}

/* ===== Watch for active session ===== */
// Listen for any active session created by the host in this channel
function watchForActiveSession() {
  if (!channelId) return;

  // If we already have a watcher, stop it first (avoid duplicate listeners)
  if (typeof unsubActiveSession === "function") {
    unsubActiveSession();
    unsubActiveSession = null;
  }

  const sessionsRef = collection(db, "channels", channelId, "sessions");
  const q = query(sessionsRef, orderBy("createdAt", "desc"), limit(5));

  // Save unsubscribe so we can stop it later
  unsubActiveSession = onSnapshot(
    q,
    (snap) => {
      if (snap.empty) return;

      const activeDoc = snap.docs.find((d) => d.data().status === "active");
      if (!activeDoc) return;

      const sessionId = activeDoc.id;
      console.log("[select-tags] Found active session:", sessionId);

      // Stop listener before navigating (optional but clean)
      if (typeof unsubActiveSession === "function") {
        unsubActiveSession();
        unsubActiveSession = null;
      }

      const url = new URL("auto-grouping.html", window.location.href);
      url.searchParams.set("channelId", channelId);
      url.searchParams.set("sessionId", sessionId);
      window.location.href = url.href;
    },
    (err) => {
      console.error("[select-tags] Failed to watch sessions:", err);
    }
  );
}

/* ===== Event listeners ===== */
// Handle continue button clicks
if (continueButton) {
  continueButton.addEventListener("click", async () => {
    // First click: lock interests and watch for active session
    if (!locked) {
      if (selected.size === 0) return;

      continueButton.disabled = true;

      // Save selection
      try {
        await saveSelection();

        // Start watching for an active session created by the host
        watchForActiveSession();
        locked = true;

        // Disable all chips
        document.querySelectorAll("[data-tag]").forEach((chip) => {
          chip.disabled = true;
        });

        // Disable search box
        const qInput = document.getElementById("q");
        if (qInput) qInput.disabled = true;

        if (saveStatus) {
          saveStatus.textContent =
            "Your interests are saved. Please wait for the owner to start the ice-breaker session.";
        }

        // Turn button into "edit" mode
        continueButton.textContent = "Change my interest tags";
        continueButton.classList.remove("btn-primary");
        continueButton.classList.add("btn-outline-secondary");

        updateContinue();
      } catch (e) {
        console.error(e);
        if (saveStatus) {
          saveStatus.textContent =
            "Failed to save your interests. Please try again.";
        }
        continueButton.disabled = false;
      }
    } else {
      // Second click: unlock interests so user can edit again
      locked = false;

      document.querySelectorAll("[data-tag]").forEach((chip) => {
        chip.disabled = false;
      });

      const qInput = document.getElementById("q");
      if (qInput) qInput.disabled = false;

      continueButton.textContent = "I'm ready!";
      continueButton.classList.remove("btn-outline-secondary");
      continueButton.classList.add("btn-primary");

      updateContinue();

      // Update status message
      if (saveStatus) {
        saveStatus.textContent = "Click the button again when you're ready.";
      }
    }
  });
}

/* ===== Initial load ===== */
const loading = document.getElementById("loading");

async function initSelectTagsPage() {
  try {
    // Show loading indicator
    if (loading) {
      loading.style.display = "block";
    }

    // Ensure we have a UID (auth may not be ready on first load)
    if (!uid) {
      await new Promise((resolve) => {
        const stop = onAuthStateChanged(auth, (u) => {
          uid = u?.uid || uid;
          stop();
          resolve();
        });
      });
    }

    await Promise.all([loadTags(), preloadUser()]);
    renderUI();
    updateContinue();
  } catch (err) {
    console.error(err);
    if (content) {
      content.innerHTML =
        '<div class="alert alert-danger">Failed to load. Please try again later.</div>';
    }
  } finally {
    if (loading) {
      loading.style.display = "none";
    }
  }
}

initSelectTagsPage();
