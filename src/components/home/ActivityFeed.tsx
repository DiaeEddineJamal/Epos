import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Flag,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  commands,
  events,
  type HistoryEntry,
  type HistoryUpdatePayload,
} from "@/bindings";

const PAGE_SIZE = 40;
const SEARCH_DEBOUNCE_MS = 250;

/** Displayed text for an entry: post-processed output wins when present. */
const displayText = (e: HistoryEntry): string =>
  (e.post_processed_text ?? e.transcription_text ?? "").trim();

/** Local YYYY-MM-DD bucket key for a Unix-seconds timestamp. */
const dayKey = (tsSeconds: number): string => {
  const d = new Date(tsSeconds * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const ActionButton: React.FC<{
  onClick: (e: React.MouseEvent) => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, active, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`p-1.5 rounded-xs flex items-center justify-center transition-colors duration-200 cursor-pointer ${
      active
        ? "text-live"
        : "text-text/40 hover:text-text hover:bg-black/5 dark:hover:bg-bone/[0.06]"
    }`}
  >
    {children}
  </button>
);

interface ActivityFeedProps {
  onRetry: (id: number) => void;
}

/**
 * The dictation activity feed: a searchable, date-grouped list of transcripts
 * with per-row hover actions (copy / flag / edit / re-transcribe / delete).
 * Mirrors the Wispr Flow home feed within the Lumon file-drawer aesthetic.
 */
export const ActivityFeed: React.FC<ActivityFeedProps> = ({ onRetry }) => {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const entriesRef = useRef<HistoryEntry[]>([]);
  const loadingRef = useRef(false);
  const queryRef = useRef("");

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const loadPage = useCallback(async (cursor?: number) => {
    const isFirst = cursor === undefined;
    if (!isFirst && loadingRef.current) return;
    loadingRef.current = true;
    if (isFirst) setLoading(true);
    try {
      const result = await commands.getHistoryEntries(cursor ?? null, PAGE_SIZE);
      if (result.status === "ok") {
        const { entries: fresh, has_more } = result.data;
        setEntries((prev) => (isFirst ? fresh : [...prev, ...fresh]));
        setHasMore(has_more);
      }
    } catch (e) {
      console.error("Failed to load activity:", e);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // Debounced search: empty query returns to the paginated feed.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const result = await commands.searchHistory(trimmed, 100);
        // Ignore stale responses if the query changed meanwhile.
        if (queryRef.current.trim() !== trimmed) return;
        if (result.status === "ok") {
          setEntries(result.data);
          setHasMore(false);
        }
      } catch (e) {
        console.error("Search failed:", e);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const clearSearch = () => {
    setQuery("");
    setSearching(false);
    setHasMore(true);
    loadPage();
  };

  // Infinite scroll (disabled while searching)
  useEffect(() => {
    if (loading || searching) return;
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (obs) => {
        if (obs[0].isIntersecting) {
          const last = entriesRef.current[entriesRef.current.length - 1];
          if (last) loadPage(last.id);
        }
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, searching, hasMore, loadPage]);

  // Live updates from the transcription pipeline.
  useEffect(() => {
    const unlisten = events.historyUpdatePayload.listen((event) => {
      const payload: HistoryUpdatePayload = event.payload;
      if (payload.action === "added") {
        // Only prepend to the live feed, not to an active search result set.
        if (!queryRef.current.trim()) {
          setEntries((prev) => [payload.entry, ...prev]);
        }
      } else if (payload.action === "updated") {
        setEntries((prev) =>
          prev.map((e) => (e.id === payload.entry.id ? payload.entry : e)),
        );
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const toggleFlag = async (id: number) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, saved: !e.saved } : e)),
    );
    const result = await commands.toggleHistoryEntrySaved(id);
    if (result.status !== "ok") {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, saved: !e.saved } : e)),
      );
    }
  };

  const deleteEntry = async (id: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const result = await commands.deleteHistoryEntry(id);
    if (result.status !== "ok") loadPage();
  };

  const saveEdit = async (id: number, text: string) => {
    const result = await commands.updateHistoryEntryText(id, text);
    if (result.status === "ok") {
      setEntries((prev) =>
        prev.map((e) => (e.id === result.data.entry.id ? result.data.entry : e)),
      );
      if (result.data.added_words.length > 0) {
        toast.success(
          t("settings.system.addedToDictionary", {
            count: result.data.added_words.length,
            words: result.data.added_words.join(", "),
          }),
        );
      }
    } else {
      toast.error(t("home.activity.editError", { defaultValue: "Edit failed" }));
    }
  };

  // Group entries by local calendar day, preserving order.
  const groups = useMemo(() => {
    const now = new Date();
    const todayKey = dayKey(Math.floor(now.getTime() / 1000));
    const yesterdayKey = dayKey(
      Math.floor(now.getTime() / 1000) - 24 * 60 * 60,
    );
    const out: { key: string; label: string; items: HistoryEntry[] }[] = [];
    let current: { key: string; label: string; items: HistoryEntry[] } | null =
      null;
    for (const entry of entries) {
      const k = dayKey(entry.timestamp);
      if (!current || current.key !== k) {
        const label: string =
          k === todayKey
            ? t("home.activity.today")
            : k === yesterdayKey
              ? t("home.activity.yesterday")
              : new Intl.DateTimeFormat(i18n.language, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                }).format(new Date(entry.timestamp * 1000));
        current = { key: k, label, items: [] };
        out.push(current);
      }
      current.items.push(entry);
    }
    return out;
  }, [entries, t, i18n.language]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-text/45">
          {t("home.activity.title")}
        </h2>
        <div className="relative w-64 max-w-[50%]">
          <Search
            size={14}
            strokeWidth={1.75}
            className="absolute start-2.5 top-1/2 -translate-y-1/2 text-text/35 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("home.activity.search")}
            className="w-full bg-background-ui border hairline rounded-sm ps-8 pe-8 py-1.5 text-[13px] text-text placeholder:text-text/35 focus:outline-none focus:border-live/50 transition-colors duration-300"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label={t("home.activity.searchClear")}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-text/40 hover:text-text cursor-pointer"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel rounded-sm overflow-hidden">
        {loading ? (
          <p className="px-4 py-8 text-center text-text/50 text-[14px]">
            {t("home.activity.loading")}
          </p>
        ) : entries.length === 0 ? (
          <p className="px-4 py-10 text-center text-text/50 text-[14px]">
            {searching
              ? t("home.activity.emptySearch")
              : t("home.activity.empty")}
          </p>
        ) : (
          <>
            {groups.map((group) => (
              <div key={group.key}>
                <div className="sticky top-0 z-[1] px-4 py-2 bg-background-ui/90 backdrop-blur-[2px] border-b hairline">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text/45">
                    {group.label}
                  </span>
                </div>
                <div className="divide-y divide-(--color-hairline)">
                  {group.items.map((entry) => (
                    <ActivityRow
                      key={entry.id}
                      entry={entry}
                      onCopy={() => displayText(entry)}
                      onToggleFlag={() => toggleFlag(entry.id)}
                      onDelete={() => deleteEntry(entry.id)}
                      onRetry={() => onRetry(entry.id)}
                      onSaveEdit={(text) => saveEdit(entry.id, text)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {!searching && <div ref={sentinelRef} className="h-1" />}
          </>
        )}
      </div>
    </section>
  );
};

interface ActivityRowProps {
  entry: HistoryEntry;
  onCopy: () => string;
  onToggleFlag: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onSaveEdit: (text: string) => void;
}

const ActivityRow: React.FC<ActivityRowProps> = ({
  entry,
  onCopy,
  onToggleFlag,
  onDelete,
  onRetry,
  onSaveEdit,
}) => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const text = displayText(entry);
  const hasText = text.length > 0;

  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(entry.timestamp * 1000)),
    [entry.timestamp, i18n.language],
  );

  // Close the kebab menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleCopy = async () => {
    if (!hasText) return;
    try {
      await navigator.clipboard.writeText(onCopy());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const beginEdit = () => {
    setDraft(text);
    setEditing(true);
    setMenuOpen(false);
  };

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== text) onSaveEdit(trimmed);
    setEditing(false);
  };

  return (
    <div className="group relative px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-bone/[0.02] transition-colors duration-200">
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5 font-mono text-[11px] tabular-nums tracking-wide text-text/40 w-16">
          {time}
        </span>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(false);
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey))
                    commitEdit();
                }}
                aria-label={t("home.activity.editPlaceholder")}
                className="w-full min-h-[4.5rem] bg-background border hairline rounded-sm p-2.5 text-[14px] leading-relaxed text-text resize-y focus:outline-none focus:border-live/50"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={commitEdit}
                  className="lumon-press px-2.5 py-1 rounded-xs border border-live/40 text-[11px] uppercase tracking-wider text-live hover:bg-live/5 cursor-pointer"
                >
                  {t("home.activity.save")}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-2.5 py-1 rounded-xs text-[11px] uppercase tracking-wider text-text/50 hover:text-text cursor-pointer"
                >
                  {t("home.activity.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <p
              className={`text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                hasText
                  ? "text-text/90 select-text cursor-text"
                  : "text-text/30 italic"
              }`}
            >
              {hasText ? text : t("home.activity.empty_word")}
            </p>
          )}
        </div>

        {/* Hover actions */}
        {!editing && (
          <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
            <ActionButton
              onClick={handleCopy}
              title={copied ? t("home.activity.copied") : t("home.activity.copy")}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </ActionButton>
            <ActionButton
              onClick={() => onToggleFlag()}
              active={entry.saved}
              title={entry.saved ? t("home.activity.unflag") : t("home.activity.flag")}
            >
              <Flag size={15} fill={entry.saved ? "currentColor" : "none"} />
            </ActionButton>
            <div className="relative" ref={menuRef}>
              <ActionButton
                onClick={() => setMenuOpen((v) => !v)}
                active={menuOpen}
                title={t("home.activity.menu")}
              >
                <MoreHorizontal size={15} />
              </ActionButton>
              {menuOpen && (
                <div className="absolute end-0 top-full mt-1 z-20 min-w-40 py-1 bg-surface border hairline rounded-sm">
                  <MenuItem
                    icon={<Pencil size={14} />}
                    label={t("home.activity.edit")}
                    onClick={beginEdit}
                    disabled={!hasText}
                  />
                  <MenuItem
                    icon={<RotateCcw size={14} />}
                    label={t("home.activity.retry")}
                    onClick={() => {
                      onRetry();
                      setMenuOpen(false);
                    }}
                  />
                  <MenuItem
                    icon={<Trash2 size={14} />}
                    label={t("home.activity.delete")}
                    danger
                    onClick={() => {
                      onDelete();
                      setMenuOpen(false);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}> = ({ icon, label, onClick, disabled, danger }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-start transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
      danger
        ? "text-amber-deep dark:text-amber-dark hover:bg-amber-deep/5"
        : "text-text/70 hover:text-text hover:bg-black/5 dark:hover:bg-bone/5"
    }`}
  >
    {icon}
    <span className="uppercase tracking-wide">{label}</span>
  </button>
);
