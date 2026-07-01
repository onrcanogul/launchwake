"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { startCheckout, openPortal } from "@/app/app/settings/actions";
import type { PlanUsage } from "@/lib/billing";

export function BillingPanel({
  usage,
  billingConfigured,
  justUpgraded,
}: {
  usage: PlanUsage;
  billingConfigured: boolean;
  justUpgraded: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pro = usage.plan === "PRO";

  const go = (fn: () => Promise<{ url?: string; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.url) window.location.href = res.url;
      else if (res.error) setError(res.error);
    });
  };

  const planUsage = (used: number, limit: number | null) =>
    limit === null ? `${used} · unlimited` : `${used} / ${limit}`;

  return (
    <>
      <div className="setrow">
        <div className="l">
          <b>{pro ? "Pro" : "Free"}</b>
          <span>
            {pro
              ? "Unlimited projects · unlimited plans"
              : "1 project · 2 distribution plans / month"}
          </span>
        </div>
        {pro ? (
          <button
            className="btn btn-s"
            disabled={pending || !billingConfigured}
            onClick={() => go(openPortal)}
          >
            <Icon name="external" /> Manage billing
          </button>
        ) : (
          <button
            className="btn btn-p"
            disabled={pending}
            onClick={() => go(startCheckout)}
          >
            {pending ? "Redirecting…" : "Upgrade to Pro — $29/mo"}
          </button>
        )}
      </div>

      <div className="setrow">
        <div className="l">
          <b>Usage this month</b>
          <span>
            Plans {planUsage(usage.plansThisMonth, usage.planLimit)} · Projects{" "}
            {planUsage(usage.projectCount, usage.projectLimit)}
          </span>
        </div>
        {!pro &&
          usage.planLimit !== null &&
          usage.plansThisMonth >= usage.planLimit && (
            <span className="badge" style={{ color: "var(--warn)" }}>
              <span className="dot" style={{ background: "var(--warn)" }} />
              limit reached
            </span>
          )}
      </div>

      {justUpgraded && (
        <div
          className="setrow"
          style={{ color: "var(--ok)", fontSize: 12.5 }}
        >
          <div className="l">
            <b style={{ color: "var(--ok)" }}>You&apos;re on Pro 🎉</b>
            <span>
              If the plan still shows Free, the webhook is still processing —
              refresh in a moment.
            </span>
          </div>
        </div>
      )}

      {!billingConfigured && !pro && (
        <div className="setrow">
          <span style={{ color: "var(--tx3)", fontSize: 11.5 }}>
            Billing isn&apos;t configured on this deployment (set
            STRIPE_SECRET_KEY). Entitlement limits still apply.
          </span>
        </div>
      )}
      {error && (
        <div className="setrow">
          <span style={{ color: "var(--bad)", fontSize: 12 }}>{error}</span>
        </div>
      )}
    </>
  );
}
