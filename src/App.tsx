import { useEffect, useState, useRef } from "react";
import { toast, Toaster } from "sonner";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { platform } from "@tauri-apps/plugin-os";
import {
  checkAccessibilityPermission,
  checkMicrophonePermission,
} from "tauri-plugin-macos-permissions-api";
import { ModelStateEvent, RecordingErrorEvent } from "./lib/types/events";
import AccessibilityPermissions from "./components/AccessibilityPermissions";
import Footer from "./components/footer";
import Onboarding, { AccessibilityOnboarding } from "./components/onboarding";
import { SectionBinaryTransition } from "./components/SectionBinaryTransition";
import { type SidebarSection, SECTIONS_CONFIG } from "./components/navigation";
import { CommandDeck } from "./components/TopNav";
import { Titlebar } from "./components/Titlebar";
import { SplashScreen } from "./components/SplashScreen";
import { useSettings } from "./hooks/useSettings";
import { useSettingsStore } from "./stores/settingsStore";
import { useThemeStore } from "./stores/themeStore";
import { commands, events } from "@/bindings";
import { getLanguageDirection, initializeRTL } from "@/lib/utils/rtl";

type OnboardingStep = "accessibility" | "model" | "done";

const renderSettingsContent = (section: SidebarSection) => {
  const ActiveComponent =
    SECTIONS_CONFIG[section]?.component || SECTIONS_CONFIG.general.component;
  return <ActiveComponent />;
};

