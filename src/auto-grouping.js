// Auto Grouping (Animation + Auto Redirect with Hard Timeout)
import { auth, db } from "/src/firebaseConfig.js";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const msgEl = document.getElementById("msg");
const dotsEl = document.getElementById("dots");

// === Adjustable parameters ===
const FAKE_MATCH_DELAY = 2000; // Duration of fake matching animation
const AFTER_MATCH_PAUSE = 800; // Pause after showing "matched" message
const HARD_TIMEOUT = 5000; // Hard timeout for entire process
const DEV_FAKE_COUNT = 4 + Math.floor(Math.random() * 3); // 4–6 fake members

// Dot animation
let dotTimer = null;
function startDots() {
  let n = 0;
  dotTimer = setInterval(() => {
    n = (n + 1) % 4;
    dotsEl.textContent = ".".repeat(n);
  }, 400);
}
function stopDots() {
  if (dotTimer) clearInterval(dotTimer);
  dotsEl.textContent = "";
}

// Display error visibly on the page
function showError(e) {
  const div = document.createElement("div");
  div.className = "alert alert-danger mt-3";
  div.textContent = `Error: ${e?.message || e}`;
  document.getElementById("loading")?.appendChild(div);
  console.error(e);
}

// Utility helpers
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function withTimeout(promise, ms, onTimeoutValue) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(onTimeoutValue), ms)),
  ]);
}

// Retrieve the user's main interest (fallback if unavailable)
async function getMainTag(uid) {
  try {
    const snap = await withTimeout(getDoc(doc(db, "users", uid)), 2000, null);
    if (snap && snap.exists()) {
      const d = snap.data();
      const arr = Array.isArray(d.interests) ? d.interests : [];
      return d.primaryInterest ?? arr[0] ?? "gaming";
    }
  } catch (e) {
    // Log but don’t interrupt flow
    console.warn("getMainTag error:", e);
  }
  // Fallback to localStorage
  try {
    const ls = JSON.parse(localStorage.getItem("selectedInterests") || "[]");
    if (Array.isArray(ls) && ls.length) return ls[0];
  } catch {}
  return "gaming";
}

// Main flow
(async () => {
  // Global error handlers
  window.addEventListener("error", (e) => showError(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => showError(e.reason));

  startDots();
  msgEl.textContent = "Matching classmates who share your interests";

  // 1) Wait for user authentication (with hard timeout)
  const user = await withTimeout(
    new Promise((resolve) => {
      if (auth.currentUser) return resolve(auth.currentUser);
      const stop = onAuthStateChanged(auth, (u) => {
        stop();
        resolve(u || null);
      });
    }),
    HARD_TIMEOUT,
    auth.currentUser || null
  );

  if (!user) {
    // No user detected — continue anyway (dev mode)
    console.warn("No user detected within timeout, proceed anyway (dev).");
    const tag = await getMainTag("dev");
    await delay(FAKE_MATCH_DELAY);
    stopDots();
    msgEl.textContent = `Matched ${DEV_FAKE_COUNT} people who like ${tag}!`;
    await delay(AFTER_MATCH_PAUSE);
    window.location.href = `/ice-breaker-session.html?tag=${encodeURIComponent(
      tag
    )}&count=${DEV_FAKE_COUNT}`;
    return;
  }

  // 2) Get main interest (with timeout and fallback)
  const tag = await getMainTag(user.uid);

  // 3) Simulate matching animation
  await delay(FAKE_MATCH_DELAY);
  stopDots();
  msgEl.textContent = `Matched ${DEV_FAKE_COUNT} people who like ${tag}!`;

  // 4) Short pause then redirect automatically
  await delay(AFTER_MATCH_PAUSE);
  window.location.href = `/ice-breaker-session.html?tag=${encodeURIComponent(
    tag
  )}&count=${DEV_FAKE_COUNT}`;
})();
