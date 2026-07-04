"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { completeLaunch } from "@/app/app/ships/actions";

/** Finish Launch Mode → switch the project into Growth Mode. */
export function CompleteLaunchButton({ shipId }: { shipId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const complete = () =>
    start(async () => {
      const res = await completeLaunch(shipId);
      if (res.ok) {
        toast("Launch complete — you're now in Growth Mode");
        router.refresh();
      } else {
        toast(res.error ?? "Couldn't complete the launch", "error");
      }
    });

  return (
    <button className="btn btn-p" onClick={complete} disabled={pending}>
      <Icon name="check" />
      {pending ? "Finishing…" : "Complete launch & switch to Growth Mode"}
    </button>
  );
}
