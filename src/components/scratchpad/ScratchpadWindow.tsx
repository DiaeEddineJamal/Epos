import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Check, ChevronDown, Copy, Plus, X } from "lucide-react";
import { commands, type ScratchpadNote } from "@/bindings";
import { useScratchpadDictation } from "./useScratchpadDictation";

const AUTOSAVE_MS = 700;

const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

/**
 * Floating Scratchpad window (opened from the Flow Bar) — a compact,
 * always-on-top note surface you dictate into, à la Wispr Flow. Mounted by
 * `src/scratchpad/main.tsx`; reuses scratchpad_notes + dictation-capture.
 */
export const ScratchpadWindow: React.FC = () => {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<ScratchpadNote[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [copied, setCopied] = useState(false);
  const [picker, setPicker] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;

  const openNote = (note: ScratchpadNote) => {
    setActiveId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setSaveState("idle");
  };

  // Load notes; open the most recent or create a fresh one.
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await commands.listScratchpadNotes();
      if (!alive) return;
      if (res.status === "ok" && res.data.length > 0) {
        setNotes(res.data);
        openNote(res.data[0]);
      } else {
        const created = await commands.createScratchpadNote();
        if (alive && created.status === "ok") {
          setNotes([created.data]);
          openNote(created.data);
        }
      }
      // Focus the body so dictation lands immediately.
      requestAnimationFrame(() => bodyRef.current?.focus());
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback(
    async (id: number, nextTitle: string, nextContent: string) => {
      setSaveState("saving");
      const res = await commands.updateScratchpadNote(id, nextTitle, nextContent);
      if (res.status === "ok") {
        dirtyRef.current = false;
        setNotes((prev) =>
          [...prev.map((n) => (n.id === id ? res.data : n))].sort(
            (a, b) => b.updated_at - a.updated_at,
          ),
        );
        setSaveState("saved");
      } else {
        setSaveState("idle");
      }
    },
    [],
  );

  useEffect(() => {
    if (activeId === null || !dirtyRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () => void persist(activeId, title, content),
      AUTOSAVE_MS,
    );
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, content, activeId, persist]);

  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (dirtyRef.current && activeIdRef.current !== null) {
      void persist(activeIdRef.current, title, content);
    }
  }, [persist, title, content]);

  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const onTitleChange = (v: string) => {
    dirtyRef.current = true;
    setTitle(v);
  };
  const onContentChange = (v: string) => {
    dirtyRef.current = true;
    setContent(v);
  };

  const { onFieldFocus, onFieldBlur } = useScratchpadDictation({
    titleRef,
    bodyRef,
    setTitle: onTitleChange,
    setContent: onContentChange,
  });

  const newNote = async () => {
    flush();
    setPicker(false);
    const res = await commands.createScratchpadNote();
    if (res.status === "ok") {
      setNotes((prev) => [res.data, ...prev]);
      openNote(res.data);
      requestAnimationFrame(() => bodyRef.current?.focus());
    }
  };

  const switchNote = (note: ScratchpadNote) => {
    flush();
    setPicker(false);
    openNote(note);
  };

  const copyNote = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const close = () => {
    flush();
    // Closing destroys the webview, so React cleanup may not run — release the
    // dictation capture flag explicitly to avoid stranding it as true.
    void commands.setScratchpadCapture(false);
    void getCurrentWindow().close();
  };

  const label = useMemo(
    () => title.trim() || t("scratchpad.untitled"),
    [title, t],
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-text border hairline overflow-hidden select-none">
      {/* Drag header */}
      <div
        data-tauri-drag-region
        className="shrink-0 flex items-center justify-between gap-2 px-3 h-9 border-b hairline bg-background-ui"
      >
        <span
          data-tauri-drag-region
          className="font-mono text-[10px] uppercase tracking-[0.24em] text-text/45"
        >
          {t("scratchpad.title")}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={newNote}
            title={t("scratchpad.newNote")}
            aria-label={t("scratchpad.newNote")}
            className="flex h-6 w-6 items-center justify-center rounded-xs text-text/50 hover:text-live hover:bg-black/5 dark:hover:bg-bone/5 cursor-pointer"
          >
            <Plus size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={copyNote}
            title={copied ? t("scratchpad.copied") : t("scratchpad.copy")}
            aria-label={t("scratchpad.copy")}
            className="flex h-6 w-6 items-center justify-center rounded-xs text-text/50 hover:text-text hover:bg-black/5 dark:hover:bg-bone/5 cursor-pointer"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            onClick={close}
            title={t("home.activity.cancel")}
            aria-label={t("home.activity.cancel")}
            className="flex h-6 w-6 items-center justify-center rounded-xs text-text/50 hover:text-amber-deep dark:hover:text-amber-dark hover:bg-amber-deep/5 cursor-pointer"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Note picker */}
      <div className="shrink-0 relative border-b hairline">
        <button
          type="button"
          onClick={() => setPicker((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-start cursor-pointer hover:bg-black/[0.03] dark:hover:bg-bone/[0.03]"
        >
          <span className="truncate text-[12px] font-medium text-text/80">
            {label}
          </span>
          <ChevronDown
            size={14}
            className={`shrink-0 text-text/40 transition-transform duration-200 ${picker ? "rotate-180" : ""}`}
          />
        </button>
        {picker && (
          <div className="absolute left-0 right-0 top-full z-20 max-h-52 overflow-y-auto bg-background-ui border hairline rounded-sm m-1 p-1">
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => switchNote(note)}
                className={`w-full text-start truncate px-2.5 py-1.5 rounded-xs text-[12px] cursor-pointer ${
                  note.id === activeId
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-text/75 hover:bg-background"
                }`}
              >
                {note.title.trim() || t("scratchpad.untitled")}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onFocus={() => onFieldFocus("title")}
        onBlur={onFieldBlur}
        placeholder={t("scratchpad.titlePlaceholder")}
        className="shrink-0 bg-transparent px-4 pt-3 pb-1.5 text-[15px] font-medium text-text placeholder:text-text/35 focus:outline-none"
      />
      <textarea
        ref={bodyRef}
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        onFocus={() => onFieldFocus("body")}
        onBlur={onFieldBlur}
        placeholder={t("scratchpad.contentPlaceholder")}
        className="flex-1 w-full bg-transparent px-4 py-2 text-[14px] leading-relaxed text-text placeholder:text-text/35 resize-none focus:outline-none select-text"
      />

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t hairline">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text/40">
          {t("scratchpad.words", { count: countWords(content) })}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text/40">
          {saveState === "saving"
            ? t("scratchpad.saving")
            : saveState === "saved"
              ? t("scratchpad.saved")
              : ""}
        </span>
      </div>
    </div>
  );
};

export default ScratchpadWindow;
