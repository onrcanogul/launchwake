import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { alternatesFor, type Locale } from "@/i18n/paths";
import { Link } from "@/i18n/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { Icon } from "@/components/Icon";
import { LEGAL_ENTITY, LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "@/lib/legal";

/**
 * Terms of Service. Rendered under `[locale]` so the footer's locale-aware links
 * resolve (`/terms` and `/tr/terms`) and hreflang alternates are emitted — but
 * the legal body itself is intentionally English-only: a single authoritative
 * text avoids the liability of a machine-translated contract. Only the
 * surrounding nav/footer chrome localizes.
 */

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  return {
    title: "Terms of Service — LaunchWake",
    description:
      "The terms that govern your use of LaunchWake, the distribution co-pilot for technical founders.",
    alternates: alternatesFor("/terms", locale),
  };
}

export default async function TermsPage(props: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <PublicShell locale={locale}>
      <div className="pub-eyebrow">
        <Icon name="shield" />
        Legal
      </div>
      <h1 className="pub-h1">Terms of Service</h1>
      <p className="legal-updated">Last updated: {LEGAL_LAST_UPDATED}</p>

      <div className="legal">
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
          use of {LEGAL_ENTITY} (the &ldquo;Service&rdquo;), operated by{" "}
          {LEGAL_ENTITY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, the
          &ldquo;Operator&rdquo;). By creating an account or otherwise using the
          Service, you agree to these Terms. If you do not agree, do not use the
          Service.
        </p>

        <h2>1. What LaunchWake is</h2>
        <p>
          {LEGAL_ENTITY} is a distribution co-pilot for technical founders. For a
          given release, feature, or post, it recommends where to share it, notes
          the rules and risks of each channel, generates draft copy, and helps you
          attribute the resulting signups.
        </p>
        <p>
          <strong>
            {LEGAL_ENTITY} never posts on your behalf and does not operate bot or
            automated accounts.
          </strong>{" "}
          It produces drafts and plans; you decide what to publish and you publish
          it yourself. You are solely responsible for anything you post.
        </p>

        <h2>2. Your account</h2>
        <p>
          You sign in with GitHub or an email magic link. You are responsible for
          maintaining the security of your account and for all activity under it.
          You must provide accurate information and be old enough to form a binding
          contract in your jurisdiction (and at least 16 years old). Notify us
          promptly at {LEGAL_CONTACT_EMAIL} of any unauthorized use.
        </p>

        <h2>3. Acceptable use</h2>
        <p>You agree that you will not:</p>
        <ul>
          <li>
            use the Service to send spam, mislead communities, or otherwise
            violate the rules, terms, or guidelines of any third-party platform
            you post to (Reddit, Hacker News, Product Hunt, and so on);
          </li>
          <li>
            use the Service for anything unlawful, deceptive, or infringing, or to
            harass or harm others;
          </li>
          <li>
            attempt to circumvent usage limits, probe or disrupt the Service, or
            access it by automated means beyond documented interfaces;
          </li>
          <li>
            resell, sublicense, or expose the Service (including the channel
            catalog and its intelligence) as your own product.
          </li>
        </ul>
        <p>
          Our channel fit scores, timing suggestions, and ban-risk notes are{" "}
          <strong>advisory guidance, not guarantees</strong>. Each platform sets
          and enforces its own rules; you are responsible for reviewing and
          following them. We are not liable for account suspensions, bans, or
          removals that result from your posts.
        </p>

        <h2>4. Third-party services</h2>
        <p>
          When you connect GitHub, we access your repositories and releases on a
          read-only basis to detect ships. Your use of GitHub and of any platform
          you choose to post to is governed by that platform&rsquo;s own terms and
          privacy policy, not ours. We are not responsible for third-party services
          and do not control their availability or behavior.
        </p>

        <h2>5. Plans, billing, and cancellation</h2>
        <p>
          {LEGAL_ENTITY} offers a free tier with usage limits (for example, one
          project and a capped number of distribution plans per month) and paid
          subscriptions with higher limits. Paid plans are billed in advance
          through our payment processor, Stripe, on a recurring basis until
          cancelled.
        </p>
        <ul>
          <li>
            You can cancel at any time; cancellation takes effect at the end of the
            current billing period and you retain paid access until then.
          </li>
          <li>
            Except where required by law, payments are non-refundable and we do not
            provide refunds or credits for partial periods or unused features.
          </li>
          <li>
            We may change prices or plan limits prospectively; we will give
            reasonable notice before a change affects your next renewal.
          </li>
        </ul>

        <h2>6. Intellectual property</h2>
        <p>
          The Service, including its software and the channel catalog and
          intelligence, is owned by the Operator and protected by law. We grant you
          a limited, non-exclusive, non-transferable right to use the Service under
          these Terms.
        </p>
        <p>
          You retain ownership of the content you provide and of the drafts and
          plans generated for you. You grant us the limited right to process that
          content solely to operate and improve the Service for you, as described
          in our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <h2>7. Disclaimers</h2>
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; without warranties of any kind, whether express or
          implied, including fitness for a particular purpose and
          non-infringement. Recommendations, scores, and generated copy are
          informational and do not constitute legal, marketing, or professional
          advice. We do not warrant that using the Service will produce signups,
          traffic, or any particular outcome, or that any channel will accept your
          post.
        </p>

        <h2>8. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, the Operator will not be liable
          for any indirect, incidental, special, consequential, or punitive
          damages, or for lost profits, revenues, data, or goodwill, arising out of
          or relating to your use of the Service. Our total liability for any claim
          relating to the Service will not exceed the greater of the amounts you
          paid us in the twelve months before the claim or USD 100.
        </p>

        <h2>9. Termination</h2>
        <p>
          You may stop using the Service and delete your account at any time. We
          may suspend or terminate your access if you breach these Terms or use the
          Service in a way that risks harm to others or to the Service. On
          termination, your right to use the Service ends; sections that by their
          nature should survive (ownership, disclaimers, limitation of liability)
          will survive.
        </p>

        <h2>10. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. When we make material
          changes we will update the date above and, where appropriate, notify you.
          Continuing to use the Service after a change takes effect means you accept
          the updated Terms.
        </p>

        <h2>11. Governing law</h2>
        <p>
          These Terms are governed by and construed in accordance with the laws
          applicable at the Operator&rsquo;s principal place of business, without
          regard to conflict-of-law rules. Nothing here removes any mandatory
          consumer-protection rights you have under the law of your country of
          residence.
        </p>

        <h2>12. Contact</h2>
        <p>
          Questions about these Terms? Email us at{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </div>
    </PublicShell>
  );
}
