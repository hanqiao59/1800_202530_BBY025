# 🧊 PeerLink

## 🎯 Overview

PeerLink is a web application that helps post-secondary students, especially introverted ones, quickly break the ice and quickly form bonds with their peers through fun, low-pressure mini icebreaker activities based on shared interests. Students can join channels for their classes or events, set up a personal profile with a display name, and interest tags, send friend requests, and participate in low-pressure conversations on both desktop and mobile devices.

Developed for the COMP 1800 course, this project applies User-Centred Design practices and agile project management, and demonstrates integration with Firebase backend services for storing user favorites.

---

## ✨ Features

- Join interest-based icebreaker sessions with classmates in the same channel
- Set up a personal profile with name, bio, and interest tags
- Send friend request to stay connected after sessions
- view session history
- Create and host channels for specific classes or events
- Responsive design that works on both desktop and mobile devices

---

## 🧩 Tech Stack

- **Wireframe**: Figma
- **Prototype**: Figma
- **Frontend**: HTML5, CSS, Bootstrap, JavaScript
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Backend**: Firebase for hosting
- **Database**: Firestore

---

## 🧭 Usage

1. Open your browser and visit `http://localhost:3000`.
2. Sign up with new account or log in with an existing one.
3. Create a new channel for a class or event, or join an existing channel by using an invite link.
4. Join icebreaker sessions with your chosen interest tags.
5. Send friends requests to people you want to stay connected with.
6. Customize your profile to best reflect yourself.

---

## 🗂️ Project Structure

```
PeerLink/
├── src/
│   ├── styles/
│       ├── style.css
│       ├── index.css
│       ├── main.css
│       ├── activity-end.css
│       ├── auto-grouping.css
│       ├── channel-preview.css
│       ├── edit-profile.css
│       ├── ice-breaker-session.css
│       ├── interests.css
│       ├── login.css
│       ├── others-profile.css
│       ├── profile.css
│       ├── select-tags.css
│   ├── components/
│       ├── site-default-footer.js
│       ├── site-footer.js
│       ├── site-navbar.js
│   ├── js/
│       ├── app.js
│       ├── index.js
│       ├── authentication.js
│       ├── firebase-config.js
│       ├── login-signup.js
│       ├── main.js
│       ├── activity-end.js
│       ├── auto-grouping.js
│       ├── channel-preview.js
│       ├── edit-profile.js
│       ├── group-members.js
│       ├── ice-breaker-session.js
│       ├── interests-tags.js
│       ├── select-tags.js
│       ├── profile.js
│   ├── index.html
│   ├── main.html
│   ├── activity-end.html
│   ├── auto-grouping.html
│   ├── channel-preview.html
│   ├── connections.html
│   ├── edit-profile.html
│   ├── group-members.html
│   ├── ice-breaker-session.html
│   ├── interests.html
│   ├── login.html
│   ├── others-profile.html
│   ├── profile.html
│   ├── select-tags.html
│   ├── skeleton.html
├── images/
├── package.json
├── package-lock.json
├── README.md
```

---

## 👥 Team

| Name | About | Role | Fun fact |
|--------------------------------|
| Hanqiao (Claire) Li | CST student @ BCIT, Love exploring new tech and japan. | Developer | Have a kitty cat! |
| Hezekiah | BCIT CST Student, Stares at logical errors blankly while coding. | Developer | Plays piano |
| Minh Ngoc Ngo | BCIT CST Student with an interest in game development and likes to go outside sometimes | Developer | Hates socializing |

---

## 🤝 Acknowledgments

- Icons are sourced from [bootstrap icons](https://icons.getbootstrap.com/) and illustrations are sourced from [Icons8](https://icons8.com/) and [Freepik](https://www.freepik.com/) (licensed under a Freepik subscription) and are used for demonstration purposes only.
- Fonts are provided by [Google Fonts](https://fonts.google.com/).
- Code snippets were adapted from COMP 1800 in-class demos.
- - Additional code snippets and some wording were adapted from [ChatGPT (OpenAI)](https://chat.openai.com) and then customized to fit this project.

---

## ⚠️ Limitations

- The “auto grouping” logic is simplified and currently just picks a random interest tag from the user’s selection, rather than truly matching them with other users who share that tag.
- Icebreaker activities are currently pre-saved in Firebase and limited to three categories.
- No customizable channel settings (e.g., changing the number of icebreaker activities).
- The friend system is basic (no direct messaging, notifications).

## 🔮 Future Work

- Expand icebreaker activity prompts.
- Improve the grouping logic to actually match students with others who share interests.
- Add customizable channel settings.
- Create a dark mode for better usability in low-light conditions.

---

## 🪪 License

This project is licensed under the MIT License. See the LICENSE file for details.
