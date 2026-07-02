import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";
import { PricingCards } from "@/components/public/PricingCards";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Pricing — LaunchWake",
  description:
    "Simple pricing for LaunchWake: Free forever for your first launches, Pro at $29/mo for unlimited plans + attribution, and a seat-based Team plan for agencies & DevRel. No credit card to start.",
  alternates: { canonical: "/pricing" },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is there really a free plan?",
    a: "Yes — Free is forever. You get 1 project and 2 distribution plans a month, with the full where-to-post intelligence, ban-risk rules, and platform-native drafts. No credit card.",
  },
  {
    q: "What counts as a “plan”?",
    a: "A distribution plan is the ranked set of channels we generate for one ship (a release, feature, or post). Free includes 2 per month; Pro and Team are unlimited.",
  },
  {
    q: "How does Team billing work?",
    a: "Team is seat-based: $29 per seat with a 3-seat minimum, billed monthly through Stripe. Add or remove seats anytime from the billing portal. Built for agencies and DevRel teams running many products.",
  },
  {
    q: "Does LaunchWake post for me?",
    a: "Never. LaunchWake generates the plan and the drafts; you press publish from your own account. Auto-posting is how accounts get banned — it's out of scope on purpose.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Manage or cancel your subscription from the billing portal in Settings; you keep access until the end of the period, then drop to Free.",
  },
];

export default function PricingPage() {
  return (
    <PublicShell wide>
      <div className="pub-eyebrow">
        <Icon name="target" />
        Pricing
      </div>
      <h1 className="pub-h1">Start free. Pay when it makes waves.</h1>
      <p className="pub-lede">
        The intelligence is the product — where to post, how to post without
        getting banned, and what actually drove signups. Try it free; upgrade when
        distribution becomes part of every ship.
      </p>

      <div style={{ marginTop: 30 }}>
        <PricingCards />
      </div>
      <p className="lc-hint" style={{ marginTop: 14, textAlign: "center" }}>
        No credit card to start · cancel anytime · never auto-posts on your behalf.
      </p>

      {/* FAQ — SEO + objection handling */}
      <section className="lp-section" style={{ maxWidth: 760 }}>
        <div className="lp-kicker">FAQ</div>
        <h2 className="lp-h2">Questions, answered.</h2>
        <div className="faq">
          {FAQ.map((f) => (
            <div className="faq-item" key={f.q}>
              <div className="faq-q">{f.q}</div>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="gate" style={{ marginTop: 20 }}>
        <h3>See your own distribution plan first</h3>
        <p>
          Not sure yet? Paste a GitHub repo into the free Launch Checker and get a
          ranked plan for your product — no account needed.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Link href="/tools/launch-checker" className="btn btn-p">
            <Icon name="target" /> Check my launch
          </Link>
          <Link href="/login" className="btn btn-s">
            Start free
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
