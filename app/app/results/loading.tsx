import { Panel } from "@/components/ui/Panel";

/**
 * Results skeleton — getResultsRollup aggregates every click/signup event, so the
 * page can take a beat. Mirror the loaded layout (stat strip + a table) so the
 * shell doesn't jump when the data lands.
 */
export default function ResultsLoading() {
  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Results</h1>
          <div className="psub">
            Every post → click → signup, attributed. Do more of what brings
            customers.
          </div>
        </div>
      </div>

      <div className="stats">
        {[0, 1, 2, 3].map((i) => (
          <div className="stat" key={i}>
            <div className="skel" style={{ width: 90, height: 11, marginBottom: 10 }} />
            <div className="skel" style={{ width: 64, height: 22, marginBottom: 8 }} />
            <div className="skel" style={{ width: 72, height: 10 }} />
          </div>
        ))}
      </div>

      <Panel title="By channel" right="across all ships">
        <div className="tblwrap">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "12px 16px",
                borderTop: i === 0 ? "none" : "1px solid var(--line)",
              }}
            >
              <div className="skel" style={{ flex: 1, height: 13 }} />
              <div className="skel" style={{ width: 48, height: 13 }} />
              <div className="skel" style={{ width: 48, height: 13 }} />
              <div className="skel" style={{ width: 64, height: 13 }} />
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
