"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { saveStripeWebhookSecret } from "@/app/app/settings/actions";
import { CodePrompt, preStyle } from "@/components/settings/CodePrompt";

type Status = {
  signups: number;
  clicks: number;
  lastSignupAt: Date | null;
  revenueEvents: number;
  revenueCents: number;
  currency: string;
  lastRevenueAt: Date | null;
};

function ago(date: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return days === 1 ? "1 day ago" : `${days} days ago`;
  if (hours >= 1) return `${hours}h ago`;
  if (mins >= 1) return `${mins}m ago`;
  return "just now";
}

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency.toUpperCase()}`;
  }
}

const sub: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--tx)",
  margin: "22px 0 8px",
  display: "flex",
  alignItems: "center",
  gap: 7,
};

/** Signup + revenue attribution setup: pixel, generic revenue API, Stripe webhook. */
export function TrackingSetup({
  appUrl,
  projectId,
  status,
  stripeSecretSet,
}: {
  appUrl: string;
  projectId: string;
  status: Status;
  stripeSecretSet: boolean;
}) {
  const base = appUrl.replace(/\/$/, "");
  const { toast } = useToast();

  const signupSnippet = `<script>
(function () {
  // 1. capture lw_ref from the tracked-link click (any page)
  var p = new URLSearchParams(location.search).get('lw_ref');
  if (p) { try { localStorage.setItem('lw_ref', p); } catch (e) {} }
  // 2. call launchwakeSignup() on your signup-success page
  window.launchwakeSignup = function () {
    var r; try { r = localStorage.getItem('lw_ref'); } catch (e) {}
    if (r) navigator.sendBeacon(
      '${base}/api/track/signup',
      new Blob([JSON.stringify({ ref: r })], { type: 'application/json' })
    );
  };
})();
</script>`;

  const signupPrompt = `Add LaunchWake signup attribution to my web app.

