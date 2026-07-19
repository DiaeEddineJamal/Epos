import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  className = "",
  placeholder = "Select an option...",
  disabled = false,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [rect, setRect] = useState<MenuRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position the portalled menu against the trigger, flipping above when there
  // is not enough room below. Using viewport coordinates (position: fixed)
  // escapes any ancestor overflow/stacking context.
  const computeRect = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - MENU_GAP;
    const spaceAbove = r.top - MENU_GAP;
    const placement: "below" | "above" =
      spaceBelow < Math.min(MENU_MAX, 180) && spaceAbove > spaceBelow
        ? "above"
        : "below";
    const maxHeight = Math.min(
      MENU_MAX,
      placement === "below" ? spaceBelow : spaceAbove,
    );
    setRect({
      left: r.left,
      top: placement === "below" ? r.bottom + MENU_GAP : r.top - MENU_GAP,
      width: r.width,
      maxHeight: Math.max(96, maxHeight),
      placement,
    });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) computeRect();
  }, [isOpen, computeRect]);

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
      setIsOpen(false);
    };
    const handleReposition = (event: Event) => {
      // A scroll inside the menu itself should not close it.
      if (event.type === "scroll" && menuRef.current?.contains(event.target as Node)) {
        return;
      }
      computeRect();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
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
  }, [isOpen, computeRect]);

  const selectedOption = options.find((o) => o.value === selectedValue);

  const handleSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && onRefresh) onRefresh();
    setIsOpen((v) => !v);
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
            role="listbox"
            className="fixed z-[9999] bg-background-ui border hairline rounded-sm overflow-y-auto p-1 shadow-sm"
            style={{
              left: rect.left,
              width: rect.width,
              maxHeight: rect.maxHeight,
              ...(rect.placement === "below"
                ? { top: rect.top }
                : { top: rect.top, transform: "translateY(-100%)" }),
            }}
          >
            {options.length === 0 ? (
              <div className="px-4 py-3 text-sm text-mid-gray/60 italic text-center">
                {t("common.noOptionsFound")}
              </div>
            ) : (
              options.map((option) => (
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
          </div>,
          document.body,
        )}
    </div>
  );
};
