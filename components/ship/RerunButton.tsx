"use client";

import { useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { rerunPlan } from "@/app/app/ships/actions";

export function RerunButton({ shipId }: { shipId: string }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-s"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await rerunPlan(shipId);
            toast("Plan updated");
          } catch {
            toast("Could not re-run the plan", "error");
          }
        })
      }
    >
      <Icon name="refresh" />
      {pending ? "Re-running…" : "Re-run"}
    </button>
  );
}
