import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import darkBanner from "../../assets/epos-banner-dark.webp";
import lightBanner from "../../assets/epos-banner-light.webp";
import { Button } from "../ui/Button";

const DISMISS_KEY = "epos-home-banner-dismissed";

interface AnnouncementBannerProps {
  /** Formatted dictation shortcut, interpolated into the relevant item. */
  shortcut: string;
  /** Called when "Get started" is pressed (routes to a relevant section). */
  onGetStarted: (item: string) => void;
}

/**
 * Dismissible hero banner that rotates a short marketing tip on each mount.
 * Dismissal persists in localStorage (institutional dark plaque with a faint
 * scanline sweep, matching the Lumon overlay treatment).
 */
export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  shortcut,
  onGetStarted,
}) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Pick a rotating item; stable for the lifetime of this mount.
  const item = useMemo(() => {
    const items = ["dictateAnywhere", "flowBar", "postProcess"] as const;
    return items[Math.floor(Math.random() * items.length)];
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="announcement-visual relative overflow-hidden rounded-sm scanlines">
      <div
        className="announcement-visual-art is-light"
        style={{ backgroundImage: `url(${lightBanner})` }}
        aria-hidden
      />
      <div
        className="announcement-visual-art is-dark"
        style={{ backgroundImage: `url(${darkBanner})` }}
        aria-hidden
      />
      <div className="announcement-visual-shade" aria-hidden />
      <div className="relative z-[1] flex items-start justify-between gap-6 px-7 py-6">
        <div className="flex flex-col gap-3 max-w-xl">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="phosphor-lamp block h-1.5 w-1.5 rounded-[1px]"
            />
            <span className="announcement-kicker font-mono text-[10px] uppercase tracking-[0.28em]">
              {t(`home.banner.items.${item}.title`)}
            </span>
          </div>
          <p className="announcement-copy text-[15px] leading-relaxed">
            {t(`home.banner.items.${item}.body`, { shortcut })}
          </p>
          <div className="pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onGetStarted(item)}
              className="announcement-action"
            >
              {t("home.banner.getStarted")}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("home.banner.dismiss")}
          title={t("home.banner.dismiss")}
          className="announcement-dismiss shrink-0 flex h-7 w-7 items-center justify-center rounded-xs transition-colors duration-300 cursor-pointer"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
};
