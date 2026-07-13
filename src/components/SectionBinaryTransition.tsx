import React from "react";

const COLUMN_COUNT = 22;
const ROW_COUNT = 8;
const FILE_NAME = "SIENA";
const PROGRESS = "76%";
const BINS = ["01", "02", "03", "04", "05"] as const;

const CURSOR_POSITIONS = [
  { column: 4.2, row: 2.1 },
  { column: 9.1, row: 5.2 },
  { column: 14.8, row: 2.4 },
  { column: 18.1, row: 5.4 },
  { column: 6.4, row: 4.3 },
  { column: 12.6, row: 1.7 },
  { column: 16.7, row: 3.6 },
] as const;

const createDataField = (focusColumn: number, focusRow: number) =>
  Array.from({ length: COLUMN_COUNT * ROW_COUNT }, (_, index) => {
    const row = Math.floor(index / COLUMN_COUNT);
    const column = index % COLUMN_COUNT;
    const digit = (index * 7 + row * 3 + column * column + 4) % 10;
    const distance = Math.hypot(column - focusColumn, row - focusRow);
    const scale = 1 + Math.max(0, 4.1 - distance) * 0.24;

    return {
      digit,
      distance,
      scale: scale.toFixed(3),
      delay: `${Math.round(75 + distance * 18 + (index % 5) * 9)}ms`,
    };
  });

interface SectionBinaryTransitionProps {
  sectionIndex: number;
}

/**
 * MDR data-field curtain displayed when a department file changes. Its
 * 22-column decimal field, magnifying cursor, coordinates, progress meter,
 * and five bins mirror the visual grammar of the refinement terminals.
 */
export const SectionBinaryTransition: React.FC<
  SectionBinaryTransitionProps
> = ({ sectionIndex }) => {
  const position =
    CURSOR_POSITIONS[
      Math.abs(sectionIndex) % CURSOR_POSITIONS.length
    ] ?? CURSOR_POSITIONS[0];
  const dataField = createDataField(position.column, position.row);
  const coordinates = `${String(Math.round(position.column * 4.1)).padStart(
    2,
    "0",
  )}.${String(Math.round(position.row * 9.7)).padStart(2, "0")}.${String(
    sectionIndex + 1,
  ).padStart(2, "0")}`;

  return (
    <div className="binary-transition" aria-hidden>
      <div className="mdr-transition-header font-mono">
        <span>{FILE_NAME}</span>
        <div className="mdr-transition-progress">
          <span style={{ width: PROGRESS }} />
        </div>
        <span>{PROGRESS}</span>
      </div>

      <div className="mdr-transition-field">
        {dataField.map((cell, index) => (
          <span
            key={`${cell.digit}-${index}`}
            className={`mdr-transition-digit font-mono ${
              cell.distance < 2.25 ? "is-refining" : ""
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
          className="mdr-transition-cursor"
          style={
            {
              "--mdr-cursor-x": `${(position.column / (COLUMN_COUNT - 1)) * 100}%`,
              "--mdr-cursor-y": `${(position.row / (ROW_COUNT - 1)) * 100}%`,
            } as React.CSSProperties
          }
        />
      </div>

      <div className="mdr-transition-footer font-mono">
        <span className="mdr-transition-coordinates">{coordinates}</span>
        <div className="mdr-transition-bins">
          {BINS.map((bin, index) => (
            <div key={bin} className="mdr-transition-bin">
              <span>{bin}</span>
              <i style={{ height: `${28 + index * 8}%` }} />
            </div>
          ))}
        </div>
        <span className="mdr-transition-coordinates">{coordinates}</span>
      </div>
    </div>
  );
};

export default SectionBinaryTransition;
