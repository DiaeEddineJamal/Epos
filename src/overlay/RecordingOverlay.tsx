import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, NotebookPen } from "lucide-react";
import { TranscriptionIcon, CancelIcon } from "../components/icons";
import "./RecordingOverlay.css";
import { commands } from "@/bindings";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import { getLanguageDirection } from "@/lib/utils/rtl";
import { THEME_CHANGE_EVENT } from "@/lib/theme";

type OverlayState = "idle" | "recording" | "transcribing" | "processing";

// Human-readable dictation shortcut for the idle Flow Bar hint/tooltip.
const formatShortcut = (binding: string): string => {
  const map: Record<string, string> = {
    ctrl: "Ctrl",
    control: "Ctrl",
    cmd: "Cmd",
    command: "Cmd",
    super: "Win",
    meta: "Win",
    win: "Win",
    alt: "Alt",
    option: "Alt",
    shift: "Shift",
    space: "Space",
    enter: "Enter",
    escape: "Esc",
  };
  return binding
    .split("+")
    .map((raw) => {
      const key = raw.trim().toLowerCase();
      return (
        map[key] ??
        (raw.length === 1
          ? raw.toUpperCase()
          : raw.replace(/^\w/, (c) => c.toUpperCase()))
      );
    })
    .join(" + ");
};

// Number of bars drawn on the canvas. The backend sends 16 log-spaced
// frequency buckets; bars sample them symmetrically so low/mid voice energy
// sits in the middle and highs feather out to the edges — producing the
// clean, symmetric waveform silhouette (rounded pill bars) of the brand mark.
const BAR_COUNT = 15;
const BUCKET_COUNT = 16;

