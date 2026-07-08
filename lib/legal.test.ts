import { describe, it, expect } from "vitest";
import {
  LEGAL_ENTITY,
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
} from "./legal";
import en from "../messages/en.json";
import tr from "../messages/tr.json";

describe("legal constants", () => {
  it("expose a non-empty entity, a real-looking contact email, and a date", () => {
    expect(LEGAL_ENTITY).toBeTruthy();
    // A monitored inbox must actually ship (Stripe disputes land here) — guard
    // against a placeholder or empty string reaching production.
    expect(LEGAL_CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    expect(LEGAL_LAST_UPDATED).toBeTruthy();
  });
});

describe("legal / trust translations", () => {
  it("footer + login consent keys exist in both locales", () => {
    for (const messages of [en, tr]) {
      expect(messages.Nav.terms).toBeTruthy();
      expect(messages.Nav.privacy).toBeTruthy();
      expect(messages.Login.legal).toBeTruthy();
    }
  });

  it("the login consent line keeps its <terms>/<privacy> link tags so t.rich can render them", () => {
    for (const messages of [en, tr]) {
      expect(messages.Login.legal).toContain("<terms>");
      expect(messages.Login.legal).toContain("</terms>");
      expect(messages.Login.legal).toContain("<privacy>");
      expect(messages.Login.legal).toContain("</privacy>");
    }
  });
});
