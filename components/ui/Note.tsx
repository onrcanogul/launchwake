import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";

/** The teal-iconed safety/info note used across screens. */
export function Note({
  children,
  icon = "shield",
}: {
  children: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="note">
      <Icon name={icon} />
      <span>{children}</span>
    </div>
  );
}
