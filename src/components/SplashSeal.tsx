import React, { useEffect, useRef } from "react";

/**
 * One-shot cold-boot seal for the splash screen — intentionally distinct from
 * the looping sidebar `EposAsciiMark`. Calibrates an optical persona terminal,
 * assembles the EPOS wordmark, then locks the identity with a phosphor bloom.
 */

const W = 48;
const H = 17;

const pad = (line: string) => {
  const trimmed = line.slice(0, W);
  return trimmed + " ".repeat(Math.max(0, W - trimmed.length));
};

const frame = (...lines: string[]) => lines.map(pad).join("\n");

const KEYFRAMES: string[] = [
  // 0 — void
  frame("", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""),
  // 1 — EPOS resolves from four optical channels
  frame(
    "",
    "       █████  █████   ████   █████",
    "       █      █   █  █    █  █",
    "       ████   █████  █    █  █████",
    "       █      █      █    █      █",
    "       █████  █       ████   █████",
    "",
    "        01 ───── 73 ───── 14 ───── 23",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ),
  // 2 — the letterforms stretch into an optical slit
  frame(
    "",
    "          · E ·  P ·  O ·  S ·",
    "             ╲    │    │    ╱",
    "        ╭─────╲───┴────┴───╱─────╮",
    "     ◇──┤       ╲        ╱        ├──◇",
    "        │        ╲  ◇   ╱         │",
    "     01 ├─────────╲────╱──────────┤ 73",
    "        │         ╱    ╲          │",
    "     ◇──┤        ╱      ╲         ├──◇",
    "        ╰───────╱────────╲────────╯",
    "             APERTURE 01",
    "",
    "",
    "",
    "",
    "",
    "",
  ),
  // 3 — a detailed eye opens with its pupil left of centre
  frame(
    "",
    "             · OPTICAL FILE 01 ·",
    "       ╭──────────────────────────────╮",
    "   ╭───╯    ╭────────────────╮      ╰───╮",
    " ◇─┤     ╭──┤  · · · · · ·   ├──╮       ├─◇",
    "   │   ╭─┤  │   ╭────────╮   │  ├─╮     │",
    "01 ├───┤ │  │  ◉│ ●      │   │  │ ├─────┤ 73",
    "   │   ╰─┤  │   ╰────────╯   │  ├─╯     │",
    " ◇─┤     ╰──┤  · · · · · ·   ├──╯       ├─◇",
    "   ╰───╮    ╰────────────────╯      ╭───╯",
    "       ╰──────────────────────────────╯",
    "             EPOS / IRIS LIVE",
    "",
    "",
    "",
    "",
  ),
  // 4 — the pupil tracks right as the channels become data
  frame(
    "",
    "             · OPTICAL FILE 01 ·",
    "       ╭──────────────────────────────╮",
    "   ╭───╯ 01 ╭────────────────╮ 73   ╰───╮",
    " ◇─┤ 14  ╭──┤  0 1 0 1 0 1   ├──╮ 23    ├─◇",
    "   │ 01╭─┤  │   ╭────────╮   │  ├─╮14   │",
    "01 ├───┤ │0 │     ◉   ●  │ 1 │  │ ├─────┤ 73",
    "   │ 73╰─┤  │   ╰────────╯   │  ├─╯01   │",
    " ◇─┤ 23  ╰──┤  1 4 2 3 7 3   ├──╯ 73    ├─◇",
    "   ╰───╮ 01 ╰────────────────╯ 14   ╭───╯",
    "       ╰──────────────────────────────╯",
    "             EPOS / IRIS LIVE",
    "",
    "",
    "",
    "",
  ),
  // 5 — the eye dissolves into the inter-department macrodata field
  frame(
    "01 73 14 23 01 01 73 14 23 01 73 14 23",
    "7  2  9  4  1  8  3  6  0  5  2  7  1",
    "3  8  1  0  6  4  9  2  7  1  4  3  8",
    "5  1  4  7  0  3  8  6  2  9  1  5  4",
    "0  6  2  9  4  7  1  3  8  0  6  2  9",
    "8  3  7  1  5  0  4  9  2  8  3  7  1",
    "2  9  0  6  3  8  5  1  7  2  9  0  6",
    "4  7  5  2  9  1  6  8  3  4  7  5  2",
    "1  0  8  3  7  5  2  4  9  1  0  8  3",
    "6  4  3  8  2  9  0  7  5  6  4  3  8",
    "",
    "          E P O S  /  REFINEMENT",
    "         SIGNAL ACCEPTED · 1423",
    "",
    "",
  ),
];

const SEGMENTS: {
  from: number;
  to: number;
  morphMs: number;
  holdMs: number;
}[] = [
  { from: 0, to: 1, morphMs: 520, holdMs: 180 },
  { from: 1, to: 2, morphMs: 560, holdMs: 120 },
  { from: 2, to: 3, morphMs: 620, holdMs: 260 },
  { from: 3, to: 4, morphMs: 420, holdMs: 260 },
  { from: 4, to: 5, morphMs: 680, holdMs: 760 },
];

