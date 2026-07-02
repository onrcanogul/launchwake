import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";
import { LaunchChecker } from "@/components/public/LaunchChecker";
import { PUBLIC_FREE_RECS } from "@/lib/launchChecker";
import { TEAM_PRICE_PER_SEAT_CENTS, TEAM_MIN_SEATS } from "@/lib/billing";
import { Icon, type IconName } from "@/components/Icon";

const TEAM_FROM = (TEAM_PRICE_PER_SEAT_CENTS * TEAM_MIN_SEATS) / 100;
const TEAM_PER_SEAT = TEAM_PRICE_PER_SEAT_CENTS / 100;

export const metadata: Metadata = {
  title: "LaunchWake — Ship it. We'll make the waves.",
  description:
    "The distribution co-pilot for technical founders. For every ship, LaunchWake tells you where to post it, how to post without getting banned, and what actually drove signups. Try the free Launch Checker — no login.",
  alternates: { canonical: "/" },
};

const PAINS = [
  {
    q: "“Where do I even post this?”",
    p: "You know Reddit, HN and X exist. You don't know which communities, which angle, or the rules that get you banned instead of upvoted.",
  },
  {
    q: "“I don't have time for this.”",
    p: "Every hour writing a launch post is an hour not building. So marketing slips — and the product stays invisible.",
  },
  {
    q: "“Did any of it even work?”",
    p: "You post, you hope, you never really know which channel brought the signups. So you can't do more of what works.",
  },
];

const STEPS: { t: string; h: string; p: string }[] = [
  {
    t: "Connect",
    h: "Point it at what you're building",
    p: "Drop your product URL, GitHub repo or changelog. LaunchWake understands what you shipped and who it's for.",
  },
  {
    t: "Analyze",
    h: "Find where your users actually are",
    p: "It ranks a curated catalog of real communities by fit for your product — with each one's tone, rules and ban risk.",
  },
  {
    t: "Guide",
    h: "Get the post, the place, the timing",
    p: "Platform-native drafts plus where and when to post them — safely, without the spammy patterns that get you nuked. You hit publish.",
  },
  {
    t: "Prove",
    h: "See what actually drove signups",
    p: "Tracked links close the loop: this post → these clicks → these signups. Now you know what to double down on.",
  },
];

const WHY: { icon: IconName; h: string; p: string }[] = [
  {
    icon: "where",
    h: "Intelligence, not autopilot",
    p: "It tells you the smart move; you make it. No bot armies, no fake accounts — just the analysis you're missing.",
  },
  {
    icon: "shield",
    h: "Ban-safe by design",
    p: "Every recommendation is grounded in a real community's rules, so your posts land instead of getting your account nuked.",
  },
  {
    icon: "results",
    h: "ROI you can see",
    p: "Every suggestion is tied to real attribution. Stop guessing which channel worked — watch it.",
  },
];

