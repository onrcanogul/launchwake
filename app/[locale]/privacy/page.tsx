import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { alternatesFor, type Locale } from "@/i18n/paths";
import { PublicShell } from "@/components/public/PublicShell";
import { Icon } from "@/components/Icon";
import { LEGAL_ENTITY, LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "@/lib/legal";

/**
 * Privacy Policy. Like the Terms, it lives under `[locale]` for link/hreflang
 * resolution but the body is English-only. Content is kept factual to what the
 * product actually does — first-party analytics, read-only GitHub, and a small
 * set of named sub-processors — so it can be honestly published for Stripe live
 * activation and GDPR/KVKK expectations.
 */

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  return {
    title: "Privacy Policy — LaunchWake",
    description:
      "What data LaunchWake collects, how we use it, who processes it, and the rights you have over it.",
    alternates: alternatesFor("/privacy", locale),
  };
}

export default async function PrivacyPage(props: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <PublicShell locale={locale}>
      <div className="pub-eyebrow">
        <Icon name="lock" />
        Legal
      </div>
      <h1 className="pub-h1">Privacy Policy</h1>
      <p className="legal-updated">Last updated: {LEGAL_LAST_UPDATED}</p>

      <div className="legal">
        <p>
          This Privacy Policy explains what personal data {LEGAL_ENTITY} (the
          &ldquo;Service&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, why,
          how long we keep it, and the rights you have over it. We designed the
          Service to collect as little as it needs to do its job.
        </p>

        <h2>1. Data we collect</h2>
        <ul>
          <li>
            <strong>Account data.</strong> Your email address, and — if you sign in
            with GitHub — your GitHub username, account id, and avatar.
          </li>
          <li>
            <strong>GitHub data you connect.</strong> Read-only repository,
            release, and commit metadata used to detect ships and build
            distribution plans. We do not modify your repositories.
          </li>
          <li>
            <strong>Content you create.</strong> Projects, ships, generated plans
            and drafts, and any product details you enter.
          </li>
          <li>
            <strong>Attribution data.</strong> Clicks on the tracked links you
            create (with referrer, coarse channel, and timestamp), resulting
            signups, and revenue events received from our payment processor — plus
            any self-reported &ldquo;how did you hear about us&rdquo; answers your
            visitors submit.
          </li>
          <li>
            <strong>Usage and device data.</strong> Basic first-party logs (pages,
            actions, IP-derived approximate region, user agent) needed to run,
            secure, and improve the Service.
          </li>
          <li>
            <strong>Billing data.</strong> Your subscription status and customer id.
            Card details are handled entirely by Stripe; we never see or store your
            full card number.
          </li>
        </ul>

        <h2>2. How we use it</h2>
        <ul>
          <li>to provide the Service — generate distribution plans, drafts, and attribution rollups;</li>
          <li>to send transactional email (sign-in magic links, your weekly digest, billing notices);</li>
          <li>to measure which channels drove signups, so your results are attributed;</li>
          <li>to bill paid plans and enforce plan limits;</li>
          <li>to secure the Service, prevent abuse, and debug problems;</li>
          <li>to improve the product and our channel intelligence in aggregate.</li>
        </ul>

        <h2>3. AI processing</h2>
        <p>
          To generate plans and drafts, the relevant content you provide (such as
          your product description and ship notes) is sent to our AI provider,
          Anthropic, which processes it to return your output. Under our agreement,
          this content is not used to train their models. We validate and log token
          usage but do not use your content to train models of our own.
        </p>

        <h2>4. Legal bases</h2>
        <p>Where the GDPR or a similar law applies, we rely on:</p>
        <ul>
          <li>
            <strong>Performance of a contract</strong> — to give you the Service you
            signed up for;
          </li>
          <li>
            <strong>Legitimate interests</strong> — to secure, analyze, and improve
            the Service, balanced against your rights;
          </li>
          <li>
            <strong>Consent</strong> — where required, e.g. optional communications
            (which you can withdraw at any time);
          </li>
          <li>
            <strong>Legal obligation</strong> — to meet accounting and legal
            requirements.
          </li>
        </ul>

        <h2>5. Who processes your data</h2>
        <p>
          We do not sell your personal data. We share it only with service
          providers (&ldquo;sub-processors&rdquo;) that help us run the Service,
          under contracts that require them to protect it:
        </p>
        <ul>
          <li>
            <strong>Vercel</strong> — application hosting and delivery;
          </li>
          <li>
            <strong>Neon</strong> — managed Postgres database;
          </li>
          <li>
            <strong>Anthropic</strong> — AI generation of plans and drafts;
          </li>
          <li>
            <strong>Stripe</strong> — payment processing and subscription billing;
          </li>
          <li>
            <strong>Resend</strong> — delivery of transactional email;
          </li>
          <li>
            <strong>GitHub</strong> — sign-in and read-only repository access, at
            your direction.
          </li>
        </ul>
        <p>
          We may also disclose data if required by law or to protect the rights,
          safety, and security of our users or the Service.
        </p>

        <h2>6. Cookies and analytics</h2>
        <p>
          We use a small number of essential first-party cookies to keep you signed
          in and remember your active project. Our analytics are first-party — we do
          not embed third-party advertising trackers or sell data to ad networks.
        </p>

        <h2>7. International transfers</h2>
        <p>
          Our providers may process data in countries other than yours. Where
          personal data of individuals in the EEA, UK, or Türkiye is transferred, we
          rely on appropriate safeguards (such as Standard Contractual Clauses)
          offered by those providers.
        </p>

        <h2>8. Retention</h2>
        <p>
          We keep your data for as long as your account is active and as needed to
          provide the Service. When you delete your account we delete or anonymize
          your personal data within a reasonable period, except where we must retain
          certain records (for example, invoices) to meet legal obligations.
        </p>

        <h2>9. Your rights</h2>
        <p>
          Subject to the GDPR, KVKK, and other applicable laws, you may request
          access to, correction of, deletion of, or a portable copy of your personal
          data, and you may object to or restrict certain processing. You can delete
          your account at any time from your settings, or email us to exercise any
          of these rights. If you are in the EEA, UK, or Türkiye, you also have the
          right to lodge a complaint with your local data-protection authority.
        </p>

        <h2>10. Children</h2>
        <p>
          The Service is intended for professional use and is not directed to
          children. We do not knowingly collect data from anyone under 16.
        </p>

        <h2>11. Security</h2>
        <p>
          We use encryption in transit, scoped access, and other reasonable measures
          to protect your data. No method of transmission or storage is completely
          secure, so we cannot guarantee absolute security.
        </p>

        <h2>12. Changes</h2>
        <p>
          We may update this Policy from time to time. When we make material changes
          we will update the date above and, where appropriate, notify you.
        </p>

        <h2>13. Contact</h2>
        <p>
          For any privacy question or request, email us at{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </div>
    </PublicShell>
  );
}
