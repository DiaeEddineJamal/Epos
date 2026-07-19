import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { commands, type ScratchpadNote } from "@/bindings";
import { useSettings } from "../../hooks/useSettings";
import { useScratchpadDictation } from "./useScratchpadDictation";

const AUTOSAVE_MS = 700;

const countWords = (text: string): number => {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

/**
 * Scratchpad — a persistent notes surface to dictate and draft into. A notes
 * rail on the left, a title+body editor on the right with debounced autosave.
 * Notes persist in history.db via the scratchpad_notes table.
 */
export const ScratchpadPage: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  const [notes, setNotes] = useState<ScratchpadNote[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [copied, setCopied] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const active = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId],
  );

  // Load notes; open the most recent one when "resume last" is enabled.
  useEffect(() => {
    let alive = true;
    commands
      .listScratchpadNotes()
      .then((res) => {
        if (!alive || res.status !== "ok") return;
        setNotes(res.data);
        const resumeLast = getSetting("scratchpad_resume_last") ?? true;
        if (resumeLast && res.data.length > 0) {
          const first = res.data[0];
          setActiveId(first.id);
          setTitle(first.title);
          setContent(first.content);
        }
      })
      .catch((e) => console.error("Failed to load notes:", e));
    return () => {
      alive = false;
    };
    // getSetting is stable; run once on mount.
  }, []);

  const persist = useCallback(
    async (id: number, nextTitle: string, nextContent: string) => {
      setSaveState("saving");
      const res = await commands.updateScratchpadNote(id, nextTitle, nextContent);
      if (res.status === "ok") {
        dirtyRef.current = false;
        // Re-sort by updated_at (most recent first) without disturbing the
        // editor: only touch the list model.
        setNotes((prev) => {
          const updated = prev.map((n) => (n.id === id ? res.data : n));
          return [...updated].sort((a, b) => b.updated_at - a.updated_at);
        });
        setSaveState("saved");
      } else {
        setSaveState("idle");
      }
    },
    [],
  );

  // Debounced autosave whenever title/content change for the active note.
  useEffect(() => {
    if (activeId === null || !dirtyRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist(activeId, title, content);
    }, AUTOSAVE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, content, activeId, persist]);

  // Flush a pending save when switching away or unmounting.
  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (dirtyRef.current && activeIdRef.current !== null) {
      void persist(activeIdRef.current, title, content);
    }
  }, [persist, title, content]);

  // Keep a ref to the latest flush so the unmount cleanup persists the newest
  // title/content rather than a stale closure captured at mount.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    return () => flushRef.current();
  }, []);

  const selectNote = (note: ScratchpadNote) => {
    if (note.id === activeId) return;
    flush();
    setActiveId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setSaveState("idle");
  };

  const newNote = async () => {
    flush();
    const res = await commands.createScratchpadNote();
    if (res.status === "ok") {
      setNotes((prev) => [res.data, ...prev]);
      setActiveId(res.data.id);
      setTitle("");
      setContent("");
      setSaveState("idle");
    }
  };

  const deleteNote = async (id: number) => {
    const res = await commands.deleteScratchpadNote(id);
    if (res.status === "ok") {
      setNotes((prev) => {
        const remaining = prev.filter((n) => n.id !== id);
        if (id === activeIdRef.current) {
          if (remaining.length > 0) {
            const next = remaining[0];
            setActiveId(next.id);
            setTitle(next.title);
            setContent(next.content);
          } else {
            setActiveId(null);
            setTitle("");
            setContent("");
          }
        }
        return remaining;
      });
    }
  };

  const copyNote = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      console.error("Copy failed:", e);
      toast.error(t("home.activity.editError"));
    }
  };

  const onTitleChange = (v: string) => {
    dirtyRef.current = true;
    setTitle(v);
  };
  const onContentChange = (v: string) => {
    dirtyRef.current = true;
    setContent(v);
  };

  // Route dictation into the focused title/body field while this page is open.
  const { onFieldFocus, onFieldBlur } = useScratchpadDictation({
    titleRef,
    bodyRef,
    setTitle: onTitleChange,
    setContent: onContentChange,
  });

  return (
    <div className="max-w-4xl w-full mx-auto flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-[1.4rem] font-medium text-text">
            {t("scratchpad.title")}
          </h1>
          <p className="text-[13px] text-text/50">{t("scratchpad.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[15rem_1fr] gap-4 min-h-[26rem]">
        {/* Notes rail */}
        <div className="glass-panel rounded-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b hairline">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text/45">
              {t("scratchpad.notes")}
            </span>
            <button
              type="button"
              onClick={newNote}
              title={t("scratchpad.newNote")}
              aria-label={t("scratchpad.newNote")}
              className="lumon-press flex h-6 w-6 items-center justify-center rounded-xs border hairline text-text/50 hover:text-live hover:border-live/40 cursor-pointer"
            >
              <Plus size={14} strokeWidth={1.75} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-text/40">
                {t("scratchpad.empty")}
              </p>
            ) : (
              notes.map((note) => {
                const isActive = note.id === activeId;
                const label = note.title.trim() || t("scratchpad.untitled");
                const preview = note.content.trim().slice(0, 48);
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => selectNote(note)}
                    className={`group w-full text-start px-3 py-2.5 border-b hairline cursor-pointer transition-colors duration-200 ${
                      isActive
                        ? "bg-background"
                        : "hover:bg-black/[0.03] dark:hover:bg-bone/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <span className="phosphor-lamp block h-1.5 w-1.5 rounded-[1px] shrink-0" />
                      )}
                      <span
                        className={`truncate text-[13px] font-medium ${
                          isActive ? "text-text" : "text-text/70"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                    {preview && (
                      <p className="mt-0.5 truncate text-[11px] text-text/40">
                        {preview}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="glass-panel rounded-sm flex flex-col overflow-hidden">
          {activeId === null ? (
            <div className="flex-1 flex items-center justify-center px-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <p className="text-[14px] text-text/45">
                  {t("scratchpad.emptyEditor")}
                </p>
                <button
                  type="button"
                  onClick={newNote}
                  className="lumon-press px-3 py-1.5 rounded-xs border border-live/40 text-[11px] uppercase tracking-wider text-live hover:bg-live/5 cursor-pointer flex items-center gap-2"
                >
                  <Plus size={14} strokeWidth={1.75} />
                  {t("scratchpad.newNote")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b hairline">
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  onFocus={() => onFieldFocus("title")}
                  onBlur={onFieldBlur}
                  placeholder={t("scratchpad.titlePlaceholder")}
                  className="flex-1 min-w-0 bg-transparent text-[15px] font-medium text-text placeholder:text-text/35 focus:outline-none"
                />
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-text/40">
                  {saveState === "saving"
                    ? t("scratchpad.saving")
                    : saveState === "saved"
                      ? t("scratchpad.saved")
                      : ""}
                </span>
                <button
                  type="button"
                  onClick={copyNote}
                  title={copied ? t("scratchpad.copied") : t("scratchpad.copy")}
                  aria-label={t("scratchpad.copy")}
                  className="shrink-0 p-1.5 rounded-xs text-text/40 hover:text-text hover:bg-black/5 dark:hover:bg-bone/5 cursor-pointer"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
                <button
                  type="button"
                  onClick={() => active && deleteNote(active.id)}
                  title={t("scratchpad.deleteNote")}
                  aria-label={t("scratchpad.deleteNote")}
                  className="shrink-0 p-1.5 rounded-xs text-text/40 hover:text-amber-deep dark:hover:text-amber-dark hover:bg-amber-deep/5 cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <textarea
                ref={bodyRef}
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                onFocus={() => onFieldFocus("body")}
                onBlur={onFieldBlur}
                placeholder={t("scratchpad.contentPlaceholder")}
                className="flex-1 w-full bg-transparent px-4 py-3.5 text-[15px] leading-relaxed text-text placeholder:text-text/35 resize-none focus:outline-none"
              />
              <div className="px-4 py-2 border-t hairline">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text/40">
                  {t("scratchpad.words", { count: countWords(content) })}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
