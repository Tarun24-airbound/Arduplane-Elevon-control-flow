// Compact AETR → RCOU calculator
// Inputs: AETR.Ail, AETR.Elev, mixing_gain
// Constants: SERVO5 (right, non-reversed), SERVO7 (left, reversed); MIN/TRIM/MAX = 1000/1500/2000

const clampCalc = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Smoothly interpolate a numeric value toward a target.
// Uses ease-out-cubic over `duration` ms, cancellable mid-flight.
function useTweenedValue(target, duration = 200) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  const ref = React.useRef({
    current: target,
    from: target,
    to: target,
    start: 0,
    raf: 0,
  });

  React.useEffect(() => {
    const state = ref.current;
    if (target === state.to && state.current === target) return;
    state.from = state.current;
    state.to = target;
    state.start = performance.now();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const elapsed = now - state.start;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      state.current = state.from + (state.to - state.from) * eased;
      force();
      if (t < 1) {
        state.raf = requestAnimationFrame(tick);
      } else {
        state.current = state.to;
        force();
      }
    };

    cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(state.raf);
  }, [target, duration]);

  return ref.current.current;
}

function computeRCOU(ail, elev, gain) {
  // Stage 5 — elevon mixing (clamped to ±4500)
  const s5_raw = (elev - ail) * gain;
  const s7_raw = (elev + ail) * gain;
  const s5 = clampCalc(s5_raw, -4500, 4500);
  const s7 = clampCalc(s7_raw, -4500, 4500);

  // Stage 7 — reverse (SERVO5: pass-through, SERVO7: negated)
  const s5_final = s5;
  const s7_final = -s7;

  // Stage 8 — pwm_from_angle with MIN=1000, TRIM=1500, MAX=2000
  const pwm = (fs) => {
    if (fs >= 0) return 1500 + (fs / 4500) * 500;
    return 1500 - (Math.abs(fs) / 4500) * 500;
  };
  const c5 = pwm(s5_final);
  const c7 = pwm(s7_final);

  return {
    s5_raw, s7_raw,
    s5, s7,
    s5_final, s7_final,
    c5, c7,
    s5_clamped: s5_raw !== s5,
    s7_clamped: s7_raw !== s7,
  };
}

