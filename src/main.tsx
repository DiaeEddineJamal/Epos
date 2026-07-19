import React from "react";
import ReactDOM from "react-dom/client";
import { platform } from "@tauri-apps/plugin-os";
import App from "./App";
import { initTheme } from "./lib/theme";
import "./App.css";

// Set platform before render so CSS can scope per-platform (e.g. scrollbar styles)
try {
  document.documentElement.dataset.platform = platform();
} catch {
  document.documentElement.dataset.platform = "windows";
}

// Apply the persisted light/dark theme before first paint to avoid a flash.
initTheme();

// Initialize i18n
import "./i18n";

// Initialize model store (loads models and sets up event listeners)
import("./stores/modelStore").then(({ useModelStore }) => {
  useModelStore.getState().initialize();
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
