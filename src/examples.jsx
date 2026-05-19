// Two worked examples: AETR.{Ail,Elev} → RCOU.C5 / RCOU.C7
// All math is pre-computed so the cards stay simple and verifiable.

const EXAMPLES = [
  {
    id: "ex1",
    label: "EX-01 · everyday correction",
    title: "Small roll-right + slight nose-down",
    note: "Typical mid-flight correction. Both elevons stay well inside their travel.",
    inputs: { ail: 92, elev: -760 },
    // Stage 5 — mixing (clamped to ±4500)
    mix:  { s5: -852, s7: -668 },   // s5 = elev - ail, s7 = elev + ail
    // Stage 7 — reverse
    rev:  { s5: -852, s7: 668 },    // s7 negated (REVERSED=1)
    // Stage 8/9 — pwm_from_angle, MIN=1000 TRIM=1500 MAX=2000
    pwm:  { c5: 1405, c7: 1574 },
    pwmExact: { c5: 1500 - (852 / 4500) * 500, c7: 1500 + (668 / 4500) * 500 },
    saturated: false,
  },
  {
    id: "ex2",
    label: "EX-02 · pinned demand",
    title: "Full nose-down + full left roll (both AETR rails)",
    note: "Both pre-mix channels are pinned at −4500. Watch only one elevon channel saturate — Stage 5's identity in action.",
    inputs: { ail: -4500, elev: -4500 },
    mix:  { s5: 0, s7: -4500 },     // s7 raw = -9000 → clamp to -4500
    rev:  { s5: 0, s7: 4500 },      // s7 reverse applied
    pwm:  { c5: 1500, c7: 2000 },
    pwmExact: { c5: 1500, c7: 2000 },
    saturated: true,
    saturationNote: "servo7 raw value would have been −9000; clamped to −4500. After reverse flip it pins at +4500 → PWM 2000 µs. Meanwhile servo5 cancels exactly to 0 → 1500 µs.",
  },
];

