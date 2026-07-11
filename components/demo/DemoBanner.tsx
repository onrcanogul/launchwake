import Link from "next/link";
import { Icon } from "@/components/Icon";

/** Signup entry every demo screen shares — the demo's one persistent CTA. */
const START_HREF = `/login?callbackUrl=${encodeURIComponent("/onboarding")}`;

/**
 * The persistent strip at the top of every `/demo` screen. Makes it unmistakable
 * that this is sample data (so nobody thinks LaunchWake auto-filled their account)
 * and keeps a one-click path to the real thing in view.
 */
export function DemoBanner() {
  return (
    <div className="demo-banner">
      <Icon name="wave" />
      <span className="demo-banner-tx">
        You&rsquo;re exploring a <b>live demo</b> — sample data for an example product,{" "}
        <b>Cascade</b>. Nothing here is saved.
      </span>
      <Link href={START_HREF} className="btn btn-p demo-banner-cta">
        <Icon name="arrowRight" />
        Start free
      </Link>
    </div>
  );
}
