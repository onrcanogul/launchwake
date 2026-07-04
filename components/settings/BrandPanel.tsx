"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/toast";
import { saveAgencyBrand, toggleClientReport, type BrandState } from "@/app/app/settings/actions";

type BrandData = { agencyName: string; logoUrl: string | null; accentColor: string | null };

export function BrandPanel({
  brand,
  projectId,
  reportEnabled,
  reportUrl,
}: {
  brand: BrandData | null;
  projectId: string;
  reportEnabled: boolean;
  reportUrl: string | null;
}) {
  const [state, formAction, saving] = useActionState<BrandState, FormData>(saveAgencyBrand, { ok: false });
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(reportEnabled);
  const [url, setUrl] = useState(reportUrl);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.ok) toast("Brand saved — your client reports are white-labelled");
    else if (state.error) toast(state.error, "error");
  }, [state, toast]);

  const toggle = () =>
    start(async () => {
      const next = !enabled;
      const res = await toggleClientReport(projectId, next);
      if (res.ok) {
        setEnabled(next);
        setUrl(res.token ? `${window.location.origin}/report/c/${res.token}` : url);
        toast(next ? "Client report link is live" : "Client report link paused");
      } else {
        toast(res.error ?? "Couldn't update the report", "error");
      }
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Couldn't copy", "error");
    }
  };

  return (
    <Panel title="White-label client report">
      <div className="psub" style={{ marginBottom: 14 }}>
        Send your client a branded distribution report at a stable link — your
        logo, your name, your colour. LaunchWake stays invisible.
      </div>

      <form action={formAction} className="stack">
        <div className="field">
          <label className="fl">Agency name</label>
          <input className="inp" name="agencyName" defaultValue={brand?.agencyName ?? ""} placeholder="Acme Growth" required />
        </div>
        <div className="field">
          <label className="fl">Logo URL</label>
          <input className="inp" name="logoUrl" defaultValue={brand?.logoUrl ?? ""} placeholder="https://acme.com/logo.png" />
          <div className="fhint">An https:// image URL. Shown at the top of the report.</div>
        </div>
        <div className="field">
          <label className="fl">Accent colour</label>
          <input className="inp" name="accentColor" defaultValue={brand?.accentColor ?? ""} placeholder="#3ecfb6" />
        </div>
        <div className="row-end">
          <button className="btn btn-p" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save brand"}
          </button>
        </div>
      </form>

      <div className="wl-linkrow">
        <div>
          <div className="fl" style={{ marginBottom: 2 }}>
            Client report link
            {enabled ? (
              <Badge dotColor="var(--ok)">Live</Badge>
            ) : (
              <Badge>Paused</Badge>
            )}
          </div>
          {enabled && url ? (
            <code className="wl-link">{url}</code>
          ) : (
            <div className="psub">Turn it on to mint a shareable link for this project.</div>
          )}
        </div>
        <div className="row-tight">
          {enabled && url && (
            <button className="btn btn-gh" onClick={copy}>
              <Icon name="copy" /> {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button className="btn btn-s" disabled={pending} onClick={toggle}>
            {enabled ? "Pause" : "Enable"}
          </button>
        </div>
      </div>
    </Panel>
  );
}
