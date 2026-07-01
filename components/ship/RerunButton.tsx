"use client";

import { useTransition } from "react";
import { Icon } from "@/components/Icon";
import { rerunPlan } from "@/app/app/ships/actions";

export function RerunButton({ shipId }: { shipId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-s"
      disabled={pending}
      onClick={() => start(() => rerunPlan(shipId))}
    >
      <Icon name="refresh" />
      {pending ? "Re-running…" : "Re-run"}
    </button>
  );
}
