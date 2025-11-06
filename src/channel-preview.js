// src/channel-preview.js
import { db } from "/src/firebaseConfig.js";
import { doc, getDoc } from "firebase/firestore";

// Read channel id from URL
const params = new URLSearchParams(window.location.search);
const channelId = params.get("id");

// DOM
const titleEl = document.getElementById("channelTitle");
const continueBtn = document.querySelector('a[href="select-tags.html"]');

// Load channel and set title; also pass channelId to the next page
(async () => {
  if (!channelId) {
    titleEl.textContent = "No channel ID provided";
    return;
  }
  try {
    const snap = await getDoc(doc(db, "channels", channelId));
    if (!snap.exists()) {
      titleEl.textContent = "Channel not found";
      return;
    }
    const data = snap.data();
    // Show the channel name
    titleEl.textContent = data.name || "Untitled Channel";

    // Carry channelId to the next page
    if (continueBtn) {
      const url = new URL("select-tags.html", window.location.href);
      url.searchParams.set("channelId", channelId);
      continueBtn.setAttribute("href", url.href);
    }
  } catch (err) {
    console.error("Failed to load channel:", err);
    titleEl.textContent = "Failed to load channel";
  }
})();
