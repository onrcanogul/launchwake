import { redirect } from "next/navigation";
import { getWorkspace, displayName, projectSubtitle } from "@/lib/session";
import { getChannelDirectory } from "@/lib/catalog";
import { AppShell } from "@/components/shell/AppShell";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Note } from "@/components/ui/Note";
import { RISK } from "@/components/ui/risk";

export default async function ChannelsPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const rows = await getChannelDirectory(ws.project);
  const platforms = new Set(rows.map((r) => r.platform)).size;

  return (
    <AppShell
      project={{ name: ws.project.name, subtitle: projectSubtitle(ws.project) }}
      user={{ name: displayName(ws.user), plan: ws.user.plan }}
      ships={ws.ships}
      activeShip={ws.activeShip}
      channelsCount={ws.channelsCount}
      crumb="Channels"
    >
      <div className="phead">
        <div>
          <h1 className="pg">Channels</h1>
          <div className="psub">
            Your living map of where {ws.project.name}&apos;s audience gathers —
            with each community&apos;s rules, ban risk and your track record.
          </div>
        </div>
        <Badge>
          {rows.length} relevant · {platforms} platforms
        </Badge>
      </div>

      <Panel>
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Fit</th>
                <th>Ban risk</th>
                <th>Best time</th>
                <th style={{ textAlign: "right" }}>Your signups</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug}>
                  <td>
                    <b>{r.name}</b>
                  </td>
                  <td className="num">{r.fit}</td>
                  <td>
                    <span
                      className="dot"
                      style={{ background: RISK[r.banRisk].color }}
                    />{" "}
                    {RISK[r.banRisk].label}
                  </td>
                  <td>{r.bestTime ?? "—"}</td>
                  <td className="num" style={{ textAlign: "right" }}>
                    {r.signups ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Note>
        This map gets sharper over time — LaunchWake learns which channels
        actually convert for products like yours.
      </Note>
    </AppShell>
  );
}