function App() {
  const { t, i18n } = useTranslation();
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(
    null,
  );
  // Track if this is a returning user who just needs to grant permissions
  // (vs a new user who needs full onboarding including model selection)
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [currentSection, setCurrentSection] = useState<SidebarSection>("home");
  const { settings, updateSetting } = useSettings();
  // Lumon cold-boot splash, shown once per app open (skippable).
  const [showSplash, setShowSplash] = useState(true);
  const resolvedTheme = useThemeStore((state) => state.resolved);
  const direction = getLanguageDirection(i18n.language);
  const refreshAudioDevices = useSettingsStore(
    (state) => state.refreshAudioDevices,
  );
  const refreshOutputDevices = useSettingsStore(
    (state) => state.refreshOutputDevices,
  );
  const hasCompletedPostOnboardingInit = useRef(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // Initialize RTL direction when language changes
  useEffect(() => {
    initializeRTL(i18n.language);
  }, [i18n.language]);

  // Initialize Enigo, shortcuts, and refresh audio devices when main app loads
  useEffect(() => {
    if (onboardingStep === "done" && !hasCompletedPostOnboardingInit.current) {
      hasCompletedPostOnboardingInit.current = true;
      Promise.all([
        commands.initializeEnigo(),
        commands.initializeShortcuts(),
      ]).catch((e) => {
        console.warn("Failed to initialize:", e);
      });
      refreshAudioDevices();
      refreshOutputDevices();
    }
  }, [onboardingStep, refreshAudioDevices, refreshOutputDevices]);

  // Handle keyboard shortcuts for debug mode toggle
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Shift+D (Windows/Linux) or Cmd+Shift+D (macOS)
      const isDebugShortcut =
        event.shiftKey &&
        event.key.toLowerCase() === "d" &&
        (event.ctrlKey || event.metaKey);

      if (isDebugShortcut) {
        event.preventDefault();
        const currentDebugMode = settings?.debug_mode ?? false;
        updateSetting("debug_mode", !currentDebugMode);
      }
    };

    // Add event listener when component mounts
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup event listener when component unmounts
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settings?.debug_mode, updateSetting]);

  // Listen for recording errors from the backend and show a toast
  useEffect(() => {
    const unlisten = listen<RecordingErrorEvent>("recording-error", (event) => {
      const { error_type, detail } = event.payload;

      if (error_type === "microphone_permission_denied") {
        const currentPlatform = platform();
        const platformKey = `errors.micPermissionDenied.${currentPlatform}`;
        const description = t(platformKey, {
          defaultValue: t("errors.micPermissionDenied.generic"),
        });
        toast.error(t("errors.micPermissionDeniedTitle"), { description });
      } else if (error_type === "no_input_device") {
        toast.error(t("errors.noInputDeviceTitle"), {
          description: t("errors.noInputDevice"),
        });
      } else {
        toast.error(
          t("errors.recordingFailed", { error: detail ?? "Unknown error" }),
        );
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [t]);

  // Listen for paste failures and show a toast.
  // The technical error detail is logged to epos.log on the Rust side
  // (see actions.rs `error!("Failed to paste transcription: ...")`),
  // so we show a localized, user-friendly message here instead of the raw error.
  useEffect(() => {
    const unlisten = listen("paste-error", () => {
      toast.error(t("errors.pasteFailedTitle"), {
        description: t("errors.pasteFailed"),
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [t]);

  // Listen for model loading failures and show a toast
  useEffect(() => {
    const unlisten = listen<ModelStateEvent>("model-state-changed", (event) => {
      if (event.payload.event_type === "loading_failed") {
        toast.error(
          t("errors.modelLoadFailed", {
            model:
              event.payload.model_name || t("errors.modelLoadFailedUnknown"),
          }),
          {
            description: event.payload.error,
          },
        );
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [t]);

  // Milestone celebrations: the backend emits a stats event after every
  // dictation; surface a toast when a word/streak milestone is crossed
  // (gated on the Milestones notification preference).
  useEffect(() => {
    const unlisten = events.dictationStatsEvent.listen((event) => {
      if (settings?.notifications_milestones === false) return;
      const { new_word_milestone, new_streak_milestone } = event.payload;
      if (new_word_milestone) {
        toast.success(t("milestone.words.title"), {
          description: t("milestone.words.body", {
            count: new_word_milestone,
          }),
        });
      }
      if (new_streak_milestone) {
        toast.success(
          t("milestone.streak.title", { count: new_streak_milestone }),
          {
            description: t("milestone.streak.body", {
              count: new_streak_milestone,
            }),
          },
        );
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [t, settings?.notifications_milestones]);

  // The flow bar / tray can request the main window navigate to a section.
  useEffect(() => {
    const unlisten = listen<string>("navigate-section", (event) => {
      const target = event.payload;
      if (target && target in SECTIONS_CONFIG) {
        setCurrentSection(target as SidebarSection);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const revealMainWindowForPermissions = async () => {
    try {
      await commands.showMainWindowCommand();
    } catch (e) {
      console.warn("Failed to show main window for permission onboarding:", e);
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      // Check if they have any models available
      const result = await commands.hasAnyModelsAvailable();
      const hasModels = result.status === "ok" && result.data;
      const currentPlatform = platform();
      // Only require the settings to not be undefined, removing the is_first_run dependency
      // since the property might have been removed or changed. We assume that if they have
      // models, they've already run the app and finished onboarding.
      const hasCompletedOnboarding = hasModels;

      if (hasCompletedOnboarding) {
        // Returning user - check if they need to grant permissions first
        setIsReturningUser(true);

        if (currentPlatform === "macos") {
          try {
            const [hasAccessibility, hasMicrophone] = await Promise.all([
              checkAccessibilityPermission(),
              checkMicrophonePermission(),
            ]);
            if (!hasAccessibility || !hasMicrophone) {
              await revealMainWindowForPermissions();
              setOnboardingStep("accessibility");
              return;
            }
          } catch (e) {
            console.warn("Failed to check macOS permissions:", e);
            // If we can't check, proceed to main app and let them fix it there
          }
        }

        if (currentPlatform === "windows") {
          try {
            const microphoneStatus =
              await commands.getWindowsMicrophonePermissionStatus();
            if (
              microphoneStatus.supported &&
              microphoneStatus.overall_access === "denied"
            ) {
              await revealMainWindowForPermissions();
              setOnboardingStep("accessibility");
              return;
            }
          } catch (e) {
            console.warn("Failed to check Windows microphone permissions:", e);
            // If we can't check, proceed to main app and let them fix it there
          }
        }

        setOnboardingStep("done");
      } else {
        // New user - start full onboarding
        setIsReturningUser(false);
        setOnboardingStep("accessibility");
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      setOnboardingStep("accessibility");
    }
  };

  const handleAccessibilityComplete = () => {
    // Returning users already have models, skip to main app
    // New users need to select a model
    setOnboardingStep(isReturningUser ? "done" : "model");
  };

  const handleModelSelected = () => {
    // Transition to main app - user has started a download
    setOnboardingStep("done");
  };

  const splash = showSplash ? (
    <SplashScreen onDone={() => setShowSplash(false)} />
  ) : null;

  // Still checking onboarding status — keep the splash covering the blank.
  if (onboardingStep === null) {
    return splash;
  }

  if (onboardingStep === "accessibility") {
    return (
      <>
        {splash}
        <div className="h-screen flex flex-col bg-background text-text overflow-hidden">
          <Titlebar />
          <div className="flex-1 overflow-hidden">
            <AccessibilityOnboarding onComplete={handleAccessibilityComplete} />
          </div>
        </div>
      </>
    );
  }

  if (onboardingStep === "model") {
    return (
      <>
        {splash}
        <div className="h-screen flex flex-col bg-background text-text overflow-hidden">
          <Titlebar />
          <div className="flex-1 overflow-hidden">
            <Onboarding onModelSelected={handleModelSelected} />
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      dir={direction}
      className="h-screen flex flex-col select-none cursor-default bg-background text-text overflow-hidden relative"
    >
      {splash}
      <Titlebar />
      <Toaster
        theme={resolvedTheme}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "bg-background-ui rounded-sm px-5 py-4 flex items-center gap-4 text-[15px] border hairline",
            title: "text-[13px] text-text font-medium uppercase tracking-wider",
            description: "text-text/60 text-[14px] normal-case tracking-normal",
          },
        }}
      />

      {/* Lumon shell: horizontal command deck + full-width file workspace */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-0">
        <CommandDeck
          activeSection={currentSection}
          onSectionChange={setCurrentSection}
        />

        <div className="relative flex-1 flex flex-col overflow-hidden min-w-0 lumon-grid">
          <SectionBinaryTransition
            key={`binary-${currentSection}`}
            sectionIndex={Object.keys(SECTIONS_CONFIG).indexOf(currentSection)}
          />

          {/* Institutional file masthead */}
          <header className="shrink-0 px-8 md:px-10 pt-6 pb-5 border-b hairline bg-background/80 backdrop-blur-[2px]">
            <div className="max-w-6xl mx-auto w-full flex flex-col gap-2">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-text/40">
                <span>{t("sidebar.file")}</span>
                <span className="text-live tabular-nums tracking-widest">
                  {String(
                    Object.keys(SECTIONS_CONFIG).indexOf(currentSection) + 1,
                  ).padStart(2, "0")}
                </span>
                <span className="flex-1 h-px bg-hairline" aria-hidden />
                <span>{t("sidebar.refinement")}</span>
              </div>
              <h1 className="text-[1.35rem] leading-none font-medium uppercase tracking-[0.22em] text-text">
                {t(SECTIONS_CONFIG[currentSection].labelKey)}
              </h1>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div
              key={currentSection}
              className="max-w-6xl mx-auto w-full flex flex-col px-8 md:px-10 pt-8 pb-12 gap-7 animate-drawer"
            >
              <AccessibilityPermissions />
              {renderSettingsContent(currentSection)}
            </div>
          </div>

          <Footer />
        </div>
      </div>
    </div>
  );
}

export default App;