const TOTAL_MS = SEGMENTS.reduce((s, seg) => s + seg.morphMs + seg.holdMs, 0);

const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

const CALIBRATION_GLYPHS = ["·", ":", "│", "─", "◇", "+"] as const;

/** Radial iris morph with a narrow calibration-noise frontier. It resolves
 * from the optical center, unlike the sidebar's quiet diagonal wipe. */
const morphGlyphs = (a: string, b: string, t: number): string => {
  const ease = smoothstep(t);
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  const maxDist = Math.hypot(cx, cy);
  let out = "";
  for (let i = 0; i < a.length; i++) {
    const ca = a[i];
    const cb = b[i] ?? ca;
    if (ca === "\n") {
      out += "\n";
      continue;
    }
    const col = i % (W + 1);
    const row = Math.floor(i / (W + 1));
    const dist = Math.hypot(col - cx, row - cy) / maxDist;
    const threshold = dist * 0.85;
    if (ease >= threshold) {
      out += cb;
    } else if (ease >= threshold - 0.16 && ca !== cb && cb !== " ") {
      const glyphIndex =
        Math.abs(
          Math.floor(col * 3 + row * 5 + t * CALIBRATION_GLYPHS.length * 4),
        ) % CALIBRATION_GLYPHS.length;
      out += CALIBRATION_GLYPHS[glyphIndex];
    } else {
      out += ca;
    }
  }
  return out;
};

interface SplashSealProps {
  className?: string;
}

export const SplashSeal: React.FC<SplashSealProps> = ({ className = "" }) => {
  const preRef = useRef<HTMLPreElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pre = preRef.current;
    const root = rootRef.current;
    if (!pre || !root) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      pre.textContent = KEYFRAMES[5];
      root.style.setProperty("--splash-glow", "1");
      root.style.setProperty("--splash-bloom", "1");
      root.style.setProperty("--splash-scan", "0");
      return;
    }

    let raf = 0;
    const start = performance.now();
    let lastText = "";
    let paused = document.hidden;

    const paint = (now: number) => {
      if (paused) return;
      const elapsed = now - start;

      if (elapsed >= TOTAL_MS) {
        pre.textContent = KEYFRAMES[5];
        root.style.setProperty("--splash-glow", "1");
        root.style.setProperty("--splash-bloom", "1");
        root.style.setProperty("--splash-scan", "0.15");
        root.classList.add("is-resolved");
        return;
      }

      raf = requestAnimationFrame(paint);

      let cursor = 0;
      let text = KEYFRAMES[0];
      let bloom = 0;
      let scan = 0;

      for (let s = 0; s < SEGMENTS.length; s++) {
        const seg = SEGMENTS[s];
        const morphEnd = cursor + seg.morphMs;
        const holdEnd = morphEnd + seg.holdMs;

        if (elapsed < morphEnd) {
          const local = (elapsed - cursor) / seg.morphMs;
          text = morphGlyphs(KEYFRAMES[seg.from], KEYFRAMES[seg.to], local);
          bloom = seg.to === 5 ? smoothstep(local) : local * 0.35;
          scan = 0.55 + 0.45 * Math.sin(local * Math.PI);
          break;
        }

        if (elapsed < holdEnd) {
          text = KEYFRAMES[seg.to];
          bloom = seg.to === 5 ? 1 : 0.2;
          scan = seg.to === 5 ? 0.2 : 0.4;
          break;
        }

        cursor = holdEnd;
      }

      if (text !== lastText) {
        pre.textContent = text;
        lastText = text;
      }

      const tSec = (now - start) / 1000;
      const flicker = 0.92 + 0.08 * Math.sin(tSec * 11.0);
      root.style.setProperty(
        "--splash-glow",
        (flicker * (0.75 + 0.25 * bloom)).toFixed(3),
      );
      root.style.setProperty("--splash-bloom", bloom.toFixed(3));
      root.style.setProperty("--splash-scan", scan.toFixed(3));
    };

    const onVisibility = () => {
      paused = document.hidden;
      cancelAnimationFrame(raf);
      if (!paused && performance.now() - start < TOTAL_MS) {
        raf = requestAnimationFrame(paint);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`epos-splash-seal relative select-none pointer-events-none ${className}`}
      aria-hidden
      style={
        {
          "--splash-glow": 0.7,
          "--splash-bloom": 0,
          "--splash-scan": 0.4,
        } as React.CSSProperties
      }
    >
      <pre
        ref={preRef}
        className="epos-splash-seal-pre font-mono m-0 whitespace-pre text-center leading-[1.12] tracking-[0.05em]"
      />
    </div>
  );
};

export default SplashSeal;
