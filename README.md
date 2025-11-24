# PeerLink

## Overview

PeerLink is a web application that helps post-secondary students, especially introverted ones, quickly break the ice and form bonds with their classmates through fun, low-pressure mini icebreaker activities based on shared interests. Students can join channels for their classes or events, set up a personal profile with a display name, profile photo, and interest tags, send friend requests, and participate in low-pressure conversations on both desktop and mobile devices.

Developed for the COMP 1800 course, this project applies User-Centred Design practices and agile project management, and demonstrates integration with Firebase backend services for storing user favorites.

---

## Features

- Join interest-based icebreaker sessions with classmates in the same channel
- Set up a personal profile with profile photo and interest tags
- Send friend request to stay connected after sessions
- view session history
- Create and host channels for specific classes or events
- Responsive design that works on both desktop and mobile devices

---

## Technologies Used

- **Wireframe**: Figma
- **Prootype**: Figma
- **Frontend**: HTML5, CSS, Bootstrap, JavaScript
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Backend**: Firebase for hosting
- **Database**: Firestore

---

## Usage

1. Open your browser and visit `http://localhost:3000`.
2. Sign up for a new account or log in with an existing one.
3. Create a new channel for your class or event, or join an existing channel by using an invite link.
4. Join an icebreaker sessions with your chosen interest tags.
5. Send friends request to people you want to stay connected with.
6. Customize your profile to showcase yourself.

---

## Project Structure

```
elmo-hikes/
├── src/
│   ├── styles/
│       └── style.css
│   ├── components/
│       ├── site-default-footer.js
│       ├── site-footer.js
│       ├── site-navbar.js
│   ├── app.js
│   ├── authentication.js
│   ├── firebaseConfig.js
│   ├── loginSignup.js
│   ├── main.js
│   ├── account.js
│   ├── activity-end.js
│   ├── auto-grouping.js
│   ├── channel-preview.js
│   ├── edit-profile.js
│   ├── group-members.js
│   ├── ice-breaker-session.js
│   ├── interestsTags.js
│   ├── select-tags.js
│   ├── show-member.js
├── public/
│   ├── index.html
│   ├── main.html
│   ├── account.html
│   ├── activity-end.html
│   ├── auto-grouping.html
│   ├── channel-preview.html
│   ├── edit-profile.html
│   ├── group-member.html
│   ├── ice-breaker-session.html
│   ├── interests.html
│   ├── login.html
│   ├── others-profile.html
│   ├── profile.html
│   ├── select-tags.html
│   ├── show-member.html
│   ├── skeleton.html
├── images/
├── package.json
├── README.md
```

---

## Contributors

- Hanqiao - CST student @ BCIT | Love exploring new tech & indie games. Fun fact: I have a kitten named Minnie. I love listening to music.
- Hezekiah - BCIT CST Student. Stares at logical errors blankly while coding. Plays piano. A bigger change
- Minh Ngoc Ngo - BCIT CST Student with an interest in game development and likes to go outside sometimes. Hates socializing. A quiet fellow set D student.

---

## Acknowledgments

- Icons are sourced from [bootstrap icons](https://icons.getbootstrap.com/) and illustrations are sourced from [Icons8](https://icons8.com/) and [Freepik](https://www.freepik.com/) (licensed under a Freepik subscription) and are used for demonstration purposes only.
- Fonts are provided by [Google Fonts](https://fonts.google.com/).
- Code snippets were adapted from COMP 1800 in-class demos.
- - Additional code snippets and some wording were adapted from [ChatGPT (OpenAI)](https://chat.openai.com) and then customized to fit this project.

---

## Limitations and Future Work

### Limitations

- The “auto grouping” logic is simplified and currently just picks a random interest tag from the user’s selection, rather than truly matching them with other users who share that tag.
- Icebreaker activities are currently pre-saved in Firebase and limited to three categories.
- No customizable channel settings (e.g., changing the number of icebreaker activities).
- The friend system is basic (no direct messaging, notifications).

### Future Work

- Expand icebreaker activity prompts.
- Improve the grouping logic to actually match students with others who share interests.
- Add customizable channel settings.
- Create a dark mode for better usability in low-light conditions.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.
