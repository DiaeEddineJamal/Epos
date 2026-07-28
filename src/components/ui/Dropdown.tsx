import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  className?: string;
  selectedValue: string | null;
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onRefresh?: () => void;
  /** Render a filter field above the option list. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Copy shown when the filter matches nothing (defaults to the generic empty state). */
  noResultsLabel?: string;
}

interface MenuRect {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "below" | "above";
}

const MENU_GAP = 4;
const MENU_MAX = 272;
/** Floor for the menu box so a cramped viewport still shows a few rows. */
const MENU_MIN = 96;
/** Extra height the search header needs on top of the list. */
const SEARCH_HEADER = 52;

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  className = "",
  placeholder = "Select an option...",
  disabled = false,
  onRefresh,
  searchable = false,
  searchPlaceholder,
  noResultsLabel,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [rect, setRect] = useState<MenuRect | null>(null);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Position the portalled menu against the trigger, flipping above when there
  // is not enough room below. Using viewport coordinates (position: fixed)
  // escapes any ancestor overflow/stacking context.
  const computeRect = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - MENU_GAP;
    const spaceAbove = r.top - MENU_GAP;
    const desired = MENU_MAX + (searchable ? SEARCH_HEADER : 0);
    const placement: "below" | "above" =
      spaceBelow < Math.min(desired, 180) && spaceAbove > spaceBelow
        ? "above"
        : "below";
    const maxHeight = Math.min(
      desired,
      placement === "below" ? spaceBelow : spaceAbove,
    );
    setRect({
      left: r.left,
      top: placement === "below" ? r.bottom + MENU_GAP : r.top - MENU_GAP,
      width: r.width,
      maxHeight: Math.max(MENU_MIN, maxHeight),
      placement,
    });
  }, [searchable]);

  useLayoutEffect(() => {
    if (isOpen) computeRect();
  }, [isOpen, computeRect]);

  // Focus the filter field as soon as the menu mounts so typing just works.
  useEffect(() => {
    if (isOpen && searchable && rect) searchRef.current?.focus();
  }, [isOpen, searchable, rect]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  // Close / reposition on outside interaction, scroll, or resize.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    const handleReposition = (event: Event) => {
      // A scroll inside the menu itself should not close it.
      if (
        event.type === "scroll" &&
        menuRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      computeRect();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", handlePointer);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, computeRect, close]);

  const selectedOption = options.find((o) => o.value === selectedValue);

  const visibleOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, query, searchable]);

  const handleSelect = (value: string) => {
    onSelect(value);
    close();
  };

  const handleToggle = () => {
    if (disabled) return;
    if (isOpen) {
      close();
      return;
    }
    if (onRefresh) onRefresh();
    setIsOpen(true);
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      const first = visibleOptions.find((o) => !o.disabled);
      if (first) handleSelect(first.value);
    } else if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`px-3 py-2 text-[13px] font-medium bg-background border hairline rounded-sm min-w-[220px] w-full text-start flex items-center justify-between transition-colors duration-300 ease-in-out ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:border-primary/40 cursor-pointer focus:ring-1 focus:ring-live"
        }`}
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <svg
          className={`w-4 h-4 ms-2 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen &&
        !disabled &&
        rect &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] bg-background-ui border hairline rounded-sm shadow-sm flex flex-col overflow-hidden"
            style={{
              left: rect.left,
              width: rect.width,
              maxHeight: rect.maxHeight,
              ...(rect.placement === "below"
                ? { top: rect.top }
                : { top: rect.top, transform: "translateY(-100%)" }),
            }}
          >
            {searchable && (
              <div className="shrink-0 p-1 border-b hairline">
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={searchPlaceholder ?? t("common.search")}
                  className="w-full px-2 py-1.5 text-[13px] bg-background border hairline rounded-xs focus:outline-none focus:ring-1 focus:ring-live"
                />
              </div>
            )}

            <div role="listbox" className="flex-1 min-h-0 overflow-y-auto p-1">
              {visibleOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-mid-gray/60 italic text-center">
                  {query.trim()
                    ? (noResultsLabel ?? t("common.noOptionsFound"))
                    : t("common.noOptionsFound")}
                </div>
              ) : (
                visibleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selectedValue === option.value}
                    className={`w-full px-3 py-2 text-[13px] text-start rounded-xs transition-colors duration-300 ease-in-out ${
                      selectedValue === option.value
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-text/80 hover:text-text hover:bg-background"
                    } ${option.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    onClick={() => handleSelect(option.value)}
                    disabled={option.disabled}
                  >
                    <span className="block truncate">{option.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
