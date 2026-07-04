import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import type { StageState } from "@/lib/launchMode";

/** The Launch Mode progress rail — a stepper across the guided launch stages. */
export function LaunchModeRail({ stages }: { stages: StageState[] }) {
  const doneCount = stages.filter((s) => s.done).length;
  return (
    <nav className="lm-rail" aria-label="Launch progress">
      <div className="lm-rail-head">
        <span className="lm-rail-title">Launch Mode</span>
        <span className="lm-rail-count num">
          {doneCount}/{stages.length}
        </span>
      </div>
      <ol className="lm-steps">
        {stages.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={[
                "lm-step",
                s.done ? "done" : "",
                s.current ? "on" : "",
              ].join(" ")}
              aria-current={s.current ? "step" : undefined}
            >
              <span className="lm-dot">
                <Icon name={(s.done ? "check" : s.icon) as IconName} />
              </span>
              <span className="lm-step-label">{s.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
