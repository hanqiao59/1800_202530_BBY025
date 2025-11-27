/* ===== Firebase imports ===== */
import { auth, db } from "/src/firebaseConfig.js";
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

/* ===== DOM refs & URL params ===== */
const content = document.getElementById("content");
const loading = document.getElementById("loading");
const continueButton = document.getElementById("continue-btn");
const saveStatus = document.getElementById("saveStatus");

const params = new URLSearchParams(window.location.search);
const channelId = params.get("channelId");
if (!channelId) {
  console.warn("No channelId provided in URL.");
}

/* ===== Constants & state ===== */
const MAX = 4; // Max number of selectable tags

let uid = auth.currentUser?.uid || null;
let selected = new Set();
let groups = {};
let locked = false;

/* ===== Helper: create DOM element ===== */
/**
 * Small helper to create a DOM element with attributes and children.
 *
 * Example:
 *   const btn = el(
 *     "button",
 *     { class: "btn btn-primary", type: "button" },
 *     "Click me"
 *   );
 */
const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);

  // Apply attributes
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

// Preload the user's existing interests from /users/{uid}.
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

/* ===== UI: chips & list ===== */
// Render a single interest chip (button) for the given item.
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

  // Initial selected state
  if (selected.has(item.name)) {
    chip.classList.add("bg-dark", "text-white", "border-dark");
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

    syncChips(name);
    updateContinue();
  });

  return chip;
}

// Sync all chips that have the same data-tag (same interest name).
function syncChips(name) {
  const safe = CSS?.escape ? CSS.escape(name) : name;
  const sel = `[data-tag="${safe}"]`;

  document.querySelectorAll(sel).forEach((chip) => {
    const on = selected.has(name);
    chip.classList.toggle("bg-dark", on);
    chip.classList.toggle("text-white", on);
    chip.classList.toggle("border-dark", on);
  });
}

// Render the search bar and all grouped interest chips.
function renderUI() {
  content.innerHTML = "";

  // Search bar
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

  const redraw = (filter = "") => {
    listWrap.innerHTML = "";
    const f = filter.trim().toLowerCase();

    const orderedSections = [
      ...SECTION_ORDER.filter((s) => groups[s]),
      ...Object.keys(groups).filter((s) => !SECTION_ORDER.includes(s)),
    ];

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

  const q = searchForm.querySelector("#q");
  q.addEventListener("input", (e) => redraw(e.target.value));
  redraw();
}

// Enable/disable the "I'm ready!" button based on current state.
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

  // Save to global user profile
  writes.push(setDoc(doc(db, "users", uid), payload, { merge: true }));

  // Also save under this channel, if we have a channelId
  if (channelId) {
    writes.push(
      setDoc(doc(db, "channels", channelId, "members", uid), payload, {
        merge: true,
      })
    );
  }

  await Promise.all(writes);

  try {
    localStorage.setItem("selectedInterests", JSON.stringify(interests));
  } catch (e) {
    console.warn("[select-tags] Failed to store local selectedInterests:", e);
  }
}

// Watch the latest sessions in this channel and redirect to auto-grouping
// when an active session is found.
function watchForActiveSession() {
  if (!channelId) return;

  const sessionsRef = collection(db, "channels", channelId, "sessions");
  const q = query(sessionsRef, orderBy("createdAt", "desc"), limit(5));

  onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        // Host has not started any session yet
        return;
      }

      const activeDoc = snap.docs.find((d) => d.data().status === "active");
      if (!activeDoc) {
        // No active session yet
        return;
      }

      const sessionId = activeDoc.id;
      console.log("[select-tags] Found active session:", sessionId);

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

/* ===== initial load ===== */
(async () => {
  try {
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
})();

/* ===== Event listeners ===== */
if (continueButton) {
  continueButton.addEventListener("click", async () => {
    // First click: lock interests and watch for active session
    if (!locked) {
      if (selected.size === 0) return;

      continueButton.disabled = true;

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

      if (saveStatus) {
        saveStatus.textContent = "Click the button again when you're ready.";
      }
    }
  });
}
