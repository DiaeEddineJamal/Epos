/**
 * Format an internal shortcut binding string (e.g. "ctrl+shift+space") into a
 * human-readable label (e.g. "Ctrl + Shift + Space"), using platform-aware
 * symbols for modifier keys on macOS.
 */
const SYMBOLS: Record<string, string> = {
  ctrl: "Ctrl",
  control: "Ctrl",
  alt: "Alt",
  option: "Option",
  shift: "Shift",
  cmd: "Cmd",
  command: "Cmd",
  super: "Super",
  meta: "Meta",
  win: "Win",
  space: "Space",
  enter: "Enter",
  return: "Enter",
  escape: "Esc",
  tab: "Tab",
};

const MAC_SYMBOLS: Record<string, string> = {
  ctrl: "⌃",
  control: "⌃",
  alt: "⌥",
  option: "⌥",
  shift: "⇧",
  cmd: "⌘",
  command: "⌘",
  super: "⌘",
  meta: "⌘",
};

export const formatShortcut = (binding: string, isMac = false): string => {
  if (!binding) return "";
  return binding
    .split("+")
    .map((rawPart) => {
      const raw = rawPart.trim();
      const key = raw.toLowerCase();
      if (isMac && MAC_SYMBOLS[key]) return MAC_SYMBOLS[key];
      if (SYMBOLS[key]) return SYMBOLS[key];
      return raw.length === 1
        ? raw.toUpperCase()
        : raw.replace(/^\w/, (c) => c.toUpperCase());
    })
    .join(isMac ? " " : " + ");
};
