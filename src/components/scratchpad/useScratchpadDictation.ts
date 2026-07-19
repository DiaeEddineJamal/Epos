import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { commands } from "@/bindings";

type Field = "title" | "body";
const IS_FLOATING_SCRATCHPAD = getCurrentWindow().label === "scratchpad";

interface Options {
  titleRef: React.RefObject<HTMLInputElement | null>;
  bodyRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Update the title value (should also mark the note dirty for autosave). */
  setTitle: (value: string) => void;
  /** Update the body value (should also mark the note dirty for autosave). */
  setContent: (value: string) => void;
}

/** Insert `text` at the element's caret, adding a joining space when needed. */
const insertAtCaret = (
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string,
): { value: string; caret: number } => {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  const needsSpace =
    before.length > 0 && !/\s$/.test(before) && !/^\s/.test(text);
  const inserted = (needsSpace ? " " : "") + text;
  return {
    value: before + inserted + after,
    caret: (before + inserted).length,
  };
};

/**
 * Wires a scratchpad surface (in-app page or floating window) as a dictation
 * target: while a title/body field is focused it tells the backend to route
 * finished dictations here (via `set_scratchpad_capture`), and inserts the
 * `scratchpad-insert` payload at the caret. Only the focused webview reacts,
 * so there is never a double insert.
 */
export const useScratchpadDictation = ({
  titleRef,
  bodyRef,
  setTitle,
  setContent,
}: Options) => {
  const focusedRef = useRef<Field | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest setters without re-subscribing the event listener.
  const setters = useRef({ setTitle, setContent });
  setters.current = { setTitle, setContent };

  const onFieldFocus = (field: Field) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    focusedRef.current = field;
    void commands.setScratchpadCapture(true);
  };

  const onFieldBlur = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    // The Flow Bar is a separate webview. Clicking its mic necessarily blurs
    // this popup, but the popup remains the user's intended output target.
    if (IS_FLOATING_SCRATCHPAD) return;
    // Debounce so moving focus between title and body doesn't drop capture.
    blurTimer.current = setTimeout(() => {
      focusedRef.current = null;
      void commands.setScratchpadCapture(false);
    }, 150);
  };

  useEffect(() => {
    const unlisten = listen<string>("scratchpad-insert", (event) => {
      const field = focusedRef.current;
      if (!field) return;
      const el = field === "title" ? titleRef.current : bodyRef.current;
      if (!el) return;
      const { value, caret } = insertAtCaret(el, event.payload);
      if (field === "title") setters.current.setTitle(value);
      else setters.current.setContent(value);
      requestAnimationFrame(() => {
        try {
          el.focus();
          el.setSelectionRange(caret, caret);
        } catch {
          /* element may have unmounted */
        }
      });
    });

    return () => {
      unlisten.then((fn) => fn());
      if (blurTimer.current) clearTimeout(blurTimer.current);
      void commands.setScratchpadCapture(false);
    };
    // Refs are stable; setters are proxied via the setters ref.
  }, [titleRef, bodyRef]);

  return { onFieldFocus, onFieldBlur };
};
