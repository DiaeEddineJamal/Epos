import React, { useEffect, useState } from "react";

/**
 * Lumon-style terminal ASCII mark — cycles through a boot/scan loop that
 * paints the EPOS wordmark the way MDR terminals draw institutional seals.
 * Decorative only; parent sets aria-hidden.
 */

const FRAMES: string[] = [
  // 0 — blank CRT
  [
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
    "                      ",
  ].join("\n"),

  // 1 — outer seal ring
  [
    "      ·········       ",
    "    ·´         `·     ",
    "   ·             ·    ",
    "  ·               ·   ",
    "  ·               ·   ",
    "   ·             ·    ",
    "    ·.         .·     ",
    "      `·······´       ",
  ].join("\n"),

  // 2 — double ring
  [
    "      ·········       ",
    "    ·´  ·····  `·     ",
    "   ·  ·       ·  ·    ",
    "  ·  ·         ·  ·   ",
    "  ·  ·         ·  ·   ",
    "   ·  ·       ·  ·    ",
    "    ·.  ·····  .·     ",
    "      `·······´       ",
  ].join("\n"),

  // 3 — E forms
  [
    "      ·········       ",
    "    ·´  ·····  `·     ",
    "   ·  · EEEEE ·  ·    ",
    "  ·  ·  E      ·  ·   ",
    "  ·  ·  EEEE   ·  ·   ",
    "   ·  · E     ·  ·    ",
    "    ·.  EEEEE  .·     ",
    "      `·······´       ",
  ].join("\n"),

  // 4 — EP
  [
    "      ·········       ",
    "    ·´═════════`·     ",
    "   · │ E  PPP  │ ·    ",
    "  ·  │ E  P  P │  ·   ",
    "  ·  │ EEEPPP  │  ·   ",
    "   · │ E  P    │ ·    ",
    "    ·.═════════.·     ",
    "      `·······´       ",
  ].join("\n"),

  // 5 — EPO
  [
    "      ·········       ",
    "    ·´═════════`·     ",
    "   · │EP  OOO  │ ·    ",
    "  ·  │EP O   O │  ·   ",
    "  ·  │EP O   O │  ·   ",
    "   · │EP  OOO  │ ·    ",
    "    ·.═════════.·     ",
    "      `·······´       ",
  ].join("\n"),

  // 6 — full EPOS seal
  [
    "      ·········       ",
    "    ·╔═════════╗·     ",
    "   · ║         ║ ·    ",
    "  ·  ║  EPOS   ║  ·   ",
    "  ·  ║  ····   ║  ·   ",
    "   · ║  EPOS   ║ ·    ",
    "    ·╚═════════╝·     ",
    "      `·······´       ",
  ].join("\n"),

  // 7 — phosphor surge
  [
    "      ·········       ",
    "    ·╔═════════╗·     ",
    "   · ║▓▓▓▓▓▓▓▓▓║ ·    ",
    "  ·  ║▓ EPOS  ▓║  ·   ",
    "  ·  ║▓ EPOS  ▓║  ·   ",
    "   · ║▓▓▓▓▓▓▓▓▓║ ·    ",
    "    ·╚═════════╝·     ",
    "      `·······´       ",
  ].join("\n"),

  // 8 — scan bar
  [
    "      ·········       ",
    "    ·╔═════════╗·     ",
    "   · ║         ║ ·    ",
    "  ·  ║▓▓▓▓▓▓▓▓▓║  ·   ",
    "  ·  ║  EPOS   ║  ·   ",
    "   · ║         ║ ·    ",
    "    ·╚═════════╝·     ",
    "      `·······´       ",
  ].join("\n"),

  // 9 — settled institutional seal (hold)
  [
    "      ·········       ",
    "    ·╔═════════╗·     ",
    "   · ║ ······· ║ ·    ",
    "  ·  ║  E P O S║  ·   ",
    "  ·  ║  DICTATE║  ·   ",
    "   · ║ ······· ║ ·    ",
    "    ·╚═════════╝·     ",
    "      `·······´       ",
  ].join("\n"),
];

// Dwell times per frame (ms) — slow institutional CRT cadence.
const DWELLS = [240, 300, 340, 400, 400, 400, 850, 650, 650, 1800];

interface EposAsciiMarkProps {
  className?: string;
}

export const EposAsciiMark: React.FC<EposAsciiMarkProps> = ({
  className = "",
}) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setFrame(9);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = (index: number) => {
      if (cancelled) return;
      setFrame(index);
      const next = (index + 1) % FRAMES.length;
      timer = setTimeout(() => tick(next), DWELLS[index] ?? 500);
    };

    tick(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const status =
    frame < 3 ? "INIT" : frame < 6 ? "BOOT SEQ" : frame < 9 ? "SYNC" : "EPOS · MDR";

  return (
    <div
      className={`epos-ascii relative overflow-hidden select-none pointer-events-none ${className}`}
      aria-hidden
    >
      <div className="epos-ascii-scan" />
      <pre className="epos-ascii-pre font-mono text-live/75 leading-[1.2] tracking-[0.02em] m-0 whitespace-pre text-center">
        {FRAMES[frame]}
      </pre>
      <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.32em] text-text/30 text-center tabular-nums">
        {status}
      </p>
    </div>
  );
};

export default EposAsciiMark;
