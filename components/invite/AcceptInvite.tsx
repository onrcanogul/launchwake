"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { acceptTeamInvite } from "@/app/invite/actions";

export function AcceptInvite({
  token,
  loggedIn,
}: {
  token: string;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  if (!loggedIn) {
    return (
      <Link
        href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
        className="btn btn-p btn-lg"
        style={{ width: "auto" }}
      >
        <Icon name="arrowRight" /> Sign in to accept
      </Link>
    );
  }

  return (
    <button
      className="btn btn-p btn-lg"
      style={{ width: "auto" }}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await acceptTeamInvite(token);
          if (res.ok) {
            toast("Welcome to the team");
            router.push("/app");
            router.refresh();
          } else {
            toast(res.error ?? "Couldn't accept", "error");
          }
        })
      }
    >
      <Icon name="check" /> {pending ? "Joining…" : "Accept invite"}
    </button>
  );
}
