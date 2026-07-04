/**
 * Inline validation hint rendered directly under a form input. Design-system
 * compliant (`.fhint` in the `--bad` accent, no layout shift when absent) and
 * a11y-wired: give the input `aria-describedby={id}` + `aria-invalid` so the
 * message is announced and associated with the field.
 */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="fhint" role="alert" style={{ color: "var(--bad)" }}>
      {message}
    </p>
  );
}
