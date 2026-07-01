export default function PlanLoading() {
  return (
    <div className="content">
      <div className="phead">
        <div>
          <h1 className="pg">Where to post</h1>
          <div className="psub">Analyzing where your users are…</div>
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div className="chan" key={i}>
          <div className="top">
            <div className="ico">
              <div className="skel" style={{ width: 17, height: 17 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="skel" style={{ width: 180, height: 13, marginBottom: 6 }} />
              <div className="skel" style={{ width: 120, height: 11 }} />
            </div>
            <div className="skel" style={{ width: 64, height: 12 }} />
          </div>
          <div style={{ padding: "0 17px 13px" }}>
            <div className="skel" style={{ width: "80%", height: 12 }} />
          </div>
          <div className="ft">
            <div className="skel" style={{ width: 220, height: 12 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
