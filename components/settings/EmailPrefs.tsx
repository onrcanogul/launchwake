"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/toast";
import { setEmailPreference } from "@/app/app/settings/actions";

/**
 * Email-preferences row: one switch for product-notification emails (weekly
 * digest + "plan ready"). Default on; the emails also carry a one-click
 * unsubscribe link that flips the same flag.
 */
export function EmailPrefs({ initialEnabled }: { initialEnabled: boolean }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      const next = !enabled;
      const res = await setEmailPreference(next);
      if (res.ok) {
        setEnabled(next);
        toast(next ? "Emails on — digest resumes Monday" : "Emails off — no more digests");
      } else {
        toast(res.error ?? "Couldn't save", "error");
      }
    });

  return (
    <div className="setrow">
      <div className="l">
        <b>Weekly digest &amp; plan notifications</b>
        <span>
          Monday recap, launch radar, and &ldquo;your distribution plan is
          ready&rdquo; when a release is auto-detected. Every email has a
          one-click unsubscribe.
        </span>
      </div>
      <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
        {enabled ? <Badge dotColor="var(--ok)">On</Badge> : <Badge>Off</Badge>}
        <button
          className="btn btn-s"
          onClick={toggle}
          disabled={pending}
          aria-pressed={enabled}
        >
          <Icon name={enabled ? "x" : "check"} />
          {pending ? "Saving…" : enabled ? "Turn off" : "Turn on"}
        </button>
      </div>
    </div>
  );
}
