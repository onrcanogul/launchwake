import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";

type EmptyStateProps = {
  icon: IconName;
  title: string;
  message: ReactNode;
  actions?: ReactNode;
};

export function EmptyState({ icon, title, message, actions }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="eico">
        <Icon name={icon} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {actions && <div className="eact">{actions}</div>}
    </div>
  );
}
