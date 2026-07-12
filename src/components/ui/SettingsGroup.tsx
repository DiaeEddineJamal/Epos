import React from "react";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  /** Legacy prop kept for API compatibility — all panels are flat
   *  cream/forest-light in the brutalist system. */
  colorVariant?: "white" | "tan" | "green" | "purple" | "blue" | "light-tan";
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <div className="space-y-2.5">
      {title && (
        <div className="px-1">
          <h2 className="font-mono text-[0.68rem] font-medium text-mid-gray uppercase tracking-[0.2em]">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-text/50 mt-1 normal-case">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="bg-background-ui relative border hairline rounded-sm overflow-visible transition-colors duration-300 ease-in-out">
        <div className="divide-y divide-(--color-hairline) overflow-visible">
          {children}
        </div>
      </div>
    </div>
  );
};
