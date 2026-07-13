import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "primary-soft"
    | "secondary"
    | "danger"
    | "danger-ghost"
    | "ghost";
  size?: "sm" | "md" | "lg";
}

/**
 * Shared button — flat fill or hairline outline only. No gradients, no
 * shadows, sharp corners, uppercase tracked labels, ease-in-out motion.
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}) => {
  const baseClasses =
    "lumon-press font-medium uppercase tracking-wider rounded-sm border focus:outline-none focus-visible:ring-1 focus-visible:ring-live focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2";

  const variantClasses = {
    // Flat fill: hunter on light, sage on dark (label = canvas color).
    primary:
      "text-background bg-primary border-primary hover:bg-teal hover:border-teal dark:hover:bg-sage-bright dark:hover:border-sage-bright",
    // Outline-only accent.
    "primary-soft":
      "text-primary bg-transparent border-primary/40 hover:border-primary hover:bg-primary/5",
    // Flat panel fill with hairline.
    secondary:
      "text-text bg-background-ui border-hairline hover:border-primary/40",
    // Destructive: amber family (AA-adjusted on light).
    danger:
      "text-bone bg-amber-deep border-amber-deep hover:bg-amber hover:border-amber dark:bg-amber-dark dark:text-forest dark:border-amber-dark dark:hover:bg-amber",
    "danger-ghost":
      "text-amber-deep dark:text-amber-dark bg-transparent border-transparent hover:border-amber-deep/40 dark:hover:border-amber-dark/40",
    ghost:
      "text-mid-gray border-transparent hover:text-text hover:bg-black/5 dark:hover:bg-bone/5",
  };

  const sizeClasses = {
    sm: "px-2.5 py-1 text-[11px]",
    md: "px-4 py-[6px] text-xs",
    lg: "px-5 py-2 text-sm",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
