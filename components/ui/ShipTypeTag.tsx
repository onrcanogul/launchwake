export type ShipTypeValue = "LAUNCH" | "FEATURE" | "BLOG" | "OTHER";

const CLASS: Record<ShipTypeValue, string> = {
  LAUNCH: "t-launch",
  FEATURE: "t-feat",
  BLOG: "t-blog",
  OTHER: "t-other",
};

const LABEL: Record<ShipTypeValue, string> = {
  LAUNCH: "Launch",
  FEATURE: "Feature",
  BLOG: "Blog",
  OTHER: "Other",
};

export function ShipTypeTag({ type }: { type: ShipTypeValue }) {
  return <span className={`tag-t ${CLASS[type]}`}>{LABEL[type]}</span>;
}
