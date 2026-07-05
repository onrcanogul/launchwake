export default function ResultsLoading() {
  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Results</h1>
          <div className="psub">Rolling up clicks, signups and conversions…</div>
        </div>
      </div>
      <div className="stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat">
            <div className="skel" style={{ width: 90, height: 10, marginBottom: 8 }} />
            <div className="skel" style={{ width: 56, height: 18 }} />
          </div>
        ))}
      </div>
      <div className="panel">
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)" }}>
          <div className="skel" style={{ width: 110, height: 12 }} />
        </div>
        <div style={{ padding: "14px 16px", display: "grid", gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div className="skel" style={{ width: 150, height: 12 }} />
              <div className="skel" style={{ width: 44, height: 12, marginLeft: "auto" }} />
              <div className="skel" style={{ width: 44, height: 12 }} />
              <div className="skel" style={{ width: 90, height: 12 }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
