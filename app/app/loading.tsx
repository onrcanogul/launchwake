/**
 * Fallback skeleton for every interior route that doesn't ship its own
 * loading.tsx. The sidebar (app/app/layout.tsx) stays mounted; only this
 * content area is swapped in instantly on navigation, so a click gives
 * immediate feedback instead of a frozen page while the server renders.
 */
export default function AppLoading() {
  return (
    <>
      <div className="phead">
        <div>
          <div
            className="skel"
            style={{ width: 168, height: 20, marginBottom: 9 }}
          />
          <div className="skel" style={{ width: 240, height: 12 }} />
        </div>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div
          className="panel"
          key={i}
          style={{ padding: 17, marginBottom: 12 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="skel" style={{ width: 34, height: 34, borderRadius: 8 }} />
            <div style={{ flex: 1 }}>
              <div
                className="skel"
                style={{ width: 200, height: 13, marginBottom: 7 }}
              />
              <div className="skel" style={{ width: 120, height: 11 }} />
            </div>
            <div className="skel" style={{ width: 64, height: 12 }} />
          </div>
        </div>
      ))}
    </>
  );
}
