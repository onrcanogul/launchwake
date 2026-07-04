/**
 * Subtle "used / max" counter for a long textarea. Appears only past 80% of the
 * limit and reserves its row at all times (via `visibility`) so it never shifts
 * layout when it toggles. Tabular numbers, `--tx3` until the limit is exceeded,
 * then `--bad`. Decorative — the input's `maxLength` and the server schema do the
 * actual enforcing — so it's `aria-hidden`.
 */
export function CharCounter({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const show = len >= max * 0.8;
  return (
    <div
      aria-hidden
      style={{
        visibility: show ? "visible" : "hidden",
        textAlign: "right",
        marginTop: 4,
        lineHeight: "14px",
        fontSize: 11,
        fontVariantNumeric: "tabular-nums",
        color: len > max ? "var(--bad)" : "var(--tx3)",
      }}
    >
      {len} / {max}
    </div>
  );
}
