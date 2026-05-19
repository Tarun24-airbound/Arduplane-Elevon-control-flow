// Main app — full-width pipeline + worked examples + tweaks.

const { useState, useEffect, useRef, useMemo, useLayoutEffect } = React;

// Row groups for layout: each row contains one or two stage IDs.
const PIPELINE_ROWS = [
  { kind: "single", ids: ["1"]  },
  { kind: "single", ids: ["2"]  },
  { kind: "split",  ids: ["3A", "3B"] },
  { kind: "single", ids: ["4"]  },
  { kind: "single", ids: ["5"]  },
  { kind: "split",  ids: ["6A", "6B"] },
  { kind: "split",  ids: ["7A", "7B"] },
  { kind: "split",  ids: ["8A", "8B"] },
  { kind: "split",  ids: ["9A", "9B"] },
];

// ---------- connector SVG ----------
function Connectors({ stagePositions, containerSize, animate }) {
  if (!stagePositions || !containerSize.width) return null;

  const paths = STAGE_FLOW.map(([from, to]) => {
    const a = stagePositions[from];
    const b = stagePositions[to];
    if (!a || !b) return null;
    const x1 = a.cx;
    const y1 = a.bottom;
    const x2 = b.cx;
    const y2 = b.top;
    const midY = y1 + (y2 - y1) / 2;
    const r = 8;
    let d;
    if (Math.abs(x1 - x2) < 1) {
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else {
      const dir = x2 > x1 ? 1 : -1;
      d = [
        `M ${x1} ${y1}`,
        `V ${midY - r}`,
        `Q ${x1} ${midY} ${x1 + dir * r} ${midY}`,
        `H ${x2 - dir * r}`,
        `Q ${x2} ${midY} ${x2} ${midY + r}`,
        `V ${y2}`,
      ].join(" ");
    }
    return { from, to, d, x2, y2 };
  }).filter(Boolean);

  return (
    <svg
      className="pipeline__svg"
      width={containerSize.width}
      height={containerSize.height}
      viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
    >
      {paths.map(({ from, to, d }) => (
        <path key={`base-${from}->${to}`} d={d} className="conn" />
      ))}
      {animate && paths.map(({ from, to, d }) => (
        <path
          key={`flow-${from}->${to}`}
          d={d}
          className="conn conn--flow"
        />
      ))}
      {paths.map(({ from, to, x2, y2 }) => (
        <polygon
          key={`arr-${from}->${to}`}
          points={`${x2 - 4},${y2 - 6} ${x2 + 4},${y2 - 6} ${x2},${y2 - 1}`}
          className="conn-arrow"
        />
      ))}
    </svg>
  );
}

// ---------- pipeline ----------
function Pipeline({ expandedSet, onToggle, showFormulas, animate, density }) {
  const containerRef = useRef(null);
  const cardRefs = useRef({});
  const [positions, setPositions] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const measure = () => {
    const containerEl = containerRef.current;
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const newPositions = {};
    for (const id of Object.keys(cardRefs.current)) {
      const el = cardRefs.current[id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      newPositions[id] = {
        top: Math.round(r.top - rect.top),
        bottom: Math.round(r.bottom - rect.top),
        left: Math.round(r.left - rect.left),
        right: Math.round(r.right - rect.left),
        cx: Math.round(r.left - rect.left + r.width / 2),
      };
    }
    setPositions((prev) => {
      if (!prev) return newPositions;
      const keys = Object.keys(newPositions);
      if (keys.length !== Object.keys(prev).length) return newPositions;
      for (const k of keys) {
        const a = newPositions[k];
        const b = prev[k];
        if (!b) return newPositions;
        if (a.top !== b.top || a.bottom !== b.bottom || a.cx !== b.cx) return newPositions;
      }
      return prev;
    });
    setSize((prev) => {
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (prev.width === w && prev.height === h) return prev;
      return { width: w, height: h };
    });
  };

  useLayoutEffect(() => {
    measure();
    const t = setTimeout(measure, 120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="pipeline" ref={containerRef}>
      <Connectors
        stagePositions={positions}
        containerSize={size}
        animate={animate}
      />
      <div className="pipeline__inner">
        {PIPELINE_ROWS.map((row, ri) => (
          <div key={ri} className={`pipeline-row pipeline-row--${row.kind}`}>
            {row.ids.map((id) => {
              const stage = STAGES.find((s) => s.id === id);
              return (
                <div
                  key={id}
                  ref={(el) => (cardRefs.current[id] = el)}
                  style={{ display: "flex", justifyContent: "center" }}
                >
                  <StageCard
                    stage={stage}
                    expanded={expandedSet.has(id)}
                    onToggle={() => onToggle(id)}
                    showFormulas={showFormulas}
                    traceValue={null}
                    isActive={false}
                    density={density}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- app ----------
function App() {
  const [tweaks, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  const [expandedSet, setExpandedSet] = useState(
    window.__printMode ? new Set(STAGES.map((s) => s.id)) : new Set()
  );
  const [showFormulas, setShowFormulas] = useState(!!window.__printMode);

  const toggleStage = (id) => {
    setExpandedSet((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const expandAll = () => setExpandedSet(new Set(STAGES.map((s) => s.id)));
  const collapseAll = () => setExpandedSet(new Set());

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <div className="app__brand">
            <div className="app__brand-mark">A</div>
            <div className="app__brand-label">
              <span className="app__brand-name">ArduPlane · Attitude Pipeline</span>
              <span className="app__brand-doc">DOC-AP-CTRL-01 / rev. 2026.05</span>
            </div>
          </div>
          <h1 className="app__title">
            Intent → PWM<em></em>
          </h1>
          <p className="app__sub">
            Every step from <strong style={{color:"var(--accent)"}}>nav_roll_cd</strong> in the navigation controller
            down to <strong style={{color:"var(--accent)"}}>RCOU.C5 / RCOU.C7</strong> on the FMU pins.
            Click any stage to expand its formulas, then read two worked examples at the bottom.
          </p>
        </div>
        <div className="app__header-meta">
          <div><span className="key">airframe</span> <span className="v">flying-wing · twin elevon</span></div>
          <div><span className="key">SERVO5</span> <span className="v">→ right elevon</span></div>
          <div><span className="key">SERVO7</span> <span className="v">→ left elevon (reversed)</span></div>
          <div><span className="key">log signals</span> <span className="v">PIDR · PIDP · AETR · RCOU</span></div>
          <div><span className="key">source</span> <span className="v">ArduPlane @ master</span></div>
        </div>
      </header>

      <div className="toolbar">
        <span className="toolbar__label">View</span>
        <button className="btn" onClick={expandAll}>expand all</button>
        <button className="btn" onClick={collapseAll}>collapse all</button>
        <button
          className={`btn ${showFormulas ? "is-active" : ""}`}
          onClick={() => setShowFormulas((v) => !v)}
        >
          {showFormulas ? "✓ formulas" : "show all formulas"}
        </button>
        <div className="toolbar__spacer" />
        <div className="toolbar__legend">
          <span className="legend--nav"><span className="swatch" />navigation</span>
          <span className="legend--roll"><span className="swatch" />SERVO5 / right</span>
          <span className="legend--pitch"><span className="swatch" />SERVO7 / left</span>
          <span className="legend--mix"><span className="swatch" />mix point</span>
        </div>
      </div>

      <Pipeline
        expandedSet={expandedSet}
        onToggle={toggleStage}
        showFormulas={showFormulas}
        animate={tweaks.animateFlow}
        density={tweaks.density}
      />

      <ExamplesSection />

      <MiniCalculator />

      <footer className="app__footer">
        <div>
          unit cheat-sheet · <span style={{color:"var(--ink-dim)"}}>centideg = 0.01°</span>
          &nbsp;·&nbsp; <span style={{color:"var(--ink-dim)"}}>deg/s × 57.2958 ↔ rad/s</span>
          &nbsp;·&nbsp; <span style={{color:"var(--ink-dim)"}}>±4500 cd ↔ ±500 µs from TRIM</span>
        </div>
        <div className="app__footer-key">
          <span><kbd>click</kbd> expand stage</span>
        </div>
      </footer>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Density">
          <TweakRadio
            label="Card density"
            value={tweaks.density}
            options={["compact", "comfortable"]}
            onChange={(v) => setTweak("density", v)}
          />
        </TweakSection>
        <TweakSection title="Animation">
          <TweakToggle
            label="Animate signal flow"
            value={tweaks.animateFlow}
            onChange={(v) => setTweak("animateFlow", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
