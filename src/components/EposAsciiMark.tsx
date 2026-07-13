import React, { useEffect, useRef } from "react";

/**
 * EPOS refinement seal — an original institutional ASCII emblem inspired by
 * Severance-era terminals. The 60fps loop progressively calibrates, draws,
 * certifies, and resets the mark without a moving scan beam.
 */

const W = 28;
const H = 11;

const pad = (line: string) => {
  const trimmed = line.slice(0, W);
  return trimmed + " ".repeat(Math.max(0, W - trimmed.length));
};

const frame = (...lines: string[]) => lines.map(pad).join("\n");

const KEYFRAMES: string[] = [
  frame(
    "                            ",
    "                            ",
    "                            ",
    "                            ",
    "                            ",
    "                            ",
    "                            ",
    "                            ",
    "                            ",
    "                            ",
    "                            ",
  ),
  frame(
    "          · 01 ·           ",
    "                            ",
    "        ·           ·       ",
    "                            ",
    "    ·           ·           ",
    "              +             ",
    "           ·           ·    ",
    "                            ",
    "       ·           ·        ",
    "                            ",
    "          · 73 ·            ",
  ),
  frame(
    "          · 01 ·           ",
    "       ╭────────────╮       ",
    "     ╭─┤            ├─╮     ",
    "    │  │            │  │    ",
    "   ·   │            │   ·   ",
    "   │   │     +      │   │   ",
    "   ·   │            │   ·   ",
    "    │  │            │  │    ",
    "     ╰─┤            ├─╯     ",
    "       ╰────────────╯       ",
    "          · 73 ·            ",
  ),
  frame(
    "       ··  FILE  01  ··      ",
    "       ╭────────────╮       ",
    "     ╭─┤ REFINEMENT ├─╮     ",
    "    │ ╭┴────────────┴╮ │    ",
    "   ·  │              │  ·   ",
    "   │  │    E P O S   │  │   ",
    "   ·  │              │  ·   ",
    "    │ ╰┬────────────┬╯ │    ",
    "     ╰─┤   1423·MDR  ├─╯     ",
    "       ╰────────────╯       ",
    "        ◇    ◇    ◇         ",
  ),
  frame(
    "       ··  FILE  01  ··      ",
    "       ╭────────────╮       ",
    "     ╭─┤ REFINEMENT ├─╮     ",
    "    │ ╭┴────────────┴╮ │    ",
    "   ◆  │  E  P  O  S  │  ◆   ",
    "   │  │  ▪  ▪  ▪  ▪  │  │   ",
    "   ◆  │   BY LUZIV   │  ◆   ",
    "    │ ╰┬────────────┬╯ │    ",
    "     ╰─┤   1423·MDR  ├─╯     ",
    "       ╰────────────╯       ",
    "        ◇    ◆    ◇         ",
  ),
  // Certified hold state; bloom is handled continuously through CSS variables.
  frame(
    "       ··  FILE  01  ··      ",
    "       ╭────────────╮       ",
    "     ╭─┤ REFINEMENT ├─╮     ",
    "    │ ╭┴────────────┴╮ │    ",
    "   ◆  │  E  P  O  S  │  ◆   ",
    "   │  │  ▰  ▰  ▰  ▰  │  │   ",
    "   ◆  │   BY LUZIV   │  ◆   ",
    "    │ ╰┬────────────┬╯ │    ",
    "     ╰─┤ CERTIFIED  ├─╯     ",
    "       ╰────────────╯       ",
    "        ◇   1423   ◇         ",
  ),
];

/** Segment timeline: morph from → to over `ms`, then optional hold. */
const SEGMENTS: { from: number; to: number; morphMs: number; holdMs: number }[] =
  [
    { from: 0, to: 1, morphMs: 900, holdMs: 200 },
    { from: 1, to: 2, morphMs: 1000, holdMs: 250 },
    { from: 2, to: 3, morphMs: 1100, holdMs: 300 },
    { from: 3, to: 4, morphMs: 1200, holdMs: 400 },
    { from: 4, to: 5, morphMs: 800, holdMs: 2200 },
    { from: 5, to: 0, morphMs: 700, holdMs: 150 },
  ];

const LOOP_MS = SEGMENTS.reduce((s, seg) => s + seg.morphMs + seg.holdMs, 0);

const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Diagonal wipe morph between equal-length ASCII frames. */
const morphGlyphs = (a: string, b: string, t: number): string => {
  const ease = smoothstep(t);
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
    const threshold = (row / (H - 1)) * 0.5 + (col / Math.max(1, W - 1)) * 0.5;
    if (ease >= threshold) {
      out += cb;
    } else if (ease >= threshold - 0.1 && ca !== cb && cb !== " ") {
      out += "·";
    } else {
      out += ca;
    }
  }
  return out;
};

interface EposAsciiMarkProps {
  className?: string;
}

export const EposAsciiMark: React.FC<EposAsciiMarkProps> = ({
  className = "",
}) => {
  const preRef = useRef<HTMLPreElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pre = preRef.current;
    const root = rootRef.current;
    if (!pre || !root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      pre.textContent = KEYFRAMES[4];
      root.style.setProperty("--ascii-glow", "1");
      root.style.setProperty("--ascii-scan", "0.45");
      return;
    }

    let raf = 0;
    const start = performance.now();

    const paint = (now: number) => {
      const elapsed = (now - start) % LOOP_MS;

      let cursor = 0;
      let text = KEYFRAMES[0];
      let bloom = 0;

      for (let s = 0; s < SEGMENTS.length; s++) {
        const seg = SEGMENTS[s];
        const morphEnd = cursor + seg.morphMs;
        const holdEnd = morphEnd + seg.holdMs;

        if (elapsed < morphEnd) {
          const local = (elapsed - cursor) / seg.morphMs;
          text = morphGlyphs(KEYFRAMES[seg.from], KEYFRAMES[seg.to], local);
          if (seg.to === 5) bloom = smoothstep(local);
          else if (seg.from === 5) bloom = 1 - smoothstep(local);
          break;
        }

        if (elapsed < holdEnd) {
          text = KEYFRAMES[seg.to];
          bloom = seg.to === 5 ? 1 : 0;
          break;
        }

        cursor = holdEnd;
      }

      pre.textContent = text;

      // Continuous 60fps CRT effects
      const tSec = (now - start) / 1000;
      const breathe = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(tSec * 1.35));
      const glow = breathe * (0.85 + 0.35 * bloom);

      root.style.setProperty("--ascii-glow", glow.toFixed(3));
      root.style.setProperty("--ascii-bloom", bloom.toFixed(3));

      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={rootRef}
      className={`epos-ascii relative select-none pointer-events-none ${className}`}
      aria-hidden
      style={
        {
          "--ascii-glow": 0.85,
          "--ascii-bloom": 0,
        } as React.CSSProperties
      }
    >
      <pre
        ref={preRef}
        className="epos-ascii-pre font-mono m-0 whitespace-pre text-center leading-[1.15] tracking-[0.04em]"
      />
    </div>
  );
};

export default EposAsciiMark;
