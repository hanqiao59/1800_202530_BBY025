import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "/src/styles/style.css";

/* ========== Select Tags Page Logic ========== */
// Logic for "Select Your Interests" page where users pick tags.
import { auth, db } from "/src/firebaseConfig.js";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// DOM
const content = document.getElementById("content");
const loading = document.getElementById("loading");
const continueBtn = document.getElementById("continue-btn");

// State
const MAX = 3;
let uid = auth.currentUser?.uid; // previous page already ensured login
let selected = new Set();
let groups = {}; // { category: [{name, emoji, order}], ... }

//  Helpers
const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k === "dataset") Object.assign(n.dataset, v);
    else n.setAttribute(k, v);
  });
  children.forEach((c) =>
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
  );
  return n;
};

//  Data: load tags grouped + ordered
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
      const {
        name,
        emoji = "",
        category = "Other",
        alsoIn = [],
        order = 999,
      } = d.data();
      const item = { name, emoji, order };
      (groups[category] ??= []).push(item);
      if (Array.isArray(alsoIn)) {
        alsoIn.forEach((cat) => (groups[cat] ??= []).push(item));
      }
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

// Data: preload user's existing interests
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

// UI: chip renderer
function renderChip(item) {
  const chip = el(
    "button",
    {
      class:
        "btn btn-white border rounded-pill d-inline-flex align-items-center gap-2 px-3 py-2",
      type: "button",
      dataset: { tag: item.name },
      "aria-pressed": selected.has(item.name) ? "true" : "false",
    },
    el("span", { class: "fs-6" }, item.emoji || ""),
    el("span", { class: "small fw-semibold" }, item.name)
  );

  if (selected.has(item.name))
    chip.classList.add("bg-dark", "text-white", "border-dark");

  chip.addEventListener("click", () => {
    const name = item.name;

    if (selected.has(name)) {
      selected.delete(name);
      chip.classList.remove("bg-dark", "text-white", "border-dark");
      chip.setAttribute("aria-pressed", "false");
    } else {
      if (selected.size >= MAX) return;
      selected.add(name);
      chip.classList.add("bg-dark", "text-white", "border-dark");
      chip.setAttribute("aria-pressed", "true");
    }

    updateContinue();
  });

  return chip;
}

// UI: full render (search + groups)
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
          "d-flex align-items-center bg-light rounded-pill px-3 py-2 mt-2 mb-4 border",
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
  searchForm.addEventListener("submit", (e) => e.preventDefault());
  content.appendChild(searchForm);

  const listWrap = el("div");
  content.appendChild(listWrap);

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

// Button + save
function updateContinue() {
  if (continueBtn) continueBtn.disabled = selected.size === 0;
}

async function saveSelection() {
  if (!uid) return;
  await setDoc(
    doc(db, "users", uid),
    { interests: Array.from(selected), updatedAt: new Date() },
    { merge: true }
  );
}

// boot
(async () => {
  try {
    loading && (loading.style.display = "block");

    // Only wait for uid to hydrate (no second auth check or redirect)
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
    content.innerHTML =
      '<div class="alert alert-danger">Failed to load. Please try again later.</div>';
  } finally {
    loading && (loading.style.display = "none");
  }
})();

//  Navigation
continueBtn?.addEventListener("click", async () => {
  if (selected.size === 0) return;
  continueBtn.disabled = true;
  try {
    await saveSelection();
    window.location.href = "/channels.html";
  } catch (e) {
    console.error(e);
    continueBtn.disabled = false;
  }
});
