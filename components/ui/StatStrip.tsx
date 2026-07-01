import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";

export type Stat = {
  label: string;
  icon?: IconName;
  value: ReactNode;
  /** small text under the value */
  detail?: ReactNode;
  /** render detail in the "up"/positive accent */
  detailUp?: boolean;
  /** shrink the value font (for text values like a channel name) */
  smallValue?: boolean;
};

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="stats">
      {stats.map((s, i) => (
        <div className="stat" key={i}>
          <div className="l">
            {s.icon && <Icon name={s.icon} />}
            {s.label}
          </div>
          <div
            className={s.smallValue ? "v" : "v num"}
            style={s.smallValue ? { fontSize: 16, marginTop: 4 } : undefined}
          >
            {s.value}
          </div>
          {s.detail !== undefined && (
            <div className={["d", s.detailUp ? "up" : ""].join(" ")}>
              {s.detail}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
