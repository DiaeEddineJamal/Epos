import React from "react";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  colorVariant?: "white" | "tan" | "green" | "purple" | "blue" | "light-tan";
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
  colorVariant = "white",
}) => {
  const getBgClass = () => {
    switch (colorVariant) {
      case "tan": return "bg-accent-tan";
      case "green": return "bg-secondary";
      case "purple": return "bg-accent-purple";
      case "blue": return "bg-accent-blue";
      case "light-tan": return "bg-background-ui";
      default: return "bg-white";
    }
  };

  return (
    <div className="space-y-2.5">
      {title && (
        <div className="px-1">
          <h2 className="text-[0.7rem] font-bold text-text/55 uppercase tracking-[0.16em]">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-text/50 mt-1">{description}</p>
          )}
        </div>
      )}
      <div className={`${getBgClass()} relative border border-primary/[0.08] rounded-2xl overflow-visible transition-all duration-200 ease-out shadow-[0_1px_2px_rgba(26,26,26,0.04),0_4px_16px_-8px_rgba(26,26,26,0.08)]`}>
        <div className="divide-y divide-primary/[0.06] overflow-visible">{children}</div>
      </div>
    </div>
  );
};
