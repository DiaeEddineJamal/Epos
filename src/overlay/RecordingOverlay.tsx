import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TranscriptionIcon, CancelIcon } from "../components/icons";
import "./RecordingOverlay.css";
import { commands } from "@/bindings";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import { getLanguageDirection } from "@/lib/utils/rtl";
import { THEME_CHANGE_EVENT } from "@/lib/theme";

type OverlayState = "recording" | "transcribing" | "processing";

// Number of bars drawn on the canvas. The backend sends 16 log-spaced
// frequency buckets; bars sample them symmetrically so low/mid voice energy
// sits in the middle and highs feather out to the edges — producing the
// clean, symmetric waveform silhouette (rounded pill bars) of the brand mark.
const BAR_COUNT = 23;
const BUCKET_COUNT = 16;

type RGB = [number, number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Read an "r, g, b" CSS custom property into a tuple.
const readRGB = (styles: CSSStyleDeclaration, name: string, fallback: RGB): RGB => {
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
  const direction = getLanguageDirection(i18n.language);

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
        setState(overlayState);
        setIsVisible(true);
      });

      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
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

  // Canvas animation loop. Springs (stiffness + damping) give the bars a fast
  // attack with a slight overshoot, then a fluid settle — never re-renders React.
  useEffect(() => {
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
      const speaking = energy > 0.03;
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

          // Center-weighted envelope for the classic voice-pill silhouette.
          const envelope =
            0.32 + 0.68 * Math.pow(Math.cos((dist * Math.PI) / 2), 0.7);
          v *= envelope;

          // Organic shimmer so bars never move in lockstep.
          v *= 1 + 0.16 * Math.sin(tSec * jitter.freq[i] + jitter.phase[i]);
          tgt = Math.min(1, v);
        } else if (recording) {
          // Idle: a calm symmetric wave breathing through the bars — reads as
          // the resting silhouette of the brand mark.
          const breathe = 0.5 + 0.5 * Math.sin(tSec * 1.6);
          const travel = 0.5 + 0.5 * Math.sin(tSec * 2.2 - dist * 3.0);
          const centerBias = Math.pow(Math.cos((dist * Math.PI) / 2), 0.9);
          tgt =
            0.05 +
            0.11 * centerBias * (0.45 + 0.55 * travel) +
            0.015 * breathe;
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

      const { wave, top, glow } = colorsRef.current;
      const slot = cw / BAR_COUNT;
      // Square-capped instrument bars — flat fills, institutional (1px nib
      // of corner rounding only, matching the 2–4px system radius).
      const barW = Math.max(2.5, Math.min(4, slot * 0.55));
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
        // The only glow in the system: subtle amber halo while recording.
        ctx.shadowColor = `rgba(${glow[0]}, ${glow[1]}, ${glow[2]}, 0.4)`;
        ctx.shadowBlur = 8 * Math.min(1, v);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, 1);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={rootRef}
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
          <canvas ref={canvasRef} className="wave-canvas" aria-hidden />
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
