import { randomBytes } from "crypto";
import { db } from "./db";
import { env } from "./env";

/**
 * Team seats made usable: invites + memberships + the account-resolution that
 * lets a member share the paying owner's workspace. Seat accounting: the owner
 * occupies 1 seat; each accepted member and each pending invite occupies 1 more.
 */

export type AccountRole = "OWNER" | "MEMBER";

/**
 * Which account's data should this user see? A member of an active Team shares
 * the owner's workspace; everyone else is their own account. Central choke point
 * — every data query scopes to `accountId`.
 */
export async function resolveAccount(
  userId: string,
): Promise<{ accountId: string; role: AccountRole }> {
  const membership = await db.teamMembership.findFirst({
    where: { memberId: userId },
    include: { owner: { select: { id: true, plan: true } } },
  });
  if (membership && membership.owner.plan === "TEAM") {
    return { accountId: membership.owner.id, role: "MEMBER" };
  }
  return { accountId: userId, role: "OWNER" };
}

export function newInviteToken(): string {
  return randomBytes(12).toString("base64url");
}

export function inviteUrl(token: string): string {
  return `${env.APP_URL.replace(/\/$/, "")}/invite/${token}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type SeatUsage = { purchased: number; used: number; available: number };

/** Seats: owner (1) + members + pending invites, against purchased seats. */
export async function seatUsage(ownerId: string): Promise<SeatUsage> {
  const [owner, members, pending] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { seats: true } }),
    db.teamMembership.count({ where: { ownerId } }),
    db.teamInvite.count({ where: { ownerId, status: "PENDING" } }),
  ]);
  const purchased = owner.seats;
  const used = 1 + members + pending;
  return { purchased, used, available: Math.max(0, purchased - used) };
}

export type TeamMemberRow = { id: string; email: string; name: string | null; you: boolean };
export type TeamInviteRow = { id: string; email: string; url: string; createdAt: Date };

export type TeamView = {
  owner: { id: string; email: string; name: string | null };
  members: TeamMemberRow[];
  invites: TeamInviteRow[];
  seats: SeatUsage;
};

/** Everything the Team settings panel needs. */
export async function getTeamView(ownerId: string, viewerId: string): Promise<TeamView> {
  const [owner, memberships, invites, seats] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { id: true, email: true, name: true } }),
    db.teamMembership.findMany({
      where: { ownerId },
      include: { member: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.teamInvite.findMany({
      where: { ownerId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    seatUsage(ownerId),
  ]);

  return {
    owner,
    members: memberships.map((m) => ({
      id: m.member.id,
      email: m.member.email,
      name: m.member.name,
      you: m.member.id === viewerId,
    })),
    invites: invites.map((i) => ({ id: i.id, email: i.email, url: inviteUrl(i.token), createdAt: i.createdAt })),
    seats,
  };
}

export type InviteResult =
  | { ok: true; email: string; url: string }
  | { ok: false; error: string };

/** Create a pending invite (seat-enforced). Owner must be on the Team plan. */
export async function createInvite(ownerId: string, rawEmail: string): Promise<InviteResult> {
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { plan: true, email: true } });
  if (owner.plan !== "TEAM") {
    return { ok: false, error: "Team invites require the Team plan." };
  }
  const email = normalizeEmail(rawEmail);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (email === normalizeEmail(owner.email)) {
    return { ok: false, error: "You're already on the team." };
  }

  // Already a member?
  const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    const member = await db.teamMembership.findFirst({ where: { ownerId, memberId: existingUser.id } });
    if (member) return { ok: false, error: "That person is already on your team." };
  }
  const dupInvite = await db.teamInvite.findFirst({ where: { ownerId, email, status: "PENDING" } });
  if (dupInvite) return { ok: false, error: "There's already a pending invite for that email." };

  const seats = await seatUsage(ownerId);
  if (seats.available < 1) {
    return { ok: false, error: `No seats left (${seats.used}/${seats.purchased}). Add seats in billing first.` };
  }

  const token = newInviteToken();
  await db.teamInvite.create({ data: { ownerId, email, token } });
  return { ok: true, email, url: inviteUrl(token) };
}

/** Revoke a pending invite you own. */
export async function revokeInvite(ownerId: string, inviteId: string): Promise<void> {
  await db.teamInvite.deleteMany({ where: { id: inviteId, ownerId, status: "PENDING" } });
}

/** Remove a member from your team (frees the seat). */
export async function removeMember(ownerId: string, memberId: string): Promise<void> {
  await db.teamMembership.deleteMany({ where: { ownerId, memberId } });
}

export type AcceptResult =
  | { ok: true; ownerName: string }
  | { ok: false; error: string };

/** Look up a pending invite by token (for the accept page). */
export async function getInviteByToken(token: string) {
  return db.teamInvite.findFirst({
    where: { token, status: "PENDING" },
    include: { owner: { select: { name: true, email: true, plan: true } } },
  });
}

/** Accept an invite as `userId`, creating the membership. */
export async function acceptInvite(token: string, userId: string): Promise<AcceptResult> {
  const invite = await getInviteByToken(token);
  if (!invite) return { ok: false, error: "This invite is invalid or already used." };
  if (invite.owner.plan !== "TEAM") {
    return { ok: false, error: "This team's plan is no longer active." };
  }
  if (invite.ownerId === userId) {
    return { ok: false, error: "You can't accept your own invite." };
  }
  const already = await db.teamMembership.findFirst({ where: { memberId: userId } });
  if (already) {
    return { ok: false, error: "You're already a member of a team. Leave it first." };
  }

  await db.$transaction([
    db.teamMembership.create({ data: { ownerId: invite.ownerId, memberId: userId } }),
    db.teamInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } }),
  ]);
  return { ok: true, ownerName: invite.owner.name ?? invite.owner.email };
}