export default function LandingPage() {
  return (
    <PublicShell wide>
      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="pub-eyebrow">
          <Icon name="wave" />
          For founders who&apos;d rather be coding
        </div>
        <h1 className="lp-h1">
          Ship it. <span className="ac-word">We&apos;ll make the waves.</span>
        </h1>
        <p className="lp-lede">
          LaunchWake is the distribution co-pilot for technical founders. It finds
          where your users actually hang out, tells you exactly what to post and
          where — then shows you what really drove signups.
        </p>

        <div className="lp-try">
          <div className="lp-try-hd">
            <Icon name="target" />
            Try it free — paste a GitHub repo, get a distribution plan. No account.
          </div>
          <LaunchChecker freeCount={PUBLIC_FREE_RECS} />
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="lp-section">
        <div className="lp-kicker">The problem</div>
        <h2 className="lp-h2">
          You can build anything. Getting users is the hard part.
        </h2>
        <p className="lp-lead">
          Most technical founders ship a great product into silence. Not because
          it&apos;s bad — because marketing feels like a foreign language you never
          wanted to learn.
        </p>
        <div className="lp-grid3">
          {PAINS.map((x) => (
            <div key={x.q} className="lp-card">
              <h3>{x.q}</h3>
              <p>{x.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-section">
        <div className="lp-kicker">How it works</div>
        <h2 className="lp-h2">Analysis and guidance — you stay in control.</h2>
        <p className="lp-lead">
          LaunchWake never auto-posts for you (that&apos;s how accounts get
          banned). It does the thinking; you press publish.
        </p>
        <div className="lp-steps">
          {STEPS.map((s, i) => (
            <div key={s.t} className="lp-step">
              <div className="lp-num num">{i + 1}</div>
              <div>
                <div className="lp-step-t">{s.t}</div>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why different ── */}
      <section className="lp-section">
        <div className="lp-kicker">Why it&apos;s different</div>
        <h2 className="lp-h2">Not another AI that posts spam for you.</h2>
        <div className="lp-grid3">
          {WHY.map((w) => (
            <div key={w.h} className="lp-card">
              <span className="lp-ic">
                <Icon name={w.icon} />
              </span>
              <h3>{w.h}</h3>
              <p>{w.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Free tools ── */}
      <section className="lp-section">
        <div className="lp-kicker">Free, no login</div>
        <h2 className="lp-h2">Start getting value before you sign up.</h2>
        <div className="lp-tools">
          <Link href="/tools/launch-checker" className="lp-tool">
            <span className="lp-ic">
              <Icon name="target" />
            </span>
            <h3>Launch Checker</h3>
            <p>
              Paste a GitHub repo and get a ranked distribution plan — which
              channels fit, their ban risk, and how to post in each.
            </p>
            <span className="lp-tool-go">
              Open Launch Checker <Icon name="arrowRight" />
            </span>
          </Link>
          <Link href="/channels" className="lp-tool">
            <span className="lp-ic">
              <Icon name="shield" />
            </span>
            <h3>Ban Risk Lookup</h3>
            <p>
              The posting playbook for every community founders launch in — rules,
              ban risk, and the safe way in. “Can I post my startup on r/SaaS?”
            </p>
            <span className="lp-tool-go">
              Browse the channel catalog <Icon name="arrowRight" />
            </span>
          </Link>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="lp-section">
        <div className="lp-kicker">Pricing</div>
        <h2 className="lp-h2">Start free. Pay when it makes waves.</h2>
        <div className="lp-price">
          <div className="lp-pc">
            <div className="lp-pc-name">Free</div>
            <div className="lp-p">
              $0 <small>forever</small>
            </div>
            <p className="lp-pc-desc">
              Everything you need to plan your first launches.
            </p>
            <ul>
              <li>1 project</li>
              <li>2 launch plans / month</li>
              <li>Where-to-post intelligence + rules</li>
              <li>Platform-native drafts</li>
            </ul>
            <Link href="/login" className="btn btn-s btn-lg">
              Start free
            </Link>
          </div>
          <div className="lp-pc hi">
            <span className="lp-pc-badge">Most popular</span>
            <div className="lp-pc-name">Pro</div>
            <div className="lp-p">
              $29 <small>/ mo</small>
            </div>
            <p className="lp-pc-desc">
              For founders shipping — and distributing — every week.
            </p>
            <ul>
              <li>Unlimited projects &amp; plans</li>
              <li>Ban-risk rules for every channel</li>
              <li>Scheduling &amp; reminders</li>
              <li>Signup attribution &amp; ROI</li>
            </ul>
            <Link href="/login" className="btn btn-p btn-lg">
              Get started
            </Link>
          </div>
          <div className="lp-pc">
            <div className="lp-pc-name">Team</div>
            <div className="lp-p">
              ${TEAM_FROM} <small>/ mo</small>
            </div>
            <p className="lp-pc-desc">
              For agencies &amp; DevRel teams — ${TEAM_PER_SEAT}/seat, from{" "}
              {TEAM_MIN_SEATS} seats.
            </p>
            <ul>
              <li>Everything in Pro, unlimited</li>
              <li>Per-seat billing for your team</li>
              <li>Multiple client products</li>
              <li>Shared workspaces &amp; invites (soon)</li>
            </ul>
            <Link href="/login" className="btn btn-s btn-lg">
              Start a team
            </Link>
          </div>
        </div>
        <p className="lc-hint" style={{ marginTop: 14 }}>
          No credit card. Built for indie hackers, dev-tool founders &amp; the
          teams that launch for them.
        </p>
      </section>

      {/* ── Final ── */}
      <section className="lp-final">
        <h2 className="lp-h2">Your next launch deserves an audience.</h2>
        <p className="lp-lead" style={{ margin: "0 auto 22px" }}>
          Ship it. We&apos;ll make the waves.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/tools/launch-checker" className="btn btn-p btn-lg" style={{ width: "auto" }}>
            <Icon name="target" />
            Check my launch
          </Link>
          <Link href="/login" className="btn btn-s btn-lg" style={{ width: "auto" }}>
            Sign in
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
