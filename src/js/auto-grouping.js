/* ===== DOM and URL Params ===== */
const groupLabelEl = document.getElementById("groupLabel");
const params = new URLSearchParams(window.location.search);
const channelId = params.get("channelId");
const sessionId = params.get("sessionId");
const MATCH_DELAY = 3000;
const AFTER_MATCH_DELAY = 2000;

//delay helper
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// get tags from localStorage
function getTagsFromLocal() {
  try {
    const raw = localStorage.getItem("selectedInterests");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch (e) {
    console.warn("[auto-grouping] failed to read localStorage:", e);
  }
  return [];
}

// format tags for display
function formatTags(tags) {
  if (!tags.length) return "";
  if (tags.length <= 3) return tags.join(", ");
  return tags.slice(0, 3).join(", ") + " + more";
}

/* ===== Simulate matching process ===== */
async function runAutoGrouping() {
  // fake "matching" delay
  await delay(MATCH_DELAY);

  // show label
  const tags = getTagsFromLocal();
  if (groupLabelEl) {
    const text = formatTags(tags);
    groupLabelEl.textContent = text
      ? `Matched based on: ${text}`
      : "Matched 9 people based on your interest tags";
    groupLabelEl.classList.remove("d-none");
  }

  await delay(AFTER_MATCH_DELAY);

  // redirect to ice-breaker session page
  const url = new URL("ice-breaker-session.html", window.location.href);
  if (channelId) url.searchParams.set("channelId", channelId);
  if (sessionId) url.searchParams.set("sessionId", sessionId);
  window.location.href = url.href;
}

runAutoGrouping();
