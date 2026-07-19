import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SplashSeal } from "./SplashSeal";

interface SplashScreenProps {
  /** Called once the boot sequence has fully faded out. */
  onDone: () => void;
}

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const HOLD_MS = REDUCED_MOTION ? 500 : 4300;
const FADE_MS = REDUCED_MOTION ? 150 : 480;

const DIGIT_COLS = 16;
const DIGIT_ROWS = 5;
const FILE_NAME = "EPOS";
const BINS = ["01", "02", "03", "04", "05"] as const;

const CURSOR_PATH = [
  { column: 2.2, row: 1.0 },
  { column: 7.4, row: 3.1 },
  { column: 12.8, row: 1.4 },
  { column: 8.2, row: 2.0 },
] as const;

const createDataField = () =>
  Array.from({ length: DIGIT_COLS * DIGIT_ROWS }, (_, index) => {
    const row = Math.floor(index / DIGIT_COLS);
    const column = index % DIGIT_COLS;
    const digit = (index * 7 + row * 3 + column * column + 4) % 10;
    const distance = Math.hypot(
      column - (DIGIT_COLS - 1) / 2,
      row - (DIGIT_ROWS - 1) / 2,
    );
    const scale = 1 + Math.max(0, 4.4 - distance) * 0.28;

    return {
      digit,
      distance,
      scale: scale.toFixed(3),
      delay: `${Math.round(30 + distance * 14 + (index % 7) * 6)}ms`,
    };
  });

/**
 * EPOS cold-boot splash with a dedicated optical-persona ASCII animation
 * (not the sidebar seal) and an MDR magnifying eye sweeping the data field.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone }) => {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);
  const [cursorIndex, setCursorIndex] = useState(0);
  const doneRef = useRef(false);
  const headerProgressRef = useRef<HTMLSpanElement>(null);
  const meterProgressRef = useRef<HTMLSpanElement>(null);
  const progressLabelRef = useRef<HTMLSpanElement>(null);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    window.setTimeout(onDone, FADE_MS);
  };

  useEffect(() => {
    const hold = window.setTimeout(finish, HOLD_MS);
    return () => window.clearTimeout(hold);
  }, []);

  useEffect(() => {
    if (REDUCED_MOTION) {
      if (headerProgressRef.current)
        headerProgressRef.current.style.width = "100%";
      if (meterProgressRef.current)
        meterProgressRef.current.style.width = "100%";
      if (progressLabelRef.current)
        progressLabelRef.current.textContent = "100%";
      return;
    }
    const started = performance.now();
    let raf = 0;
    let lastFrame = 0;
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (now - lastFrame < 1000 / 30) return;
      lastFrame = now;
      const p = Math.min(100, ((now - started) / (HOLD_MS - 200)) * 100);
      if (headerProgressRef.current)
        headerProgressRef.current.style.width = `${p}%`;
      if (meterProgressRef.current)
        meterProgressRef.current.style.width = `${p}%`;
      if (progressLabelRef.current) {
        progressLabelRef.current.textContent = `${Math.round(p)}%`;
      }
      if (p >= 100) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (REDUCED_MOTION) return;
    const id = window.setInterval(() => {
      setCursorIndex((i) => (i + 1) % CURSOR_PATH.length);
    }, 760);
    return () => window.clearInterval(id);
  }, []);

  const position = CURSOR_PATH[cursorIndex] ?? CURSOR_PATH[0];
  const dataField = useMemo(createDataField, []);
  const coordinates = `${String(Math.round(position.column * 4.1)).padStart(
    2,
    "0",
  )}.${String(Math.round(position.row * 9.7)).padStart(2, "0")}.01`;

  return (
    <div
      className={`epos-splash scanlines ${leaving ? "is-leaving" : ""}`}
      role="status"
      aria-label="Epos"
      onClick={finish}
    >
      <div className="epos-splash-grid lumon-grid" aria-hidden />
      <div className="epos-splash-vignette" aria-hidden />

      <div className="epos-splash-mdr" aria-hidden>
        <div className="epos-splash-mdr-header font-mono">
          <span>{FILE_NAME}</span>
          <div className="epos-splash-mdr-progress">
            <span ref={headerProgressRef} />
          </div>
          <span ref={progressLabelRef}>0%</span>
        </div>

        <div className="epos-splash-mdr-field">
          {dataField.map((cell, index) => (
            <span
              key={`${index}`}
              className={`epos-splash-mdr-digit font-mono ${
                cell.distance < 2.4 ? "is-refining" : ""
              }`}
              style={
                {
                  "--mdr-delay": cell.delay,
                  "--mdr-scale": cell.scale,
                } as React.CSSProperties
              }
            >
              {cell.digit}
            </span>
          ))}
          <div
            className="epos-splash-mdr-eye"
            style={
              {
                "--mdr-cursor-x": `${(position.column / (DIGIT_COLS - 1)) * 100}%`,
                "--mdr-cursor-y": `${(position.row / (DIGIT_ROWS - 1)) * 100}%`,
              } as React.CSSProperties
            }
          />
        </div>

        <div className="epos-splash-mdr-footer font-mono">
          <span>{coordinates}</span>
          <div className="epos-splash-mdr-bins">
            {BINS.map((bin, index) => (
              <div key={bin} className="epos-splash-mdr-bin">
                <span>{bin}</span>
                <i
                  style={{
                    height: `${22 + index * 10}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <span>{coordinates}</span>
        </div>
      </div>

      <div className="epos-splash-inner">
        <div className="epos-splash-header font-mono">
          <span className="epos-splash-lamp" aria-hidden />
          <span>{t("splash.division")}</span>
          <span className="epos-splash-rule" aria-hidden />
          <span>{t("splash.ready")}</span>
        </div>

        <div className="epos-splash-mark">
          <SplashSeal />
        </div>

        <p className="epos-splash-tagline">{t("splash.tagline")}</p>

        <div className="epos-splash-meter">
          <div className="epos-splash-bar">
            <span
              ref={meterProgressRef}
              className="epos-splash-bar-fill is-live"
            />
          </div>
          <div className="epos-splash-boot font-mono">
            <span>{t("splash.booting")}</span>
            <span className="epos-splash-cursor" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