function MiniPlane({ s5_final, s7_final, c5, c7 }) {
  // Map ±4500 cd to ±25° visual deflection (capped for legibility)
  // s5_final drives the RIGHT elevon, s7_final drives the LEFT
  const visAngle = (cd) => Math.max(-25, Math.min(25, (cd / 4500) * 25));
  const dRight = visAngle(s5_final);
  const dLeft  = visAngle(s7_final);

  // Left elevon: hinge at its inboard-trailing corner (-30, 6)
  // Right elevon: hinge at (30, 6)
  return (
    <svg viewBox="-110 -50 220 110" className="mini-plane__svg">
      {/* compass */}
      <g stroke="rgba(94,234,212,0.18)" strokeWidth="0.4" fill="none">
        <line x1="-100" y1="0" x2="100" y2="0" strokeDasharray="2 3" />
        <line x1="0" y1="-40" x2="0" y2="50" strokeDasharray="2 3" />
        <text x="0" y="-43" textAnchor="middle" fill="var(--ink-faint)" fontSize="4" fontFamily="JetBrains Mono">
          NOSE ↑
        </text>
      </g>

      {/* fuselage / wing body — a delta */}
      <polygon
        points="-90,8 0,-38 90,8 30,8 0,2 -30,8"
        fill="rgba(94,234,212,0.05)"
        stroke="var(--accent)"
        strokeWidth="0.8"
      />
      {/* center body */}
      <polygon
        points="-9,-15 9,-15 7,8 -7,8"
        fill="rgba(94,234,212,0.10)"
        stroke="var(--accent)"
        strokeWidth="0.6"
      />
      <circle cx="0" cy="-6" r="2" fill="var(--accent)" />

      {/* elevon hinge lines */}
      <line x1="-86" y1="8" x2="-30" y2="8" stroke="var(--ink-faint)" strokeWidth="0.4" strokeDasharray="1 1" />
      <line x1="86"  y1="8" x2="30"  y2="8" stroke="var(--ink-faint)" strokeWidth="0.4" strokeDasharray="1 1" />

      {/* LEFT elevon (driven by SERVO7) */}
      <g transform={`translate(-30 6) rotate(${-dLeft})`}>
        <polygon
          points="0,0 -56,-3 -56,12 0,12"
          fill="rgba(56,189,248,0.18)"
          stroke="var(--cool)"
          strokeWidth="1"
        />
        <line x1="0" y1="0" x2="0" y2="12" stroke="var(--cool)" strokeWidth="1.2" strokeDasharray="2 2" />
      </g>

      {/* RIGHT elevon (driven by SERVO5) */}
      <g transform={`translate(30 6) rotate(${dRight})`}>
        <polygon
          points="0,0 56,-3 56,12 0,12"
          fill="rgba(245,158,11,0.18)"
          stroke="var(--warn)"
          strokeWidth="1"
        />
        <line x1="0" y1="0" x2="0" y2="12" stroke="var(--warn)" strokeWidth="1.2" strokeDasharray="2 2" />
      </g>

      {/* labels */}
      <text x="-58" y="22" textAnchor="middle" fill="var(--cool)" fontSize="4.5" fontFamily="JetBrains Mono">SERVO7 / RCOU.C7</text>
      <text x="58"  y="22" textAnchor="middle" fill="var(--warn)" fontSize="4.5" fontFamily="JetBrains Mono">SERVO5 / RCOU.C5</text>
      <text x="-58" y="28" textAnchor="middle" fill="var(--ink-dim)" fontSize="4" fontFamily="JetBrains Mono">left elevon · reversed</text>
      <text x="58"  y="28" textAnchor="middle" fill="var(--ink-dim)" fontSize="4" fontFamily="JetBrains Mono">right elevon</text>

      {/* live PWM */}
      <text x="-58" y="38" textAnchor="middle" fill="var(--ink)" fontSize="6" fontFamily="JetBrains Mono" fontWeight="600">
        {Math.round(c7)} µs
      </text>
      <text x="58"  y="38" textAnchor="middle" fill="var(--ink)" fontSize="6" fontFamily="JetBrains Mono" fontWeight="600">
        {Math.round(c5)} µs
      </text>
      <text x="-58" y="44" textAnchor="middle" fill="var(--ink-faint)" fontSize="3.5" fontFamily="JetBrains Mono">
        {dLeft >= 0 ? "+" : ""}{dLeft.toFixed(1)}° vis
      </text>
      <text x="58"  y="44" textAnchor="middle" fill="var(--ink-faint)" fontSize="3.5" fontFamily="JetBrains Mono">
        {dRight >= 0 ? "+" : ""}{dRight.toFixed(1)}° vis
      </text>
    </svg>
  );
}

function MiniCalcInput({ label, value, onChange, step = 1, hint }) {
  return (
    <label className="mc-input">
      <div className="mc-input__row">
        <span className="mc-input__lbl">{label}</span>
        {hint && <span className="mc-input__hint">{hint}</span>}
      </div>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || v === "-") {
            onChange(0);
            return;
          }
          const n = parseFloat(v);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    </label>
  );
}

function MiniCalcReadout({ ch, side, value, mixingClamped, finalScaled, changing }) {
  const sign = (n) => (n > 1500 ? "+" : "");
  const delta = Math.round(value - 1500);
  const isSaturated = Math.abs(finalScaled) >= 4499;
  return (
    <div className={`mc-out ${isSaturated ? "mc-out--saturated" : ""} ${changing ? "mc-out--changing" : ""}`}>
      <div className="mc-out__hdr">
        <span className={`mc-out__dot mc-out__dot--${ch.toLowerCase()}`} />
        <span className="mc-out__name">RCOU.{ch}</span>
        <span className="mc-out__side">{side}</span>
      </div>
      <div className="mc-out__val">
        {Math.round(value)}<em>µs</em>
      </div>
      <div className="mc-out__delta">
        {delta === 0 ? "neutral" : `${sign(value)}${delta} µs from TRIM`}
        {mixingClamped && <span className="mc-out__warn"> · mixing clamped</span>}
        {isSaturated && <span className="mc-out__warn"> · channel saturated</span>}
      </div>
    </div>
  );
}

