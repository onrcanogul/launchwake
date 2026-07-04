import type { ZodError } from "zod";

/**
 * Turn a ZodError into per-field messages a server action can hand back to the
 * UI, so each input can render its own error instead of one opaque banner.
 *
 * - `fieldErrors` is keyed by the top-level path segment (`issue.path[0]`), first
 *   message per field wins — that's the one rendered under the input.
 * - `formError` collects the first issue with no field path (a form-level error),
 *   which the caller can show in the generic banner.
 *
 * Pure and framework-agnostic — unit-tested; reused by the onboarding and
 * new-ship actions.
 */
export function fieldErrorsFromZod(error: ZodError): {
  fieldErrors: Record<string, string>;
  formError?: string;
} {
  const fieldErrors: Record<string, string> = {};
  let formError: string | undefined;
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    } else if (!formError) {
      formError = issue.message;
    }
  }
  return { fieldErrors, formError };
}
