import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TranscriptionIcon, CancelIcon } from "../components/icons";
import "./RecordingOverlay.css";
import { commands } from "@/bindings";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import { getLanguageDirection } from "@/lib/utils/rtl";

type OverlayState = "recording" | "transcribing" | "processing";

// Number of bars drawn on the canvas. The backend sends 16 log-spaced
// frequency buckets; bars sample them symmetrically so low/mid voice energy
// sits in the middle and highs feather out to the edges.
const BAR_COUNT = 25;
const BUCKET_COUNT = 16;

// Pastel spectrum the bars drift through from left to right.
const PALETTE: [number, number, number][] = [
  [127, 176, 218], // blue
  [148, 168, 214], // periwinkle
  [186, 166, 222], // lilac
  [148, 168, 214],
  [127, 176, 218],
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Per-bar base color, precomputed once.
const BAR_COLORS: [number, number, number][] = Array.from(
  { length: BAR_COUNT },
  (_, i) => {
    const pos = (i / (BAR_COUNT - 1)) * (PALETTE.length - 1);
    const p0 = Math.floor(pos);
    const p1 = Math.min(PALETTE.length - 1, p0 + 1);
    const f = pos - p0;
    return [
      Math.round(lerp(PALETTE[p0][0], PALETTE[p1][0], f)),
      Math.round(lerp(PALETTE[p0][1], PALETTE[p1][1], f)),
      Math.round(lerp(PALETTE[p0][2], PALETTE[p1][2], f)),
    ];
  },
);

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  const direction = getLanguageDirection(i18n.language);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef<OverlayState>("recording");

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
            0.3 + 0.7 * Math.pow(Math.cos((dist * Math.PI) / 2), 0.75);
          v *= envelope;

          // Organic shimmer so bars never move in lockstep.
          v *= 1 + 0.18 * Math.sin(tSec * jitter.freq[i] + jitter.phase[i]);
          tgt = Math.min(1, v);
        } else if (recording) {
          // Idle: two slow traveling waves breathing through the bars.
          tgt =
            0.055 +
            0.045 * (0.5 + 0.5 * Math.sin(tSec * 2.4 - dist * 2.8)) +
            0.02 * Math.sin(tSec * 1.1 + i * 0.7);
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

      const slot = cw / BAR_COUNT;
      const barW = Math.min(3, slot * 0.58);
      const maxH = ch - 3;
      const midY = ch / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        const v = values[i];
        const h = Math.max(2.5, v * maxH);
        const x = slot * i + (slot - barW) / 2;
        const y = midY - h / 2;
        const [r, g, b] = BAR_COLORS[i];

        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, `rgba(${r + 38}, ${g + 30}, ${b + 24}, 1)`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 1)`);

        ctx.globalAlpha = 0.5 + 0.5 * Math.min(1, v * 1.4);
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.65)`;
        ctx.shadowBlur = 10 * Math.min(1, v);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, barW / 2);
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
