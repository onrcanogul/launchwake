import type { ReactNode } from "react";

type PanelProps = {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Bordered container with an optional header row (title + right slot). */
export function Panel({ title, right, children, className }: PanelProps) {
  return (
    <div className={["panel", className].filter(Boolean).join(" ")}>
      {(title || right) && (
        <div className="ph">
          {title ? <h2>{title}</h2> : <span />}
          {right && <span className="r">{right}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
