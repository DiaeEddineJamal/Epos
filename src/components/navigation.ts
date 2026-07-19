import type { ComponentType } from "react";
import type { AppSettings } from "@/bindings";
import {
  Cog,
  Cpu,
  FlaskConical,
  History,
  Home,
  Info,
  NotebookPen,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  AboutSettings,
  AdvancedSettings,
  DebugSettings,
  GeneralSettings,
  HistorySettings,
  ModelsSettings,
  PostProcessingSettings,
  SystemSettings,
} from "./settings";
import { HomeDashboard } from "./home";
import { ScratchpadPage } from "./scratchpad";

interface SectionConfig {
  labelKey: string;
  icon: LucideIcon;
  component: ComponentType;
  enabled: (settings: AppSettings | null) => boolean;
}

export const SECTIONS_CONFIG = {
  home: {
    labelKey: "sidebar.home",
    icon: Home,
    component: HomeDashboard,
    enabled: () => true,
  },
  general: {
    labelKey: "sidebar.general",
    icon: Settings2,
    component: GeneralSettings,
    enabled: () => true,
  },
  models: {
    labelKey: "sidebar.models",
    icon: Cpu,
    component: ModelsSettings,
    enabled: () => true,
  },
  scratchpad: {
    labelKey: "sidebar.scratchpad",
    icon: NotebookPen,
    component: ScratchpadPage,
    enabled: () => true,
  },
  history: {
    labelKey: "sidebar.history",
    icon: History,
    component: HistorySettings,
    enabled: () => true,
  },
  postprocessing: {
    labelKey: "sidebar.postProcessing",
    icon: Sparkles,
    component: PostProcessingSettings,
    enabled: (settings) => settings?.post_process_enabled ?? false,
  },
  advanced: {
    labelKey: "sidebar.advanced",
    icon: Cog,
    component: AdvancedSettings,
    enabled: () => true,
  },
  system: {
    labelKey: "sidebar.system",
    icon: SlidersHorizontal,
    component: SystemSettings,
    enabled: () => true,
  },
  debug: {
    labelKey: "sidebar.debug",
    icon: FlaskConical,
    component: DebugSettings,
    enabled: (settings) => settings?.debug_mode ?? false,
  },
  about: {
    labelKey: "sidebar.about",
    icon: Info,
    component: AboutSettings,
    enabled: () => true,
  },
} as const satisfies Record<string, SectionConfig>;

export type SidebarSection = keyof typeof SECTIONS_CONFIG;
export type NavigationDepartment =
  | "home"
  | "work"
  | "voice"
  | "control"
  | "archive";

interface NavigationGroup {
  id: NavigationDepartment;
  labelKey: string;
  sections: readonly SidebarSection[];
}

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  {
    id: "home",
    labelKey: "navigation.departments.home",
    sections: ["home"],
  },
  {
    id: "work",
    labelKey: "navigation.departments.work",
    sections: ["history", "scratchpad"],
  },
  {
    id: "voice",
    labelKey: "navigation.departments.voice",
    sections: ["general", "models", "postprocessing"],
  },
  {
    id: "control",
    labelKey: "navigation.departments.control",
    sections: ["advanced", "system"],
  },
  {
    id: "archive",
    labelKey: "navigation.departments.archive",
    sections: ["about", "debug"],
  },
] as const;

const DESIGNATIONS = Object.keys(SECTIONS_CONFIG) as SidebarSection[];

export const designationOf = (id: SidebarSection) =>
  String(DESIGNATIONS.indexOf(id) + 1).padStart(2, "0");

export const departmentFor = (section: SidebarSection): NavigationDepartment =>
  NAVIGATION_GROUPS.find((group) => group.sections.includes(section))?.id ??
  "home";

export const enabledSections = (settings: AppSettings | null) =>
  (Object.keys(SECTIONS_CONFIG) as SidebarSection[]).filter((section) =>
    SECTIONS_CONFIG[section].enabled(settings),
  );
