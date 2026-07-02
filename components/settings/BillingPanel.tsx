"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { startCheckout, startTeamCheckout, openPortal } from "@/app/app/settings/actions";
import type { PlanUsage } from "@/lib/billing";

const PLAN_LABEL: Record<string, string> = { FREE: "Free", PRO: "Pro", TEAM: "Team" };

function dollars(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

export function BillingPanel({
  usage,
  billingConfigured,
  justUpgraded,
  teamPricePerSeatCents,
  teamMinSeats,
  teamMaxSeats,
}: {
  usage: PlanUsage;
  billingConfigured: boolean;
  justUpgraded: boolean;
  teamPricePerSeatCents: number;
  teamMinSeats: number;
  teamMaxSeats: number;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [seats, setSeats] = useState(Math.max(teamMinSeats, usage.seats));
  const paid = usage.plan === "PRO" || usage.plan === "TEAM";
  const isTeam = usage.plan === "TEAM";

  const go = (fn: () => Promise<{ url?: string; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.url) window.location.href = res.url;
      else if (res.error) {
        setError(res.error);
        toast(res.error, "error");
      }
    });
  };

  const clampSeat = (n: number) => Math.min(teamMaxSeats, Math.max(teamMinSeats, n));
  const teamPrice = clampSeat(seats) * teamPricePerSeatCents;

  const planUsage = (used: number, limit: number | null) =>
    limit === null ? `${used} · unlimited` : `${used} / ${limit}`;

  return (
    <>
      {/* Current plan */}
      <div className="setrow">
        <div className="l">
          <b>
            {PLAN_LABEL[usage.plan] ?? usage.plan}
            {isTeam ? ` · ${usage.seats} seats` : ""}
          </b>
          <span>
            {usage.plan === "FREE"
              ? "1 project · 2 distribution plans / month · solo"
              : isTeam
                ? "Unlimited projects & plans · seat-based for your team"
                : "Unlimited projects · unlimited plans · solo"}
          </span>
        </div>
        {paid ? (
          <button
            className="btn btn-s"
            disabled={pending || !billingConfigured}
            onClick={() => go(openPortal)}
          >
            <Icon name="external" /> Manage billing
          </button>
        ) : (
          <button className="btn btn-p" disabled={pending} onClick={() => go(startCheckout)}>
            {pending ? "Redirecting…" : "Upgrade to Pro — $29/mo"}
          </button>
        )}
      </div>

      {/* Usage */}
      <div className="setrow">
        <div className="l">
          <b>Usage this month</b>
          <span>
            Plans {planUsage(usage.plansThisMonth, usage.planLimit)} · Projects{" "}
            {planUsage(usage.projectCount, usage.projectLimit)}
          </span>
        </div>
        {!paid &&
          usage.planLimit !== null &&
          usage.plansThisMonth >= usage.planLimit && (
            <span className="badge" style={{ color: "var(--warn)" }}>
              <span className="dot" style={{ background: "var(--warn)" }} />
              limit reached
            </span>
          )}
      </div>

      {/* Team upsell / seat manager */}
      {!isTeam && (
        <div className="setrow" style={{ alignItems: "center" }}>
          <div className="l">
            <b>Team — for agencies &amp; DevRel</b>
            <span>
              Unlimited everything for your whole team. {dollars(teamPricePerSeatCents)}/seat,
              {" "}
              {teamMinSeats}-seat minimum. Shared workspaces &amp; member invites are coming.
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="seat-step">
              <button
                type="button"
                onClick={() => setSeats((s) => clampSeat(s - 1))}
                disabled={clampSeat(seats) <= teamMinSeats}
                aria-label="Fewer seats"
              >
                −
              </button>
              <span className="num">{clampSeat(seats)}</span>
              <button
                type="button"
                onClick={() => setSeats((s) => clampSeat(s + 1))}
                disabled={clampSeat(seats) >= teamMaxSeats}
                aria-label="More seats"
              >
                +
              </button>
            </div>
            <button
              className="btn btn-p"
              disabled={pending}
              onClick={() => go(() => startTeamCheckout(clampSeat(seats)))}
            >
              {pending ? "Redirecting…" : `Get Team — ${dollars(teamPrice)}/mo`}
            </button>
          </div>
        </div>
      )}

      {justUpgraded && (
        <div className="setrow" style={{ fontSize: 12.5 }}>
          <div className="l">
            <b style={{ color: "var(--ok)" }}>
              <Icon
                name="check"
                style={{ width: 13, height: 13, stroke: "var(--ok)", strokeWidth: 2, fill: "none", verticalAlign: "-2px", marginRight: 4 }}
              />
              Subscription active
            </b>
            <span>
              If the plan still shows Free, the webhook is still processing —
              refresh in a moment.
            </span>
          </div>
        </div>
      )}

      {!billingConfigured && !paid && (
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
