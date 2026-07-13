import React, { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettings } from "../hooks/useSettings";
import { SECTIONS_CONFIG, type SidebarSection } from "./Sidebar";
import { EposAsciiMark } from "./EposAsciiMark";

interface TopNavProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

const STORAGE_KEY = "epos-sidebar-collapsed";

// Stable Lumon-style "file designations" — the index is fixed to the section's
// position in the full config, so a section keeps its number even when optional
// sections (post-processing, debug) are hidden.
const DESIGNATIONS = Object.keys(SECTIONS_CONFIG) as SidebarSection[];
export const designationOf = (id: SidebarSection) =>
  String(DESIGNATIONS.indexOf(id) + 1).padStart(2, "0");

/**
 * Lumon department directory — a collapsible vertical elevator-panel rail
 * with roomy department rows and an animated EPOS ASCII seal in the leftover
 * terminal space beneath the register.
 */
export const TopNav: React.FC<TopNavProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore quota / private mode */
    }
  }, [collapsed]);

  const available = Object.entries(SECTIONS_CONFIG)
    .filter(([, config]) => config.enabled(settings))
    .map(([id, config]) => ({ id: id as SidebarSection, ...config }));

  return (
    <nav
      aria-label={t("sidebar.directory")}
      data-collapsed={collapsed ? "true" : "false"}
      className={`relative shrink-0 flex flex-col border-e hairline bg-background-ui z-20 scanlines overflow-hidden transition-[width] duration-500 ease-lumon ${
        collapsed ? "w-[4.25rem]" : "w-[16rem]"
      }`}
    >
      {/* Directory masthead */}
      <div
        className={`shrink-0 border-b hairline ${
          collapsed ? "px-2 pt-3 pb-2.5" : "px-4 pt-4 pb-3"
        }`}
      >
        {!collapsed ? (
          <>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-text/40">
                {t("sidebar.directory")}
              </p>
              <CollapseButton
                collapsed={collapsed}
                onToggle={() => setCollapsed((v) => !v)}
                label={t("sidebar.collapse")}
              />
            </div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="phosphor-lamp block h-1.5 w-1.5 rounded-[1px]"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-live">
                {t("sidebar.online")}
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2.5">
            <span
              aria-hidden
              className="phosphor-lamp block h-1.5 w-1.5 rounded-[1px]"
            />
            <CollapseButton
              collapsed={collapsed}
              onToggle={() => setCollapsed((v) => !v)}
              label={t("sidebar.expand")}
            />
          </div>
        )}
      </div>

      {/* Department list — compact rows to leave room for the seal */}
      <div
        className={`shrink-0 overflow-y-auto no-scrollbar ${
          collapsed ? "py-1" : "py-1.5"
        }`}
      >
        {available.map((section, index) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              aria-current={isActive ? "page" : undefined}
              title={t(section.labelKey)}
              style={{ animationDelay: `${index * 40}ms` }}
              className={`lumon-press animate-rail-in group relative flex w-full items-stretch gap-0 cursor-pointer border-b hairline text-start ${
                isActive
                  ? "bg-background text-text"
                  : "text-text/55 hover:text-text hover:bg-black/[0.03] dark:hover:bg-bone/[0.04]"
              }`}
            >
              <span
                aria-hidden
                className={`absolute inset-y-0 start-0 w-[2px] transition-opacity duration-300 ${
                  isActive
                    ? "phosphor-lamp opacity-100"
                    : "bg-transparent opacity-0 group-hover:opacity-40 group-hover:bg-live"
                }`}
              />

              <span
                className={`flex shrink-0 items-center justify-center font-mono tabular-nums tracking-wider transition-colors duration-300 ${
                  collapsed
                    ? "w-full py-2.5 text-[12px]"
                    : "w-11 border-e hairline py-2.5 text-[11px]"
                } ${
                  isActive
                    ? "text-live bg-[color-mix(in_srgb,var(--color-live),transparent_92%)]"
                    : "text-text/30"
                }`}
              >
                {collapsed ? (
                  <Icon
                    size={15}
                    strokeWidth={1.5}
                    className={isActive ? "text-live" : "text-text/45"}
                  />
                ) : (
                  designationOf(section.id)
                )}
              </span>

              {!collapsed && (
                <span className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5">
                  <Icon
                    size={14}
                    strokeWidth={1.5}
                    className={`shrink-0 transition-colors duration-300 ${
                      isActive ? "text-live" : "text-text/40"
                    }`}
                  />
                  <span className="truncate text-[11px] font-medium uppercase tracking-[0.14em]">
                    {t(section.labelKey)}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Leftover terminal well — animated EPOS seal (no extra top rule;
          the last department row already draws the separator). */}
      {!collapsed && (
        <div className="flex-1 min-h-[9.5rem] flex items-center justify-center relative overflow-hidden">
          <div className="epos-terminal-well absolute inset-0" aria-hidden />
          <div className="relative z-[1] flex items-center justify-center w-full px-3">
            <EposAsciiMark />
          </div>
        </div>
      )}

      {/* Floor plate */}
      {!collapsed && (
        <div className="shrink-0 border-t hairline px-4 py-2.5">
          <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-text/30 text-center">
            {t("sidebar.floorPlate")}
          </p>
        </div>
      )}
    </nav>
  );
};

interface CollapseButtonProps {
  collapsed: boolean;
  onToggle: () => void;
  label: string;
}

const CollapseButton: React.FC<CollapseButtonProps> = ({
  collapsed,
  onToggle,
  label,
}) => {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="lumon-press flex h-6 w-6 items-center justify-center rounded-xs border hairline text-text/45 hover:text-text hover:bg-background transition-colors duration-300 cursor-pointer"
    >
      <Icon size={14} strokeWidth={1.5} />
    </button>
  );
};
