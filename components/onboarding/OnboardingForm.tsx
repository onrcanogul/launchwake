"use client";

import { useActionState } from "react";
import { Icon } from "@/components/Icon";
import {
  createProject,
  type OnboardingState,
} from "@/app/onboarding/actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    createProject,
    {},
  );

  return (
    <form action={action}>
      <label className="fl">Product name</label>
      <input className="inp" name="name" placeholder="Hookline" required />

      <label className="fl" style={{ marginTop: 16 }}>
        Product URL{" "}
        <span style={{ color: "var(--tx3)", fontWeight: 400 }}>(recommended)</span>
      </label>
      <input className="inp" name="url" placeholder="https://hookline.dev" />

      <label className="fl" style={{ marginTop: 16 }}>
        GitHub repo{" "}
        <span style={{ color: "var(--tx3)", fontWeight: 400 }}>
          (enables ship auto-detect later)
        </span>
      </label>
      <input className="inp" name="githubRepo" placeholder="owner/repo" />

      <label className="fl" style={{ marginTop: 16 }}>
        What does it do?{" "}
        <span style={{ color: "var(--tx3)", fontWeight: 400 }}>
          (used to match communities)
        </span>
      </label>
      <textarea
        className="inp"
        name="description"
        placeholder="A webhook testing tool for developers — capture, inspect and replay events, and get alerted when an endpoint fails."
      />

      {state.error && (
        <div className="fhint" style={{ marginTop: 10, color: "var(--bad)" }}>
          {state.error}
        </div>
      )}

      <div style={{ display: "flex", gap: 9, marginTop: 22 }}>
        <button type="submit" className="btn btn-p" disabled={pending}>
          <Icon name="arrowRight" />
          {pending ? "Setting up…" : "Analyze my first ship"}
        </button>
      </div>
    </form>
  );
}
