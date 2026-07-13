import React from "react";
import { Minus, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { type } from "@tauri-apps/plugin-os";
import { useTranslation } from "react-i18next";

// Brand wordmark — a badge, not a decorative logo. Kept out of JSX literals
// for the i18n lint rule; brand names are never translated.
const WORDMARK = "EPOS";

/**
 * Custom window chrome. The main window is created frameless on
 * Windows/Linux (decorations(false) in lib.rs) with controls rendered here;
 * on macOS the native traffic lights overlay this bar (TitleBarStyle::Overlay),
 * so we only reserve their space and draw no controls of our own.
 */
export const Titlebar: React.FC = () => {
  const { t } = useTranslation();
  const osType = type();
  const isMac = osType === "macos";
  const appWindow = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="shrink-0 h-10 w-full flex items-stretch justify-between select-none bg-background-ui border-b hairline z-50"
    >
      {/* Institutional plaque — wordmark + division micro-label. */}
      <div
        className={`flex items-center gap-3 pointer-events-none ${
          isMac ? "ps-[78px]" : "ps-4"
        }`}
      >
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.35em] text-text border border-hairline px-2.5 py-0.5 rounded-xs bg-background">
          {WORDMARK}
        </span>
        <span
          aria-hidden
          className="hidden sm:block h-3 w-px bg-hairline"
        />
        <span className="hidden sm:block font-mono text-[9px] uppercase tracking-[0.28em] text-text/40">
          {t("sidebar.division")}
        </span>
      </div>

      {/* Window controls — Windows/Linux only; macOS uses native lights. */}
      {!isMac && (
        <div className="flex items-stretch">
          <button
            type="button"
            aria-label="Minimize"
            onClick={() => appWindow.minimize()}
            className="w-11 flex items-center justify-center text-text/60 hover:text-text hover:bg-black/5 dark:hover:bg-bone/10 transition-colors duration-300 ease-in-out cursor-default"
          >
            <Minus size={15} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={() => appWindow.close()}
            className="w-11 flex items-center justify-center text-text/60 hover:text-bone hover:bg-amber-deep dark:hover:bg-amber-dark dark:hover:text-forest transition-colors duration-300 ease-in-out cursor-default"
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
};
