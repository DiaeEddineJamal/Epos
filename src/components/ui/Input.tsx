import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "compact";
}

export const Input: React.FC<InputProps> = ({
  className = "",
  variant = "default",
  disabled,
  ...props
}) => {
  const baseClasses =
    "px-3 py-2 text-[14px] font-medium bg-surface border border-primary/20 rounded-sm text-text text-start transition-colors duration-200 ease-out placeholder:text-mid-gray/70 shadow-sm";

  const interactiveClasses = disabled
    ? "opacity-50 cursor-not-allowed bg-background-ui border-mid-gray/20 shadow-none"
    : "hover:bg-background-ui hover:border-primary/40 focus:outline-none focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20";

  const variantClasses = {
    default: "px-3 py-2",
    compact: "px-2 py-1",
  } as const;

  return (
    <input
      className={`${baseClasses} ${variantClasses[variant]} ${interactiveClasses} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
};
