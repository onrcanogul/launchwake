"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { ensurePlan } from "@/app/app/ships/actions";

/**
 * First-run auto-analysis: kicks off the plan build for a freshly-created ship
 * that has no plan yet, while the page shows the "analyzing" skeleton. On success
 * it refreshes into the finished plan (the aha moment).
 */
export function AutoBuildPlan({ shipId }: { shipId: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    ensurePlan(shipId).then((res) => {
      if (res.ok) router.refresh();
      else setError(res.error ?? "Analysis failed");
    });
  }, [shipId, router]);

  if (!error) return null;

  return (
    <div className="note" style={{ borderColor: "rgba(240,97,109,.35)" }}>
      <Icon name="shield" />
      <span>
        {error}{" "}
        <button
          className="btn btn-gh"
          style={{ padding: "2px 6px" }}
          onClick={() => {
            setError(null);
            started.current = false;
            router.refresh();
          }}
        >
          Try again
        </button>
      </span>
    </div>
  );
}
