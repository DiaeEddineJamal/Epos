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
    <div className="space-y-2">
      {title && (
        <div className="px-4">
          <h2 className="text-[0.65rem] font-bold text-text/60 uppercase tracking-[0.15em] mb-1">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-text/50 mt-1">{description}</p>
          )}
        </div>
      )}
      <div className={`${getBgClass()} relative border border-primary/10 rounded-xl overflow-visible transition-all duration-200 ease-out shadow-sm`}>
        <div className="divide-y divide-primary/5 overflow-visible">{children}</div>
      </div>
    </div>
  );
};
