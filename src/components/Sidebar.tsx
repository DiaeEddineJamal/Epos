import React from "react";
import { useTranslation } from "react-i18next";
import EposTextLogo from "./icons/EposTextLogo";
import { useSettings } from "../hooks/useSettings";
import { SECTIONS_CONFIG, type SidebarSection } from "./navigation";

export { SECTIONS_CONFIG, type SidebarSection } from "./navigation";

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();

  const availableSections = Object.entries(SECTIONS_CONFIG)
    .filter(([_, config]) => config.enabled(settings))
    .map(([id, config]) => ({ id: id as SidebarSection, ...config }));

  return (
    <div className="flex flex-col w-60 h-full border-e hairline bg-background-ui items-start px-4 py-7 z-10 shrink-0 transition-colors duration-500 ease-in-out">
      <div className="mb-10 w-full px-1">
        <EposTextLogo className="w-full origin-left scale-95" />
      </div>
      <div className="flex flex-col w-full gap-1">
        {availableSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <div
              key={section.id}
              className={`relative flex gap-3 items-center px-3.5 py-2.5 w-full rounded-sm cursor-pointer border transition-colors duration-300 ease-in-out ${
                isActive
                  ? "bg-background border-(--color-hairline) text-primary"
                  : "border-transparent text-text/70 hover:text-text hover:bg-black/5 dark:hover:bg-bone/5"
              }`}
              onClick={() => onSectionChange(section.id)}
            >
              {isActive && (
                <span className="absolute start-0 top-1/2 -translate-y-1/2 h-4 w-[2px] bg-live" />
              )}
              <Icon
                size={17}
                strokeWidth={1.5}
                className={`shrink-0 transition-colors duration-300 ${isActive ? "text-primary" : "text-text/60"}`}
              />
              <p
                className="text-[11.5px] uppercase tracking-wider truncate font-medium"
                title={t(section.labelKey)}
              >
                {t(section.labelKey)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
