import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type as osType } from "@tauri-apps/plugin-os";
import { toast } from "sonner";
import { commands, events, type DashboardStats } from "@/bindings";
import { useSettings } from "../../hooks/useSettings";
import { formatShortcut } from "../../utils/shortcutFormat";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { StatsPanel } from "./StatsPanel";
import { VoiceProfileCard } from "./VoiceProfileCard";
import { ActivityFeed } from "./ActivityFeed";

/**
 * The Home dashboard — Epos's landing surface. Greets the user, surfaces
 * lifetime dictation stats + the next milestone, rotates an announcement
 * banner, shows the voice-profile plaque, and lists recent dictation activity.
 * Feature parity with Wispr Flow's home screen, in the Lumon idiom.
 */
export const HomeDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const isMac = useMemo(() => {
    try {
      return osType() === "macos";
    } catch {
      return false;
    }
  }, []);

  const name = settings?.user_name?.trim() ?? "";
  const shortcut = formatShortcut(
    settings?.bindings?.transcribe?.current_binding ?? "",
    isMac,
  );

  // Load stats and keep them live via the dictation-stats event.
  useEffect(() => {
    let active = true;
    commands
      .getDashboardStats()
      .then((res) => {
        if (active && res.status === "ok") setStats(res.data);
      })
      .catch((e) => console.error("Failed to load stats:", e));

    const unlisten = events.dictationStatsEvent.listen((event) => {
      setStats(event.payload.stats);
    });
    return () => {
      active = false;
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleRetry = async (id: number) => {
    const result = await commands.retryHistoryEntryTranscription(id);
    if (result.status !== "ok") {
      toast.error(t("settings.history.retranscribeError"));
    }
  };

  const handleBannerAction = (item: string) => {
    // Flow-bar tips point at System settings; everything else stays home.
    if (item === "flowBar") {
      void commands.navigateMainWindow("system");
    } else if (item === "postProcess") {
      void commands.navigateMainWindow("advanced");
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto flex flex-col gap-7">
      {/* Greeting */}
      <div className="flex flex-col gap-1">
        <h1 className="text-[1.6rem] leading-tight font-medium text-text">
          {name ? t("home.greeting", { name }) : t("home.greetingNoName")}
        </h1>
        <p className="text-[14px] text-text/50">{t("home.subtitle")}</p>
      </div>

      {/* Banner + stats: banner spans the main column, stats sit alongside */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_18rem] gap-5 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <AnnouncementBanner
            shortcut={shortcut}
            onGetStarted={handleBannerAction}
          />
          <VoiceProfileCard totalWords={stats?.total_words ?? 0} />
          <ActivityFeed onRetry={handleRetry} />
        </div>
        <StatsPanel stats={stats} />
      </div>
    </div>
  );
};