type RGB = [number, number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Read an "r, g, b" CSS custom property into a tuple.
const readRGB = (
  styles: CSSStyleDeclaration,
  name: string,
  fallback: RGB,
): RGB => {
  const raw = styles.getPropertyValue(name).trim();
  if (!raw) return fallback;
  const parts = raw.split(",").map((p) => parseFloat(p));
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return [parts[0], parts[1], parts[2]];
  }
  return fallback;
};

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  const [idleHoverArmed, setIdleHoverArmed] = useState(false);
  const [idleEntryLocked, setIdleEntryLocked] = useState(true);
  const [shortcut, setShortcut] = useState<string>("");
  const [creatorMode, setCreatorMode] = useState(false);
  const [dock, setDock] = useState<"bottom" | "top">("bottom");
  const direction = getLanguageDirection(i18n.language);

  // Load the flow-bar config (dictation shortcut + creator mode) and keep it
  // in sync when settings change (backend emits "flowbar-config-changed").
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await commands.getAppSettings();
        if (res.status === "ok") {
          const binding = res.data.bindings?.transcribe?.current_binding ?? "";
          setShortcut(binding ? formatShortcut(binding) : "");
          setCreatorMode(res.data.creator_mode ?? false);
          const pos = res.data.overlay_position;
          setDock(pos === "top" ? "top" : "bottom");
        }
      } catch {
        /* overlay hint is non-critical; ignore */
      }
    };
    loadConfig();
    let unlisten: (() => void) | undefined;
    listen("flowbar-config-changed", loadConfig).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef<OverlayState>("recording");

  // Theme-driven wave colors, refreshed whenever the theme changes so the
  // monochrome bars match the panel (hunter/teal on light, sage on dark).
  const colorsRef = useRef<{ wave: RGB; top: RGB; glow: RGB }>({
    wave: [31, 61, 51],
    top: [62, 98, 89],
    glow: [199, 123, 63],
  });

  // Latest raw frequency buckets from the backend (0..1 each).
  const bucketsRef = useRef<number[]>(Array(BUCKET_COUNT).fill(0));
  // Spring state per bar: displayed value + velocity.
  const valuesRef = useRef<Float32Array>(new Float32Array(BAR_COUNT));
  const velocitiesRef = useRef<Float32Array>(new Float32Array(BAR_COUNT));
  // Fixed random shimmer phase/frequency per bar so the two halves never
  // mirror perfectly — keeps the motion organic.
  const jitterRef = useRef<{ phase: number[]; freq: number[] }>({
    phase: Array.from({ length: BAR_COUNT }, () => Math.random() * Math.PI * 2),
    freq: Array.from({ length: BAR_COUNT }, () => 2.2 + Math.random() * 2.4),
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const dockClass = dock === "top" ? "dock-top" : "";

  // Sync wave colors from CSS variables; re-read on theme change.
  useEffect(() => {
    const refreshColors = () => {
      const el = rootRef.current ?? document.documentElement;
      const styles = getComputedStyle(el);
      colorsRef.current = {
        wave: readRGB(styles, "--ov-wave", [31, 61, 51]),
        top: readRGB(styles, "--ov-wave-top", [62, 98, 89]),
        glow: readRGB(styles, "--ov-glow", [199, 123, 63]),
      };
    };
    refreshColors();
    window.addEventListener(THEME_CHANGE_EVENT, refreshColors);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, refreshColors);
  }, []);

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenShow = await listen("show-overlay", async (event) => {
        await syncLanguageFromSettings();
        const overlayState = event.payload as OverlayState;
        if (overlayState === "idle") {
          // Native resize events can place a stationary pointer inside the larger
          // idle window. Lock entry until the pointer is confirmed outside.
          setIdleHoverArmed(false);
          setIdleEntryLocked(true);
        } else {
          setIdleHoverArmed(false);
          setIdleEntryLocked(true);
        }
        stateRef.current = overlayState;
        setState(overlayState);
        setIsVisible(true);
      });

      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
        setIdleHoverArmed(false);
        setIdleEntryLocked(true);
        bucketsRef.current = Array(BUCKET_COUNT).fill(0);
      });

      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        bucketsRef.current = event.payload as number[];
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

  useEffect(() => {
    if (state !== "idle" || !isVisible) return;

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (!rootRef.current?.matches(":hover")) {
          setIdleEntryLocked(false);
        }
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [state, isVisible]);

  // Canvas animation loop. Springs (stiffness + damping) give the bars a fast
  // attack with a slight overshoot, then a fluid settle — never re-renders React.
  //
  // PERF: the loop only runs while actively recording AND visible. A hidden or
  // idle/persistent flow bar registers no rAF, so it costs zero CPU/GPU while
  // the app sits open in the tray.
  useEffect(() => {
    if (state !== "recording" || !isVisible) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Clear the residual voice glow so transcribing/idle states are flat.
      rootRef.current?.style.setProperty("--level", "0");
      return;
    }

    // Start each recording from a clean spring baseline.
    valuesRef.current.fill(0);
    velocitiesRef.current.fill(0);

    let t0 = performance.now();

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;

      const buckets = bucketsRef.current;
      const values = valuesRef.current;
      const velocities = velocitiesRef.current;
      const jitter = jitterRef.current;
      const recording = stateRef.current === "recording";
      const half = (BAR_COUNT - 1) / 2;

      let energy = 0;
      for (let b = 0; b < buckets.length; b++) {
        if (buckets[b] > energy) energy = buckets[b];
      }
      // High sensitivity: react to quiet/distant speech, not just close-mic.
      const speaking = energy > 0.008;
      const tSec = now / 1000;

      let loudness = 0;
      for (let i = 0; i < BAR_COUNT; i++) {
        const dist = Math.abs(i - half) / half; // 0 center → 1 edge
        let tgt: number;

        if (recording && speaking) {
          // Sample the log-spaced spectrum: center bars read the low/mid
          // voice fundamentals, edges read the airy highs.
          const pos = Math.pow(dist, 1.3) * (buckets.length - 1);
          const b0 = Math.floor(pos);
          const b1 = Math.min(buckets.length - 1, b0 + 1);
          const frac = pos - b0;
          let v = (buckets[b0] ?? 0) * (1 - frac) + (buckets[b1] ?? 0) * frac;

          // Sensitivity boost: gain + soft compression lifts quiet/distant
          // speech into visible motion while keeping loud peaks from clipping.
          v = Math.pow(Math.min(1, v * 2.6), 0.62);

          // Center-weighted envelope for the classic voice-pill silhouette.
          const envelope =
            0.38 + 0.62 * Math.pow(Math.cos((dist * Math.PI) / 2), 0.7);
          v *= envelope;

          // Organic shimmer so bars never move in lockstep.
          v *= 1 + 0.16 * Math.sin(tSec * jitter.freq[i] + jitter.phase[i]);
          tgt = Math.min(1, v);
        } else if (recording) {
          // No measured speech: show a quiet baseline instead of suggesting
          // that usable audio is arriving when the microphone is silent.
          const centerBias = Math.pow(Math.cos((dist * Math.PI) / 2), 0.9);
          tgt = 0.025 + 0.025 * centerBias;
        } else {
          tgt = 0;
        }

        // Spring integration — under-damped for a lively pop on attack.
        velocities[i] += (tgt - values[i]) * 380 * dt;
        velocities[i] *= Math.exp(-26 * dt);
        values[i] = Math.max(0, Math.min(1.12, values[i] + velocities[i] * dt));
        loudness += values[i];
      }
      loudness /= BAR_COUNT;

      // Drive CSS (rec-dot swell, pill glow) from overall loudness.
      if (rootRef.current) {
        rootRef.current.style.setProperty("--level", loudness.toFixed(3));
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw === 0 || ch === 0) return;
      const pw = Math.round(cw * dpr);
      const ph = Math.round(ch * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const { wave, top } = colorsRef.current;
      const slot = cw / BAR_COUNT;
      // Square-capped instrument bars — flat fills, institutional (1px nib
      // of corner rounding only, matching the 2–4px system radius).
      const barW = Math.max(2, Math.min(3, slot * 0.52));
      const maxH = ch - 2;
      const midY = ch / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        const v = values[i];
        // Minimum height keeps quiet/edge bars as tidy ticks, never slivers.
        const h = Math.max(barW, v * maxH);
        const x = slot * i + (slot - barW) / 2;
        const y = midY - h / 2;

        // Flat two-tone fill: no gradients — base color, with the highlight
        // tone reserved for the loudest moments.
        const hot = v > 0.72;
        const [r, g, b] = hot ? top : wave;

        ctx.globalAlpha = 0.55 + 0.45 * Math.min(1, v * 1.5);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, 1);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [state, isVisible]);

  // Idle Flow Bar: a slim resting handle (Wispr-style) that expands into
  // controls on hover — mic + dictate hint + scratchpad. Docked to a side, the
  // whole thing rotates so the handle and controls read vertically.
  if (state === "idle") {
    const hint = shortcut
      ? t("overlay.tooltip", { shortcut })
      : t("overlay.tooltipNoShortcut");
    return (
      <div
        ref={rootRef}
        dir={direction}
        className={`recording-overlay flow-bar-idle ${idleEntryLocked ? "idle-entry-locked" : ""} ${idleHoverArmed ? "is-hover-armed" : ""} ${dockClass} ${isVisible ? "fade-in" : ""} state-idle`}
        onPointerLeave={() => {
          setIdleHoverArmed(false);
          setIdleEntryLocked(false);
        }}
      >
        {/* Resting handle */}
        <div
          className="flow-idle-handle"
          aria-hidden
          onPointerEnter={() => {
            if (!idleEntryLocked) setIdleHoverArmed(true);
          }}
        />

        {/* Reference-style prompt and controls revealed on hover */}
        <div className="flow-idle-expand">
          <button
            type="button"
            className="flow-hint"
            title={hint}
            onClick={() => {
              commands.flowbarToggleTranscription();
            }}
          >
            {creatorMode ? (
              <span className="flow-attribution">{t("overlay.dictating")}</span>
            ) : (
              <span className="flow-hint-text">
                {t("overlay.dictate")}
                {shortcut && <span className="flow-keys">{shortcut}</span>}
              </span>
            )}
          </button>

          <div className="flow-actions">
            <button
              type="button"
              className="flow-mic"
              title={hint}
              aria-label={hint}
              onClick={() => {
                commands.flowbarToggleTranscription();
              }}
            >
              <Mic size={17} strokeWidth={1.8} />
            </button>

            <button
              type="button"
              className="flow-scratchpad"
              title={t("overlay.scratchpad")}
              aria-label={t("overlay.scratchpad")}
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const result = await commands.openScratchpadWindow();
                  if (result.status === "error") {
                    console.error("Failed to open scratchpad:", result.error);
                  }
                } catch (error) {
                  console.error("Failed to open scratchpad:", error);
                }
              }}
            >
              <NotebookPen size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      dir={direction}
      className={`recording-overlay ${dockClass} ${isVisible ? "fade-in" : ""} state-${state}`}
    >
      <div className="overlay-capsule">
        <div className="overlay-left">
          {state === "recording" ? (
            <span className="rec-dot" aria-hidden />
          ) : (
            <span className="rec-spinner">
              <TranscriptionIcon width={14} height={14} />
            </span>
          )}
        </div>

        <div className="overlay-middle">
          {state === "recording" && (
            <canvas ref={canvasRef} className="wave-canvas" aria-hidden />
          )}
          {state === "transcribing" && (
            <div className="status-text" role="status" aria-live="polite">
              {t("overlay.transcribing")}
              <span className="dots">
                <span />
                <span />
                <span />
              </span>
            </div>
          )}
          {state === "processing" && (
            <div className="status-text" role="status" aria-live="polite">
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
            <button
              type="button"
              className="cancel-button"
              aria-label={t("overlay.cancel")}
              title={t("overlay.cancel")}
              onClick={() => {
                commands.cancelOperation();
              }}
            >
              <CancelIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordingOverlay;
