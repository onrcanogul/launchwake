import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";

/** The teal-iconed safety/info note used across screens. */
export function Note({
  children,
  icon = "shield",
  className,
}: {
  children: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  return (
    <div className={["note", className].filter(Boolean).join(" ")}>
      <Icon name={icon} />
      <span>{children}</span>
    </div>
  );
}
