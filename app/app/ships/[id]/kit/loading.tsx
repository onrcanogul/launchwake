export default function KitLoading() {
  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Launch kit</h1>
          <div className="psub">Writing your drafts…</div>
        </div>
      </div>
      <div className="tabs">
        {[80, 60, 90, 70].map((w, i) => (
          <div key={i} style={{ padding: "9px 13px" }}>
            <div className="skel" style={{ width: w, height: 14 }} />
          </div>
        ))}
      </div>
      <div className="kitgrid">
        <div className="draft">
          <div className="dh">
            <div className="skel" style={{ width: 160, height: 13 }} />
          </div>
          <div style={{ padding: "16px 17px", display: "grid", gap: 8 }}>
            <div className="skel" style={{ width: "92%", height: 12 }} />
            <div className="skel" style={{ width: "88%", height: 12 }} />
            <div className="skel" style={{ width: "70%", height: 12 }} />
            <div className="skel" style={{ width: "84%", height: 12 }} />
          </div>
        </div>
        <div className="kitside">
          <div className="panel" style={{ padding: 16 }}>
            <div className="skel" style={{ width: 120, height: 12, marginBottom: 10 }} />
            <div className="skel" style={{ width: "90%", height: 10, marginBottom: 7 }} />
            <div className="skel" style={{ width: "75%", height: 10 }} />
          </div>
          <div className="panel" style={{ padding: 16 }}>
            <div className="skel" style={{ width: 100, height: 12, marginBottom: 10 }} />
            <div className="skel" style={{ width: "85%", height: 10 }} />
          </div>
        </div>
      </div>
    </>
  );
}
