"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { leaveTeam } from "@/app/app/settings/actions";

export function LeaveTeamButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-s"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await leaveTeam();
          if (res.ok) {
            toast("You left the team");
            router.push("/app");
            router.refresh();
          } else toast(res.error ?? "Failed", "error");
        })
      }
    >
      {pending ? "Leaving…" : "Leave team"}
    </button>
  );
}
