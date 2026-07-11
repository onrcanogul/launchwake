import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";

/**
 * The per-tab "what am I looking at" note — the informative layer the demo adds
 * on top of the real screens. One accent-iconed card at the top of each demo tab
 * explaining what the screen does and why it matters. Design-system styling:
 * hairline border, single accent, line icon, no emoji.
 */
export function DemoCallout({
  icon = "wave",
  title,
  children,
}: {
  icon?: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="demo-callout">
      <span className="demo-callout-ic">
        <Icon name={icon} />
      </span>
      <div>
        <div className="demo-callout-t">{title}</div>
        <p className="demo-callout-p">{children}</p>
      </div>
    </div>
  );
}
