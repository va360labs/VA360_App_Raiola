import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-action text-on-action hover:bg-action-hover active:bg-action-active",
  secondary: "border border-line-strong bg-panel text-ink hover:bg-calm",
  danger: "border border-danger bg-panel text-danger hover:bg-danger-subtle",
  ghost: "text-ink-muted hover:bg-calm hover:text-ink",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition-colors duration-[var(--duration-fast)] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  );
}
