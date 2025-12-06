/* ==== Add Friend Button Functionality ==== */
const addFriendBtn = document.getElementById("addFriendBtn");
const friendFeedback = document.getElementById("friendFeedback");

if (addFriendBtn) {
  addFriendBtn.addEventListener("click", (e) => {
    e.preventDefault();

    addFriendBtn.classList.add("d-none");

    if (friendFeedback) {
      friendFeedback.classList.remove("d-none");
    }
  });
}
