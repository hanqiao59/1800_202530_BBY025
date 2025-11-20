const params = new URLSearchParams(window.location.search);
const channelId = params.get("channelId");
const sessionId = params.get("sessionId");

const link = document.getElementById("viewHistoryLink");

if (link && channelId && sessionId) {
  const url = new URL("ice-breaker-session.html", window.location.href);
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("mode", "history");

  link.href = url.href;
} else if (link) {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "main.html";
  });
}
