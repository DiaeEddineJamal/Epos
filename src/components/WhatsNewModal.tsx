import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { EposAsciiMark } from "./EposAsciiMark";
import { Button } from "./ui/Button";
import { getChangelogEntry, type ChangelogEntry } from "@/lib/changelog";

const LAST_SEEN_KEY = "epos-last-seen-version";

/**
 * "What's new" seal — shown once, the first time the app launches on a
 * version with changelog copy. Purely local (localStorage): no backend
 * setting, no sync, just "has this webview profile already acknowledged
 * this version." Skipped entirely on a brand new install, since onboarding
 * already covers first impressions.
 */
export const WhatsNewModal: React.FC = () => {
  const { t } = useTranslation();
  const [entry, setEntry] = useState<ChangelogEntry | null>(null);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const version = await getVersion().catch(() => null);
      if (!version || cancelled) return;

      const lastSeen = window.localStorage.getItem(LAST_SEEN_KEY);

      if (lastSeen === null) {
        // First run ever on this install — nothing to catch up on.
        window.localStorage.setItem(LAST_SEEN_KEY, version);
        return;
      }

      if (lastSeen === version) return;

      const changelogEntry = getChangelogEntry(version);
      if (changelogEntry) {
        setEntry(changelogEntry);
        // Mount closed, then fade in next frame for a real transition
        // instead of popping in already at opacity 1.
        requestAnimationFrame(() => setVisible(true));
      } else {
        // No copy for this version — mark seen without showing anything.
        window.localStorage.setItem(LAST_SEEN_KEY, version);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = () => {
    if (!entry) return;
    setClosing(true);
    window.localStorage.setItem(LAST_SEEN_KEY, entry.version);
    setTimeout(() => {
      setVisible(false);
      setEntry(null);
      setClosing(false);
    }, 220);
  };

  if (!entry) return null;

  return (
    <div
      className={`whats-new-backdrop ${visible && !closing ? "is-visible" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
    >
      <div className="whats-new-card">
        <div className="whats-new-header">
          <EposAsciiMark className="whats-new-seal" />
          <div className="whats-new-header-text">
            <span className="whats-new-file">{entry.fileNumber}</span>
            <h2 id="whats-new-title" className="whats-new-title">
              {entry.headline}
            </h2>
            <span className="whats-new-version">
              {t("whatsNew.version", { version: entry.version })}
            </span>
          </div>
        </div>

        <ul className="whats-new-list">
          {entry.highlights.map((highlight, index) => (
            <li key={index} className="whats-new-item">
              <span className="whats-new-bullet" aria-hidden />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>

        <div className="whats-new-footer">
          <Button onClick={handleDismiss} variant="primary" size="md">
            {t("whatsNew.acknowledge")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewModal;
