import { describe, it, expect } from "vitest";
import { z } from "zod";
import { fieldErrorsFromZod } from "./formErrors";

const Schema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Enter a valid URL"),
});

describe("fieldErrorsFromZod", () => {
  it("keys messages by the offending field", () => {
    const parsed = Schema.safeParse({ name: "", url: "nope" });
    expect(parsed.success).toBe(false);
    const { fieldErrors } = fieldErrorsFromZod(parsed.error!);
    expect(fieldErrors.name).toBe("Name is required");
    expect(fieldErrors.url).toBe("Enter a valid URL");
  });

  it("keeps only the first message per field", () => {
    const Multi = z.object({
      title: z.string().min(3, "Too short").max(5, "Too long"),
    });
    // min(3) fires for "" — only one message per field is retained.
    const { fieldErrors } = fieldErrorsFromZod(Multi.safeParse({ title: "" }).error!);
    expect(fieldErrors.title).toBe("Too short");
  });

  it("collects a form-level issue (empty path) as formError", () => {
    const Refined = z
      .object({ a: z.string(), b: z.string() })
      .refine((v) => v.a === v.b, { message: "a and b must match" });
    const { fieldErrors, formError } = fieldErrorsFromZod(
      Refined.safeParse({ a: "x", b: "y" }).error!,
    );
    expect(Object.keys(fieldErrors)).toHaveLength(0);
    expect(formError).toBe("a and b must match");
  });
});
