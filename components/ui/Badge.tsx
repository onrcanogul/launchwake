import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  accent?: boolean;
  /** Optional leading status dot colour (CSS value). */
  dotColor?: string;
  className?: string;
};

export function Badge({ children, accent, dotColor, className }: BadgeProps) {
  const cls = ["badge", accent ? "ac" : "", className].filter(Boolean).join(" ");
  return (
    <span className={cls}>
      {dotColor && (
        <span className="dot" style={{ background: dotColor }} aria-hidden />
      )}
      {children}
    </span>
  );
}
