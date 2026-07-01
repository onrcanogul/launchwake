import { Icon } from "@/components/Icon";

export type ChecklistItem = {
  title: string;
  hint?: string;
  done: boolean;
};

/** Getting-started checklist for first-run (drives time-to-first-plan). */
export function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className="checklist">
      {items.map((it, i) => (
        <li className={["checkitem", it.done ? "done" : ""].join(" ")} key={i}>
          <span className="cbox">
            {it.done ? <Icon name="check" /> : <span>{i + 1}</span>}
          </span>
          <span className="ctx">
            <b>{it.title}</b>
            {it.hint && <span>{it.hint}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
