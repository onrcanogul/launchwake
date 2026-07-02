"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import {
  inviteTeamMember,
  revokeTeamInvite,
  removeTeamMember,
} from "@/app/app/settings/actions";
import type { TeamView } from "@/lib/team";

export function TeamPanel({ team }: { team: TeamView }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [lastLink, setLastLink] = useState<string | null>(null);
  const { seats } = team;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copied`);
    } catch {
      toast("Couldn't copy", "error");
    }
  };

  const invite = () =>
    start(async () => {
      const res = await inviteTeamMember(email);
      if (res.ok) {
        setEmail("");
        setLastLink(res.url);
        router.refresh();
        toast(`Invite ready for ${res.email}`);
      } else {
        toast(res.error, "error");
      }
    });

  const revoke = (id: string) =>
    start(async () => {
      const res = await revokeTeamInvite(id);
      if (res.ok) {
        router.refresh();
        toast("Invite revoked");
      } else toast(res.error ?? "Failed", "error");
    });

  const remove = (id: string, who: string) =>
    start(async () => {
      const res = await removeTeamMember(id);
      if (res.ok) {
        router.refresh();
        toast(`Removed ${who}`);
      } else toast(res.error ?? "Failed", "error");
    });

  const full = seats.available < 1;

  return (
    <div style={{ padding: "14px 16px" }}>
      <div className="setrow" style={{ paddingTop: 0 }}>
        <div className="l">
          <b>
            {seats.used} of {seats.purchased} seats used
          </b>
          <span>Owner + members + pending invites. Add seats in the plan below.</span>
        </div>
        <div className="ld-bar" style={{ width: 140 }} aria-hidden>
          <span style={{ width: `${Math.min(100, (seats.used / Math.max(1, seats.purchased)) * 100)}%` }} />
        </div>
      </div>

      {/* Members */}
      <div className="tm-list">
        <div className="tm-row">
          <div className="tm-who">
            <span className="tm-av">{(team.owner.name ?? team.owner.email).charAt(0).toUpperCase()}</span>
            <div>
              <b>{team.owner.name ?? team.owner.email}</b>
              <span>{team.owner.email}</span>
            </div>
          </div>
          <span className="badge">Owner</span>
        </div>
        {team.members.map((m) => (
          <div className="tm-row" key={m.id}>
            <div className="tm-who">
              <span className="tm-av">{(m.name ?? m.email).charAt(0).toUpperCase()}</span>
              <div>
                <b>{m.name ?? m.email}{m.you ? " (you)" : ""}</b>
                <span>{m.email}</span>
              </div>
            </div>
            <button className="btn btn-gh" disabled={pending} onClick={() => remove(m.id, m.email)}>
              Remove
            </button>
          </div>
        ))}
        {team.invites.map((inv) => (
          <div className="tm-row" key={inv.id}>
            <div className="tm-who">
              <span className="tm-av" style={{ background: "var(--bg3)", color: "var(--tx3)" }}>
                <Icon name="mail" style={{ width: 14, height: 14, stroke: "currentColor", strokeWidth: 1.7, fill: "none" }} />
              </span>
              <div>
                <b>{inv.email}</b>
                <span style={{ color: "var(--warn)" }}>Pending invite</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-s" onClick={() => copy(inv.url, "Invite link")}>
                <Icon name="copy" /> Copy link
              </button>
              <button className="btn btn-gh" disabled={pending} onClick={() => revoke(inv.id)}>
                Revoke
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Invite form */}
      <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <label className="fl">Invite a teammate</label>
        <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <input
            className="inp"
            type="email"
            placeholder={full ? "No seats left — add seats first" : "teammate@company.com"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={full}
            style={{ flex: 1, minWidth: 220 }}
          />
          <button className="btn btn-p" disabled={pending || full || !email.trim()} onClick={invite}>
            <Icon name="plus" /> {pending ? "…" : "Send invite"}
          </button>
        </div>
        {lastLink && (
          <div className="fhint" style={{ marginTop: 8 }}>
            Invite link ready — share it:{" "}
            <button className="btn btn-s" style={{ marginLeft: 6 }} onClick={() => copy(lastLink, "Invite link")}>
              <Icon name="copy" /> Copy link
            </button>
          </div>
        )}
        <div className="fhint" style={{ marginTop: 8 }}>
          Members share your workspace — your projects, plans, and results. Billing stays with you.
        </div>
      </div>
    </div>
  );
}
