import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getInviteByToken } from "@/lib/team";
import { PublicShell } from "@/components/public/PublicShell";
import { AcceptInvite } from "@/components/invite/AcceptInvite";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Team invite — LaunchWake",
  robots: { index: false },
};

export default async function InvitePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const [invite, session] = await Promise.all([getInviteByToken(token), auth()]);
  const loggedIn = Boolean(session?.user?.id);

  if (!invite) {
    return (
      <PublicShell>
        <div className="pub-eyebrow">
          <Icon name="lock" />
          Team invite
        </div>
        <h1 className="pub-h1">This invite is invalid or already used</h1>
        <p className="pub-lede">
          Ask the team owner to send you a fresh invite link from their LaunchWake
          settings.
        </p>
      </PublicShell>
    );
  }

  const owner = invite.owner.name ?? invite.owner.email;

  return (
    <PublicShell>
      <div className="pub-eyebrow">
        <Icon name="wave" />
        Team invite
      </div>
      <h1 className="pub-h1">
        Join <span className="ac-word">{owner}</span>&rsquo;s team on LaunchWake
      </h1>
      <p className="pub-lede">
        You&apos;ll share their workspace — projects, distribution plans, launch
        day, and results. Billing stays with the owner. Invited as{" "}
        <b style={{ color: "var(--tx)" }}>{invite.email}</b>.
      </p>

      <div style={{ marginTop: 26, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <AcceptInvite token={token} loggedIn={loggedIn} />
      </div>

      {loggedIn && (
        <p className="lc-hint" style={{ marginTop: 12 }}>
          Accepting links your account to this team. You can leave anytime from
          Settings.
        </p>
      )}
    </PublicShell>
  );
}
