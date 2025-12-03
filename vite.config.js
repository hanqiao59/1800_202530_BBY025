// This Vite config file (vite.config.js) tells Rollup (production bundler)
// to treat multiple HTML files as entry points so each becomes its own built page.

import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "login.html"),
        main: resolve(__dirname, "main.html"),
        profile: resolve(__dirname, "profile.html"),
        activityEnd: resolve(__dirname, "activity-end.html"),
        editProfile: resolve(__dirname, "edit-profile.html"),
        selectTags: resolve(__dirname, "select-tags.html"),
        icebreakerSession: resolve(__dirname, "ice-breaker-session.html"),
        autoGrouping: resolve(__dirname, "auto-grouping.html"),
        channelPreview: resolve(__dirname, "channel-preview.html"),
        connections: resolve(__dirname, "connections.html"),
        groupMembers: resolve(__dirname, "group-members.html"),
        interests: resolve(__dirname, "interests.html"),
        othersProfile: resolve(__dirname, "others-profile.html"),
      },
    },
  },
});
