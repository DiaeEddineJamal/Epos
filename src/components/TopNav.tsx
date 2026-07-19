import React from "react";
import {
  Archive,
  AudioLines,
  Folder,
  FolderClock,
  FolderOpen,
  Home,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettings } from "../hooks/useSettings";
import { EposAsciiMark } from "./EposAsciiMark";
import {
  NAVIGATION_GROUPS,
  SECTIONS_CONFIG,
  departmentFor,
  designationOf,
  type NavigationDepartment,
  type SidebarSection,
} from "./navigation";

interface CommandDeckProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

const DEPARTMENT_ICONS = {
  home: Home,
  work: FolderClock,
  voice: AudioLines,
  control: SlidersHorizontal,
  archive: Archive,
} satisfies Record<NavigationDepartment, LucideIcon>;

/**
 * Horizontal Lumon switchboard. Five stable departments remain visible while
 * the second register exposes every page in the active department as a
 * hierarchical MDR-style directory panel.
 */
export const CommandDeck: React.FC<CommandDeckProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const activeDepartment = departmentFor(activeSection);
  const activeGroup =
    NAVIGATION_GROUPS.find((group) => group.id === activeDepartment) ??
    NAVIGATION_GROUPS[0];
  const availableInGroup = activeGroup.sections.filter((section) =>
    SECTIONS_CONFIG[section].enabled(settings),
  );
  const isLeafDepartment = availableInGroup.length <= 1;
  const activeIndex = Math.max(0, availableInGroup.indexOf(activeSection)) + 1;
  const activeLabel = t(SECTIONS_CONFIG[activeSection].labelKey);
  const departmentLabel = t(activeGroup.labelKey);

  const selectDepartment = (department: NavigationDepartment) => {
    const group = NAVIGATION_GROUPS.find(
      (candidate) => candidate.id === department,
    );
    const destination = group?.sections.find((section) =>
      SECTIONS_CONFIG[section].enabled(settings),
    );
    if (destination) onSectionChange(destination);
  };

  return (
    <nav className="command-deck" aria-label={t("navigation.directory")}>
      <button
        type="button"
        className="command-deck-terminal lumon-press"
        onClick={() => onSectionChange("home")}
        aria-label={t("sidebar.home")}
      >
        <EposAsciiMark className="command-deck-ascii" />
      </button>

      <div className="command-deck-main">
        <div className="command-deck-register">
          <div className="command-deck-status" aria-hidden>
            <span className="phosphor-lamp" />
            <span>{t("sidebar.online")}</span>
          </div>

          <div className="command-deck-departments">
            {NAVIGATION_GROUPS.map((group) => {
              const Icon = DEPARTMENT_ICONS[group.id];
              const isActive = group.id === activeDepartment;
              return (
                <button
                  type="button"
                  key={group.id}
                  className="command-deck-department lumon-press"
                  data-active={isActive ? "true" : "false"}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => selectDepartment(group.id)}
                >
                  <Icon size={13} />
                  <span>{t(group.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="command-deck-directory"
          aria-label={t("navigation.pages")}
          data-leaf={isLeafDepartment ? "true" : "false"}
        >
          <div className="command-deck-directory-frame">
            <div className="command-deck-directory-head">
              <span className="command-deck-directory-kicker">
                {t("navigation.directoryPanel", {
                  defaultValue: "Directory map",
                })}
              </span>
              <span className="command-deck-directory-path">
                {departmentLabel}
                {!isLeafDepartment && (
                  <>
                    <span aria-hidden>/</span>
                    {activeLabel}
                  </>
                )}
              </span>
            </div>

            <div className="command-deck-directory-body">
              <div className="command-deck-tree-root" aria-hidden={false}>
                {isLeafDepartment ? (
                  <Folder size={13} strokeWidth={1.6} aria-hidden />
                ) : (
                  <FolderOpen size={13} strokeWidth={1.6} aria-hidden />
                )}
                <span className="command-deck-tree-root-label">
                  {departmentLabel}
                </span>
                <span className="command-deck-tree-root-meta">
                  {t("navigation.sector", { defaultValue: "Sector" })}
                </span>
              </div>

              {!isLeafDepartment && (
                <ul className="command-deck-tree-list">
                  {availableInGroup.map((section, index) => {
                    const config = SECTIONS_CONFIG[section];
                    const Icon = config.icon;
                    const isActive = section === activeSection;
                    const isLast = index === availableInGroup.length - 1;
                    return (
                      <li
                        key={section}
                        className="command-deck-tree-item"
                        data-last={isLast ? "true" : "false"}
                      >
                        <span className="command-deck-tree-rail" aria-hidden />
                        <button
                          type="button"
                          className="command-deck-destination lumon-press"
                          data-active={isActive ? "true" : "false"}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => onSectionChange(section)}
                        >
                          <span className="command-deck-designation">
                            {designationOf(section)}
                          </span>
                          <Icon size={13} strokeWidth={1.6} />
                          <span className="command-deck-destination-label">
                            {t(config.labelKey)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <aside className="command-deck-directory-meta" aria-live="polite">
                <div className="command-deck-meta-block">
                  <span className="command-deck-meta-label">
                    {t("sidebar.file")}
                  </span>
                  <span className="command-deck-meta-value text-live">
                    {designationOf(activeSection)}
                  </span>
                </div>
                <div className="command-deck-meta-block">
                  <span className="command-deck-meta-label">
                    {t("navigation.openFile", { defaultValue: "Open" })}
                  </span>
                  <span className="command-deck-meta-value">{activeLabel}</span>
                </div>
                <div className="command-deck-meta-block">
                  <span className="command-deck-meta-label">
                    {t("navigation.slot", { defaultValue: "Slot" })}
                  </span>
                  <span className="command-deck-meta-value tabular-nums">
                    {String(activeIndex).padStart(2, "0")}/
                    {String(availableInGroup.length).padStart(2, "0")}
                  </span>
                </div>
                <div className="command-deck-meta-block">
                  <span className="command-deck-meta-label">
                    {t("sidebar.refinement")}
                  </span>
                  <span className="command-deck-meta-value command-deck-meta-ready">
                    {t("navigation.ready", { defaultValue: "Ready" })}
                  </span>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export const TopNav = CommandDeck;
