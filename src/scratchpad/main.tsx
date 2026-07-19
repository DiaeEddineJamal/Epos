import React from "react";
import ReactDOM from "react-dom/client";
import { platform } from "@tauri-apps/plugin-os";
import { ScratchpadWindow } from "../components/scratchpad/ScratchpadWindow";
import { initTheme } from "../lib/theme";
import "../App.css";
import "../i18n";

try {
  document.documentElement.dataset.platform = platform();
} catch {
  document.documentElement.dataset.platform = "windows";
}

initTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ScratchpadWindow />
  </React.StrictMode>,
);