1. Site-wide (in the root layout / <head> so it runs on every page): read the \`lw_ref\` query parameter from the URL and, if present, save it to localStorage under the key \`lw_ref\`. Then define a global function \`window.launchwakeSignup()\` that reads \`lw_ref\` from localStorage and, if present, sends a POST beacon to \`${base}/api/track/signup\` with the JSON body \`{ "ref": <the stored lw_ref> }\` using \`navigator.sendBeacon\`. Wrap the localStorage calls in try/catch so private-mode browsers don't throw.
2. On my signup-success page, call \`launchwakeSignup()\` once the signup has succeeded.

Clicks are tracked automatically; a signup only counts once launchwakeSignup() runs. This credits each signup to the channel that drove the click.`;

  const revenueSnippet = `// Server-side, after a successful payment. Pass the lw_ref you
// stored at signup so the revenue is attributed to the channel.
await fetch('${base}/api/track/revenue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ref: lwRef,          // captured from lw_ref at signup
    amountCents: 4900,   // $49.00
    currency: 'usd',
    recurring: true      // subscription → counts toward MRR
  })
});`;

  const revenuePrompt = `Add server-side revenue attribution to LaunchWake.

After a successful payment on my backend, send a POST to \`${base}/api/track/revenue\` with a JSON body:
- \`ref\`: the \`lw_ref\` value captured and stored for this user at signup,
- \`amountCents\`: the amount in cents (e.g. 4900 for $49.00),
- \`currency\`: the ISO currency code (e.g. "usd"),
- \`recurring\`: true for subscription payments (these count toward MRR), false for one-off charges.

Make sure each user's \`lw_ref\` is persisted at signup so it's available here. This attributes the revenue to the channel that drove the signup. Works with any provider — call it from your backend, a PostHog action, or GA4.`;

  const stripeUrl = `${base}/api/track/stripe/${projectId}`;
  const stripeNote = `// When you create the Stripe Checkout Session, tag it with lw_ref:
stripe.checkout.sessions.create({
  // …line_items, mode, success_url…
  metadata: { lw_ref: lwRef }   // the value you captured at signup
});`;

  const stripePrompt = `Wire up LaunchWake's turnkey Stripe revenue tracking.

1. Wherever I create a Stripe Checkout Session, add \`metadata: { lw_ref: <the lw_ref captured at signup> }\` so LaunchWake knows which channel to credit.
2. In Stripe → Developers → Webhooks, add the endpoint \`${stripeUrl}\` and subscribe it to the events \`checkout.session.completed\` and \`invoice.paid\`.
3. Copy that webhook's signing secret (starts with \`whsec_\`) and remind me to paste it into LaunchWake Settings so incoming events can be verified.

This attributes Stripe revenue automatically — no custom payment-handling code needed.`;

  // ── status banners ──
  const signupBanner =
    status.signups > 0 ? (
      <div className="track-status ok">
        <span className="dot" style={{ background: "var(--ok)" }} />
        Receiving — <b>{status.signups}</b> signup
        {status.signups === 1 ? "" : "s"} attributed
        {status.lastSignupAt ? `, last ${ago(status.lastSignupAt)}` : ""}.
      </div>
    ) : status.clicks > 0 ? (
      <div className="track-status warn">
        <span className="dot" style={{ background: "var(--warn)" }} />
        <b>{status.clicks}</b> click{status.clicks === 1 ? "" : "s"} tracked but no
        signups yet — make sure the snippet is installed and{" "}
        <code className="mono">launchwakeSignup()</code> runs on your success page.
      </div>
    ) : (
      <div className="track-status">
        <span className="dot" style={{ background: "var(--tx3)" }} />
        No data yet — add the snippet below, then it lights up as clicks and
        signups arrive.
      </div>
    );

  // ── Stripe secret form ──
  const [secret, setSecret] = useState("");
  const [saving, startSave] = useTransition();
  const save = () =>
    startSave(async () => {
      const res = await saveStripeWebhookSecret(secret);
      if (res.ok) {
        setSecret("");
        toast(secret.trim() ? "Stripe revenue tracking connected" : "Stripe secret cleared");
      } else {
        toast(res.error ?? "Couldn't save", "error");
      }
    });

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(stripeUrl);
      toast("Webhook URL copied");
    } catch {
      toast("Couldn't copy", "error");
    }
  };

  return (
    <div style={{ padding: "14px 16px" }}>
      {signupBanner}

      {/* 1 — Signups */}
      <div style={sub}>
        <Icon name="results" style={{ width: 14, height: 14, stroke: "var(--ac)", strokeWidth: 1.7, fill: "none" }} />
        1 · Attribute signups (pixel)
      </div>
      <p style={{ color: "var(--tx2)", fontSize: 12.5, marginBottom: 10 }}>
        Add this site-wide, then call{" "}
        <code className="mono" style={{ color: "var(--tx)" }}>launchwakeSignup()</code>{" "}
        on your signup-success page. Clicks are tracked without it; signups need it.
      </p>
      <CodePrompt code={signupSnippet} prompt={signupPrompt} codeLabel="Snippet" />

      {/* 2 — Revenue (generic) */}
      <div style={sub}>
        <Icon name="target" style={{ width: 14, height: 14, stroke: "var(--ac)", strokeWidth: 1.7, fill: "none" }} />
        2 · Attribute revenue (any provider)
      </div>
      {status.revenueEvents > 0 && (
        <div className="track-status ok" style={{ marginBottom: 10 }}>
          <span className="dot" style={{ background: "var(--ok)" }} />
          <b>{money(status.revenueCents, status.currency)}</b> in revenue attributed
          across {status.revenueEvents} payment{status.revenueEvents === 1 ? "" : "s"}
          {status.lastRevenueAt ? `, last ${ago(status.lastRevenueAt)}` : ""}.
        </div>
      )}
      <p style={{ color: "var(--tx2)", fontSize: 12.5, marginBottom: 10 }}>
        Forward a payment from anywhere — your backend, a PostHog action, or GA4 —
        to the revenue endpoint with the same <code className="mono">lw_ref</code>.
        Recurring payments count toward MRR.
      </p>
      <CodePrompt code={revenueSnippet} prompt={revenuePrompt} codeLabel="Revenue example" />

      {/* 3 — Stripe turnkey */}
      <div style={sub}>
        <Icon name="target" style={{ width: 14, height: 14, stroke: "var(--ac)", strokeWidth: 1.7, fill: "none" }} />
        3 · Stripe (turnkey) {stripeSecretSet && <span className="badge" style={{ color: "var(--ok)" }}><span className="dot" style={{ background: "var(--ok)" }} />connected</span>}
      </div>
      <p style={{ color: "var(--tx2)", fontSize: 12.5, marginBottom: 8 }}>
        In Stripe → Developers → Webhooks, add this endpoint (events{" "}
        <code className="mono">checkout.session.completed</code> and{" "}
        <code className="mono">invoice.paid</code>), then paste its signing secret below.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <code className="mono" style={{ ...preStyle, padding: "8px 10px", flex: 1, minWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {stripeUrl}
        </code>
        <button className="btn btn-s" onClick={copyUrl}>
          <Icon name="copy" /> Copy URL
        </button>
      </div>
      <p style={{ color: "var(--tx2)", fontSize: 12.5, marginBottom: 8 }}>
        Tag the Checkout Session with the visitor&apos;s <code className="mono">lw_ref</code> so we know which channel to credit:
      </p>
      <CodePrompt code={stripeNote} prompt={stripePrompt} codeLabel="Metadata example" />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
        <input
          className="inp"
          type="password"
          placeholder={stripeSecretSet ? "•••••••• (saved) — paste to replace" : "whsec_…"}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="btn btn-p" onClick={save} disabled={saving}>
          <Icon name="check" /> {saving ? "Saving…" : stripeSecretSet ? "Update secret" : "Connect Stripe"}
        </button>
      </div>
    </div>
  );
}
