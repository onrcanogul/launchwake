/**
 * Fallback skeleton for every interior route that doesn't ship its own
 * loading.tsx. The sidebar (app/app/layout.tsx) stays mounted; only this
 * content area is swapped in instantly on navigation, so a click gives
 * immediate feedback instead of a frozen page while the server renders.
 * Shape mirrors the ship feed (the index route): header → stat strip → panel
 * of list rows, which is also representative of the other interior screens.
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
        <div className="skel" style={{ width: 96, height: 30 }} />
      </div>

      <div className="stats">
        {[0, 1, 2, 3].map((i) => (
          <div className="stat" key={i}>
            <div
              className="skel"
              style={{ width: 82, height: 10, marginBottom: 12 }}
            />
            <div
              className="skel"
              style={{ width: 56, height: 22, marginBottom: 9 }}
            />
            <div className="skel" style={{ width: 104, height: 10 }} />
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="ph">
          <div className="skel" style={{ width: 90, height: 13 }} />
          <div className="skel" style={{ width: 52, height: 11 }} />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div className="li" key={i} style={{ cursor: "default" }}>
            <div className="lft">
              <div className="skel" style={{ width: 52, height: 18 }} />
              <div>
                <div
                  className="skel"
                  style={{ width: 220, height: 13, marginBottom: 7 }}
                />
                <div className="skel" style={{ width: 140, height: 11 }} />
              </div>
            </div>
            <div className="skel" style={{ width: 76, height: 20 }} />
          </div>
        ))}
      </div>
    </>
  );
}
