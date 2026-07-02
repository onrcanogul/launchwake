"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { setPublicReport, setReportRevenue } from "@/app/app/ships/actions";

/**
 * Share panel on Launch day: flip the launch public → get a shareable report URL
 * (+ "Powered by LaunchWake" badge embed). The viral loop's control surface.
 */
export function ShareReport({
  shipId,
  appUrl,
  initialUrl,
  initialShowRevenue,
}: {
  shipId: string;
  appUrl: string;
  initialUrl: string | null;
  initialShowRevenue: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [showRevenue, setShowRevenue] = useState(initialShowRevenue);
  const isPublic = Boolean(url);
  const base = appUrl.replace(/\/$/, "");

  const badgeEmbed = `<a href="${base}/?ref=badge" target="_blank" rel="noopener">
  <img src="${base}/api/badge" alt="Powered by LaunchWake" width="186" height="32" />
</a>`;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copied`);
    } catch {
      toast("Couldn't copy", "error");
    }
  };

  const togglePublic = () =>
    start(async () => {
      const res = await setPublicReport(shipId, !isPublic);
      if (res.ok) {
        setUrl(res.url);
        setShowRevenue(res.showRevenue);
        router.refresh();
        toast(res.url ? "Report is live — share it" : "Report is now private");
      } else {
        toast(res.error, "error");
      }
    });

  const toggleRevenue = () =>
    start(async () => {
      const res = await setReportRevenue(shipId, !showRevenue);
      if (res.ok) {
        setShowRevenue(res.showRevenue);
        router.refresh();
        toast(res.showRevenue ? "Revenue shown on report" : "Revenue hidden");
      } else {
        toast(res.error, "error");
      }
    });

  return (
    <div className="share">
      <div className="share-head">
        <div>
          <b>
            <Icon name="rocket" style={{ width: 14, height: 14, stroke: "var(--ac)", strokeWidth: 1.8, fill: "none", verticalAlign: "-2px", marginRight: 6 }} />
            Public launch report
          </b>
          <span>
            Share how you launched — a public page with a “Powered by LaunchWake”
            badge. The viral loop.
          </span>
        </div>
        <button
          className={`btn ${isPublic ? "btn-s" : "btn-p"}`}
          onClick={togglePublic}
          disabled={pending}
        >
          {isPublic ? "Make private" : pending ? "…" : "Make it public"}
        </button>
      </div>

      {isPublic && url && (
        <div className="share-body">
          <div className="share-url">
            <code className="mono">{url}</code>
            <button className="btn btn-s" onClick={() => copy(url, "Report link")}>
              <Icon name="copy" /> Copy
            </button>
            <a className="btn btn-s" href={url} target="_blank" rel="noopener noreferrer">
              <Icon name="external" /> View
            </a>
            <a
              className="btn btn-s"
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("How we launched 🚀")}&url=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="x" /> Share
            </a>
          </div>

          <label className="share-toggle">
            <input type="checkbox" checked={showRevenue} onChange={toggleRevenue} disabled={pending} />
            Show revenue on the public report
            <span className="share-hint">off by default — only turn on if you want $ public</span>
          </label>

          <div className="share-embed">
            <div className="share-embed-hd">Embed the badge on your site</div>
            <pre className="mono">{badgeEmbed}</pre>
            <button className="btn btn-s" onClick={() => copy(badgeEmbed, "Badge embed")}>
              <Icon name="copy" /> Copy embed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