function ExampleStep({ stage, label, formula, values }) {
  return (
    <div className="ex-step">
      <div className="ex-step__head">
        <span className="ex-step__stage">{stage}</span>
        <span className="ex-step__label">{label}</span>
      </div>
      <pre className="ex-step__formula">{formula}</pre>
      <div className="ex-step__values">
        {values.map((v, i) => (
          <div className="ex-val" key={i}>
            <span className="ex-val__name">{v.name}</span>
            <span className="ex-val__sep">=</span>
            <span className="ex-val__num">{v.value}</span>
            {v.unit && <span className="ex-val__unit">{v.unit}</span>}
            {v.note && <span className="ex-val__note">{v.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExampleCard({ ex }) {
  const fmt = (n) => (Number.isInteger(n) ? n : n.toFixed(2));
  const sign = (n) => (n > 0 ? "+" : "");

  return (
    <article className={`ex-card ${ex.saturated ? "ex-card--saturated" : ""}`}>
      <header className="ex-card__head">
        <div className="ex-card__label">{ex.label}</div>
        <h3 className="ex-card__title">{ex.title}</h3>
        <p className="ex-card__note">{ex.note}</p>
      </header>

      <div className="ex-card__inputs">
        <div className="ex-input">
          <span className="ex-input__lbl">AETR.Ail</span>
          <span className="ex-input__val">{sign(ex.inputs.ail)}{ex.inputs.ail}</span>
          <span className="ex-input__unit">cd</span>
        </div>
        <div className="ex-input">
          <span className="ex-input__lbl">AETR.Elev</span>
          <span className="ex-input__val">{sign(ex.inputs.elev)}{ex.inputs.elev}</span>
          <span className="ex-input__unit">cd</span>
        </div>
      </div>

      <ExampleStep
        stage="STAGE 5"
        label="ELEVON MIXING · clamp ±4500"
        formula={`servo5_scaled = AETR.Elev − AETR.Ail = ${ex.inputs.elev} − (${ex.inputs.ail}) = ${ex.inputs.elev - ex.inputs.ail}\nservo7_scaled = AETR.Elev + AETR.Ail = ${ex.inputs.elev} + (${ex.inputs.ail}) = ${ex.inputs.elev + ex.inputs.ail}`}
        values={[
          {
            name: "servo5_scaled",
            value: `${sign(ex.mix.s5)}${ex.mix.s5}`,
            unit: "cd",
            note: ex.saturated && (ex.inputs.elev - ex.inputs.ail) !== ex.mix.s5 ? `clamped from ${ex.inputs.elev - ex.inputs.ail}` : null,
          },
          {
            name: "servo7_scaled",
            value: `${sign(ex.mix.s7)}${ex.mix.s7}`,
            unit: "cd",
            note: ex.saturated && (ex.inputs.elev + ex.inputs.ail) !== ex.mix.s7 ? `clamped from ${ex.inputs.elev + ex.inputs.ail}` : null,
          },
        ]}
      />

      <ExampleStep
        stage="STAGE 7"
        label="REVERSE · SERVO7_REVERSED = 1"
        formula={`SERVO5 (right) : final = servo5_scaled              // pass-through\nSERVO7 (left)  : final = servo7_scaled × (−1)`}
        values={[
          { name: "final (S5)", value: `${sign(ex.rev.s5)}${ex.rev.s5}`, unit: "cd" },
          { name: "final (S7)", value: `${sign(ex.rev.s7)}${ex.rev.s7}`, unit: "cd" },
        ]}
      />

      <ExampleStep
        stage="STAGE 8"
        label="pwm_from_angle · MIN/TRIM/MAX = 1000/1500/2000"
        formula={
          ex.rev.s5 >= 0
            ? `PWM(S5) = 1500 + (${ex.rev.s5} / 4500) × 500 = ${fmt(ex.pwmExact.c5)}\nPWM(S7) = ${ex.rev.s7 >= 0 ? `1500 + (${ex.rev.s7} / 4500) × 500` : `1500 − (${Math.abs(ex.rev.s7)} / 4500) × 500`} = ${fmt(ex.pwmExact.c7)}`
            : `PWM(S5) = 1500 − (${Math.abs(ex.rev.s5)} / 4500) × 500 = ${fmt(ex.pwmExact.c5)}\nPWM(S7) = ${ex.rev.s7 >= 0 ? `1500 + (${ex.rev.s7} / 4500) × 500` : `1500 − (${Math.abs(ex.rev.s7)} / 4500) × 500`} = ${fmt(ex.pwmExact.c7)}`
        }
        values={[
          { name: "PWM (S5)", value: ex.pwm.c5, unit: "µs" },
          { name: "PWM (S7)", value: ex.pwm.c7, unit: "µs" },
        ]}
      />

      {ex.saturationNote && (
        <div className="ex-card__saturation">⚠ {ex.saturationNote}</div>
      )}

      <footer className="ex-card__out">
        <div className="ex-out">
          <div className="ex-out__hdr">
            <span className="ex-out__dot ex-out__dot--c5" />
            <span className="ex-out__name">RCOU.C5</span>
            <span className="ex-out__side">right elevon</span>
          </div>
          <div className="ex-out__val">
            {ex.pwm.c5}<em>µs</em>
          </div>
          <div className="ex-out__delta">
            {ex.pwm.c5 === 1500 ? "neutral" : `${ex.pwm.c5 > 1500 ? "+" : ""}${ex.pwm.c5 - 1500} µs from TRIM`}
          </div>
        </div>
        <div className="ex-out">
          <div className="ex-out__hdr">
            <span className="ex-out__dot ex-out__dot--c7" />
            <span className="ex-out__name">RCOU.C7</span>
            <span className="ex-out__side">left elevon · reversed</span>
          </div>
          <div className="ex-out__val">
            {ex.pwm.c7}<em>µs</em>
          </div>
          <div className="ex-out__delta">
            {ex.pwm.c7 === 1500 ? "neutral" : `${ex.pwm.c7 > 1500 ? "+" : ""}${ex.pwm.c7 - 1500} µs from TRIM`}
          </div>
        </div>
      </footer>
    </article>
  );
}

function ExamplesSection() {
  return (
    <section className="examples">
      <header className="examples__head">
        <div className="examples__eyebrow">CASE STUDIES</div>
        <h2 className="examples__title">AETR → RCOU, worked through</h2>
        <p className="examples__sub">
          Two numerical traces from Stage 4 (AETR log) all the way to Stage 9 (RCOU hardware out).
          Servo trims assumed at the standard <span className="kbd-inline">1000 / 1500 / 2000 µs</span> with
          <span className="kbd-inline">mixing_gain = 1.0</span>, SERVO5 → right elevon (non-reversed),
          SERVO7 → left elevon (reversed).
        </p>
      </header>

      <div className="examples__grid">
        {EXAMPLES.map((ex) => (
          <ExampleCard ex={ex} key={ex.id} />
        ))}
      </div>
    </section>
  );
}

Object.assign(window, { EXAMPLES, ExamplesSection });
