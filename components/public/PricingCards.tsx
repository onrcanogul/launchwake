import Link from "next/link";
import { TEAM_PRICE_PER_SEAT_CENTS, TEAM_MIN_SEATS } from "@/lib/billing";

const TEAM_FROM = (TEAM_PRICE_PER_SEAT_CENTS * TEAM_MIN_SEATS) / 100;
const TEAM_PER_SEAT = TEAM_PRICE_PER_SEAT_CENTS / 100;

/**
 * The Free / Pro / Team cards — one source of truth, shared by the landing hero
 * and the standalone /pricing page so they never drift.
 */
export function PricingCards({ ctaHref = "/login" }: { ctaHref?: string }) {
  return (
    <div className="lp-price">
      <div className="lp-pc">
        <div className="lp-pc-name">Free</div>
        <div className="lp-p">
          $0 <small>forever</small>
        </div>
        <p className="lp-pc-desc">Everything you need to plan your first launches.</p>
        <ul>
          <li>1 project</li>
          <li>2 launch plans / month</li>
          <li>Where-to-post intelligence + rules</li>
          <li>Platform-native drafts</li>
        </ul>
        <Link href={ctaHref} className="btn btn-s btn-lg">
          Start free
        </Link>
      </div>
      <div className="lp-pc hi">
        <span className="lp-pc-badge">Most popular</span>
        <div className="lp-pc-name">Pro</div>
        <div className="lp-p">
          $29 <small>/ mo</small>
        </div>
        <p className="lp-pc-desc">For founders shipping — and distributing — every week.</p>
        <ul>
          <li>Unlimited projects &amp; plans</li>
          <li>Ban-risk rules for every channel</li>
          <li>Scheduling &amp; reminders</li>
          <li>Signup &amp; revenue attribution + ROI</li>
        </ul>
        <Link href={ctaHref} className="btn btn-p btn-lg">
          Get started
        </Link>
      </div>
      <div className="lp-pc">
        <div className="lp-pc-name">Team</div>
        <div className="lp-p">
          ${TEAM_FROM} <small>/ mo</small>
        </div>
        <p className="lp-pc-desc">
          For agencies &amp; DevRel teams — ${TEAM_PER_SEAT}/seat, from {TEAM_MIN_SEATS} seats.
        </p>
        <ul>
          <li>Everything in Pro, unlimited</li>
          <li>Per-seat billing for your team</li>
          <li>Multiple client products</li>
          <li>Shared workspaces &amp; invites (soon)</li>
        </ul>
        <Link href={ctaHref} className="btn btn-s btn-lg">
          Start a team
        </Link>
      </div>
    </div>
  );
}
