import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TranscriptionIcon, CancelIcon } from "../components/icons";
import "./RecordingOverlay.css";
import { commands } from "@/bindings";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import { getLanguageDirection } from "@/lib/utils/rtl";

type OverlayState = "recording" | "transcribing" | "processing";

// Number of bars in the waveform. Bars are rendered symmetrically so the
// loudest energy sits in the middle, like Wispr Flow / superwhisper.
const BAR_COUNT = 13;

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(0));
  const direction = getLanguageDirection(i18n.language);

  // Smoothed bar values kept in a ref so the rAF loop never triggers re-renders
  // on its own — we only push to React state from the animation frame.
  const smoothedRef = useRef<number[]>(Array(BAR_COUNT).fill(0));
  const targetRef = useRef<number[]>(Array(BAR_COUNT).fill(0));
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef<OverlayState>("recording");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Map the incoming frequency buckets onto a symmetric, center-weighted layout.
  const applyLevels = (raw: number[]) => {
    const half = Math.floor(BAR_COUNT / 2);
    const next = new Array(BAR_COUNT).fill(0);
    for (let i = 0; i < BAR_COUNT; i++) {
      // Distance from center → pick a bucket; center bars use the strongest
      // low/mid energy, outer bars use higher buckets.
      const dist = Math.abs(i - half);
      const bucket = Math.min(raw.length - 1, dist);
      const v = raw[bucket] ?? 0;
      // Slight center emphasis for a natural "voice" shape.
      const centerBoost = 1 - dist / (half + 2);
      next[i] = Math.min(1, v * (0.7 + 0.6 * centerBoost));
    }
    targetRef.current = next;
  };

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenShow = await listen("show-overlay", async (event) => {
        await syncLanguageFromSettings();
        const overlayState = event.payload as OverlayState;
        setState(overlayState);
        setIsVisible(true);
      });

      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
        targetRef.current = Array(BAR_COUNT).fill(0);
      });

      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        applyLevels(event.payload as number[]);
      });

      return () => {
        unlistenShow();
        unlistenHide();
        unlistenLevel();
      };
    };

    const cleanupPromise = setupEventListeners();
    return () => {
      cleanupPromise.then((fn) => fn && fn());
    };
  }, []);

  // Animation loop: asymmetric smoothing (fast attack, slow release) gives the
  // bars a lively but fluid feel. When idle, a gentle breathing wave plays.
  useEffect(() => {
    let t0 = performance.now();
    const tick = (now: number) => {
      const dt = now - t0;
      t0 = now;
      const smoothed = smoothedRef.current;
      const target = targetRef.current;
      const recording = stateRef.current === "recording";
      const half = Math.floor(BAR_COUNT / 2);

      let anyEnergy = false;
      for (let i = 0; i < BAR_COUNT; i++) {
        if (target[i] > 0.02) anyEnergy = true;
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        let tgt = target[i];
        // Idle breathing animation while recording but silent.
        if (recording && !anyEnergy) {
          const phase = now / 520 - Math.abs(i - half) * 0.45;
          tgt = 0.06 + 0.05 * (0.5 + 0.5 * Math.sin(phase));
        }
        const prev = smoothed[i];
        const rising = tgt > prev;
        // Attack ~ fast, release ~ slow (per-ms easing, frame-rate independent).
        const speed = rising ? 0.045 : 0.012;
        const k = 1 - Math.pow(1 - speed, dt);
        smoothed[i] = prev + (tgt - prev) * k;
      }

      setBars(smoothed.slice());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      dir={direction}
      className={`recording-overlay ${isVisible ? "fade-in" : ""} state-${state}`}
    >
      <div className="overlay-left">
        {state === "recording" ? (
          <span className="rec-dot" aria-hidden />
        ) : (
          <span className="rec-spinner">
            <TranscriptionIcon />
          </span>
        )}
      </div>

      <div className="overlay-middle">
        {state === "recording" && (
          <div className="bars-container">
            {bars.map((v, i) => {
              const height = 4 + Math.min(1, v) * 26;
              return (
                <div
                  key={i}
                  className="bar"
                  style={{
                    height: `${height}px`,
                    opacity: 0.55 + Math.min(0.45, v * 0.9),
                  }}
                />
              );
            })}
          </div>
        )}
        {state === "transcribing" && (
          <div className="status-text">
            {t("overlay.transcribing")}
            <span className="dots">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
        {state === "processing" && (
          <div className="status-text">
            {t("overlay.processing")}
            <span className="dots">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
      </div>

      <div className="overlay-right">
        {state === "recording" && (
          <div
            className="cancel-button"
            onClick={() => {
              commands.cancelOperation();
            }}
          >
            <CancelIcon />
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingOverlay;