function MiniCalculator() {
  const [ail,  setAil]  = React.useState(92);
  const [elev, setElev] = React.useState(-760);
  const [gain, setGain] = React.useState(1.0);

  const r = React.useMemo(() => computeRCOU(ail, elev, gain), [ail, elev, gain]);

  // Tweened display values — physical surfaces and PWMs ease toward target;
  // the intermediate panel keeps the instantaneous (un-tweened) numbers.
  const tc5  = useTweenedValue(r.c5,       250);
  const tc7  = useTweenedValue(r.c7,       250);
  const ts5  = useTweenedValue(r.s5_final, 150);
  const ts7  = useTweenedValue(r.s7_final, 150);

  return (
    <section className="mini-calc">
      <header className="mini-calc__head">
        <div className="mini-calc__eyebrow">LIVE CALCULATOR</div>
        <h2 className="mini-calc__title">AETR → RCOU · play with mixing_gain</h2>
        <p className="mini-calc__sub">
          Three knobs. Constants held fixed at SERVO5 → right (non-reversed),
          SERVO7 → left (reversed), MIN/TRIM/MAX&nbsp;=&nbsp;1000/1500/2000 µs.
        </p>
      </header>

      <div className="mini-calc__body">
        <div className="mini-calc__inputs">
          <MiniCalcInput
            label="AETR.Ail"
            hint="cd · ±4500"
            value={ail}
            onChange={setAil}
            step={50}
          />
          <MiniCalcInput
            label="AETR.Elev"
            hint="cd · ±4500"
            value={elev}
            onChange={setElev}
            step={50}
          />
          <MiniCalcInput
            label="mixing_gain"
            hint="× scale"
            value={gain}
            onChange={setGain}
            step={0.05}
          />

          <div className="mini-calc__intermediate">
            <div className="mc-intermediate__title">INTERMEDIATE</div>
            <div className="mc-intermediate__row">
              <span className="mc-intermediate__lbl">servo5_scaled</span>
              <span className="mc-intermediate__val">
                {Math.round(r.s5)}<em>cd</em>
                {r.s5_clamped && <span className="mc-intermediate__flag">clamped</span>}
              </span>
            </div>
            <div className="mc-intermediate__row">
              <span className="mc-intermediate__lbl">servo7_scaled</span>
              <span className="mc-intermediate__val">
                {Math.round(r.s7)}<em>cd</em>
                {r.s7_clamped && <span className="mc-intermediate__flag">clamped</span>}
              </span>
            </div>
            <div className="mc-intermediate__row">
              <span className="mc-intermediate__lbl">final (S5 / S7)</span>
              <span className="mc-intermediate__val">
                {Math.round(r.s5_final)} / {Math.round(r.s7_final)}<em>cd</em>
              </span>
            </div>
          </div>
        </div>

        <div className="mini-calc__plane">
          <MiniPlane
            s5_final={ts5}
            s7_final={ts7}
            c5={tc5}
            c7={tc7}
          />
        </div>

        <div className="mini-calc__outputs">
          <MiniCalcReadout
            ch="C7"
            side="left elevon · reversed"
            value={tc7}
            mixingClamped={r.s7_clamped}
            finalScaled={r.s7_final}
            changing={Math.abs(tc7 - r.c7) > 0.5}
          />
          <MiniCalcReadout
            ch="C5"
            side="right elevon"
            value={tc5}
            mixingClamped={r.s5_clamped}
            finalScaled={r.s5_final}
            changing={Math.abs(tc5 - r.c5) > 0.5}
          />
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { MiniCalculator, computeRCOU });
