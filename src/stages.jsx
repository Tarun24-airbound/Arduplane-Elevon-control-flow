// Stage data + StageCard component
// All 9 stages of the ArduPlane attitude → servo pipeline.

const STAGES = [
  {
    id: "1",
    title: "NAV TARGET",
    subtitle: "Navigation controller emits desired attitude",
    summary: "AUTO / LOITER set by nav + TECS. STABILIZE / FBWA set by pilot stick scaled to angle limit. MANUAL bypasses every downstream stage — RC goes straight to servos.",
    outputs: [
      { name: "nav_roll_cd",  unit: "centideg" },
      { name: "nav_pitch_cd", unit: "centideg" },
    ],
    files: ["ArduPlane/Attitude.cpp:585", "ArduPlane/navigation.cpp"],
    formulas: [
      { label: "Pilot stick → angle (FBWA)", body: "nav_roll_cd  = stick_x × LIM_ROLL_CD\nnav_pitch_cd = stick_y × LIM_PITCH_MAX_CD" },
    ],
    accent: "accent",
    placement: "center",
  },
  {
    id: "2",
    title: "ANGLE ERROR",
    subtitle: "Demand − measured attitude",
    summary: "Subtract EKF-fused AHRS attitude from the navigation demand. Pitch demand picks up two feedforward terms (trim + throttle-to-pitch) before the error is taken.",
    outputs: [
      { name: "roll_error_cd",  unit: "centideg" },
      { name: "pitch_error_cd", unit: "centideg" },
    ],
    files: ["ArduPlane/Attitude.cpp:111", "ArduPlane/Attitude.cpp:166"],
    formulas: [
      { label: "Roll error", body: "roll_error_cd = nav_roll_cd − ahrs.roll_sensor" },
      { label: "Demanded pitch (with FF)", body: "demanded_pitch = nav_pitch_cd\n               + (PTCH_TRIM_DEG × 100)\n               + (throttle_scaled × KFF_THROTTLE_TO_PITCH)" },
      { label: "Pitch error", body: "pitch_error_cd = demanded_pitch − ahrs.pitch_sensor" },
    ],
    accent: "accent",
    placement: "center",
  },
  {
    id: "3A",
    title: "ROLL PID",
    subtitle: "Body-rate inner loop → roll demand",
    summary: "Angle error → desired rate via time constant. Speed scaler trims gain at airspeeds away from SCALING_SPEED. PID runs in radians; output is scaled back to centideg and clamped to ±4500. PIDR log is written here.",
    outputs: [
      { name: "roll_out", unit: "centideg, ±4500" },
      { name: "PIDR.{P,I,D,FF}", unit: "deg/s (logged)" },
    ],
    files: ["ArduPlane/Attitude.cpp:123", "libraries/APM_Control/AP_RollController.cpp"],
    formulas: [
      { label: "Speed scaler", body: "scaler = SCALING_SPEED / actual_airspeed\nclamped to [0.5, 2.0]" },
      { label: "Desired rate (deg/s)", body: "desired_rate = (roll_error_cd / 100) / RLL2SRV_TCONST" },
      { label: "PID input (rad domain)", body: "target = radians(desired_rate) × scaler²\nactual = rate_x × scaler" },
      { label: "PID terms", body: "P  = RLL_RATE_P  × err\nI  = RLL_RATE_I  × ∫err\nD  = RLL_RATE_D  × derr\nFF = RLL_RATE_FF × target" },
      { label: "Output (centideg)", body: "out_deg_s = (P + I + D + FF) × 57.2958\nroll_out  = clamp(out_deg_s × 100, ±4500)" },
      { label: "Saturation threshold", body: "|out_deg_s| ≥ 45 deg/s → AETR hits ±4500" },
    ],
    accent: "warn",
    placement: "left",
  },
  {
    id: "3B",
    title: "PITCH PID",
    subtitle: "Body-rate inner loop → pitch demand",
    summary: "Mirror of the roll loop. Same TCONST → rate → PID structure, but using pitch error, body rate_y, and PTCH2SRV_* gains. PIDP log is written here.",
    outputs: [
      { name: "pitch_out", unit: "centideg, ±4500" },
      { name: "PIDP.{P,I,D,FF}", unit: "deg/s (logged)" },
    ],
    files: ["ArduPlane/Attitude.cpp:176", "libraries/APM_Control/AP_PitchController.cpp"],
    formulas: [
      { label: "Speed scaler", body: "scaler = SCALING_SPEED / actual_airspeed\nclamped to [0.5, 2.0]" },
      { label: "Desired rate (deg/s)", body: "desired_rate = (pitch_error_cd / 100) / PTCH2SRV_TCONST" },
      { label: "PID input (rad domain)", body: "target = radians(desired_rate) × scaler²\nactual = rate_y × scaler" },
      { label: "PID terms", body: "P  = PTCH_RATE_P  × err\nI  = PTCH_RATE_I  × ∫err\nD  = PTCH_RATE_D  × derr\nFF = PTCH_RATE_FF × target" },
      { label: "Output (centideg)", body: "out_deg_s = (P + I + D + FF) × 57.2958\npitch_out = clamp(out_deg_s × 100, ±4500)" },
    ],
    accent: "cool",
    placement: "right",
  },
  {
    id: "4",
    title: "AETR LOGGED",
    subtitle: "Pre-mix demand — pure roll & pitch, no surface identity",
    summary: "Both demands land in the AETR log. This is the pre-mix point: nothing here knows about ailerons, elevators, or elevons yet. AETR / 100 should equal the PIDR / PIDP sum to two sig figs.",
    outputs: [
      { name: "AETR.Ail",  unit: "centideg, ±4500" },
      { name: "AETR.Elev", unit: "centideg, ±4500" },
    ],
    files: ["ArduPlane/Log.cpp:252", "ArduPlane/Log.cpp:253"],
    formulas: [
      { label: "Direct map", body: "AETR.Ail  = get_output_scaled(k_aileron)   ← roll_out\nAETR.Elev = get_output_scaled(k_elevator)  ← pitch_out" },
      { label: "Verification identity", body: "AETR.Elev = (PIDP.FF + PIDP.P + PIDP.I + PIDP.D) × 100" },
    ],
    accent: "mag",
    placement: "center",
    keystone: true,
  },
  {
    id: "5",
    title: "ELEVON MIXING",
    subtitle: "Diff & sum → right/left surface demand",
    summary: "First place a physical surface appears. With mixing_gain = 1.0 the math is a clean ± of pitch and roll. Only one elevon channel can saturate positive at a time: the same Ail that pushes one up pulls the other down.",
    outputs: [
      { name: "servo5_scaled",  unit: "→ right elevon" },
      { name: "servo7_scaled",  unit: "→ left elevon" },
    ],
    files: ["ArduPlane/servos.cpp:183", "ArduPlane/servos.cpp:184"],
    formulas: [
      { label: "Mix (gain = 1.0)", body: "servo5_scaled = (AETR.Elev − AETR.Ail) × mixing_gain   → right elevon\nservo7_scaled = (AETR.Elev + AETR.Ail) × mixing_gain   → left elevon (reversed downstream)\nclamp both to ±4500" },
      { label: "Why only one saturates", body: "For both ≥ +4500:\n  (Elev − Ail) ≥ 4500  AND  (Elev + Ail) ≥ 4500\n  add: 2·Elev ≥ 9000 → Elev ≥ 4500\nBut Elev is clamped to ±4500, so only Ail = 0 works.\nAny Ail ≠ 0 breaks the both-saturate condition." },
    ],
    accent: "mag",
    placement: "center",
  },
  {
    id: "6A",
    title: "SERVO5 SCALED",
    subtitle: "→ right elevon channel",
    summary: "Diff of pitch and roll demand, clamped to the ±4500 servo-frame range. On this airframe SERVO5 drives the right elevon.",
    outputs: [{ name: "servo5_scaled", unit: "centideg, ±4500" }],
    files: ["ArduPlane/servos.cpp:183"],
    formulas: [
      { label: "Channel demand", body: "servo5_scaled = clamp(AETR.Elev − AETR.Ail, ±4500)" },
    ],
    accent: "warn",
    placement: "left",
  },
  {
    id: "6B",
    title: "SERVO7 SCALED",
    subtitle: "→ left elevon channel",
    summary: "Sum of pitch and roll demand, clamped to the ±4500 servo-frame range. On this airframe SERVO7 drives the left elevon.",
    outputs: [{ name: "servo7_scaled", unit: "centideg, ±4500" }],
    files: ["ArduPlane/servos.cpp:184"],
    formulas: [
      { label: "Channel demand", body: "servo7_scaled = clamp(AETR.Elev + AETR.Ail, ±4500)" },
    ],
    accent: "cool",
    placement: "right",
  },
  {
    id: "7A",
    title: "SERVO5_REVERSED = 0",
    subtitle: "Pass-through · right elevon",
    summary: "SERVO5_REVERSED is off — the scaled value passes through unchanged before going to PWM conversion.",
    outputs: [{ name: "final_scaled (S5)", unit: "centideg" }],
    files: ["libraries/SRV_Channel/SRV_Channel.cpp:193"],
    formulas: [
      { label: "Apply reverse flag", body: "final_scaled = servo5_scaled  // unchanged" },
    ],
    accent: "warn",
    placement: "left",
  },
  {
    id: "7B",
    title: "SERVO7_REVERSED = 1",
    subtitle: "Sign flip BEFORE pwm_from_angle · left elevon",
    summary: "SERVO7_REVERSED is on — the value is negated before PWM conversion. This is the only stage where the two elevon channels become asymmetric; everything upstream is symmetric in math.",
    outputs: [{ name: "final_scaled (S7)", unit: "centideg" }],
    files: ["libraries/SRV_Channel/SRV_Channel.cpp:193"],
    formulas: [
      { label: "Apply reverse flag", body: "final_scaled = servo7_scaled × (−1)" },
    ],
    accent: "cool",
    placement: "right",
  },
  {
    id: "8A",
    title: "pwm_from_angle",
    subtitle: "Piecewise linear · SERVO5 → right elevon",
    summary: "Map signed centideg to a microsecond PWM, using TRIM as the zero and MIN / MAX as the endpoints. Positive and negative halves can have asymmetric travel.",
    outputs: [{ name: "PWM (S5)", unit: "µs" }],
    files: ["libraries/SRV_Channel/SRV_Channel.cpp:188"],
    formulas: [
      { label: "Positive half", body: "PWM = TRIM + (final_scaled / 4500) × (MAX − TRIM)" },
      { label: "Negative half", body: "PWM = TRIM − (|final_scaled| / 4500) × (TRIM − MIN)" },
      { label: "Reference points (1000/1500/2000)", body: "+4500 → 2000 µs\n+2250 → 1750 µs\n    0 → 1500 µs\n−2250 → 1250 µs\n−4500 → 1000 µs" },
    ],
    accent: "warn",
    placement: "left",
  },
  {
    id: "8B",
    title: "pwm_from_angle",
    subtitle: "Piecewise linear · SERVO7 → left elevon",
    summary: "Same mapping as the other channel — symmetric in math, asymmetric in outcome because of the upstream reverse flag.",
    outputs: [{ name: "PWM (S7)", unit: "µs" }],
    files: ["libraries/SRV_Channel/SRV_Channel.cpp:188"],
    formulas: [
      { label: "Positive half", body: "PWM = TRIM + (final_scaled / 4500) × (MAX − TRIM)" },
      { label: "Negative half", body: "PWM = TRIM − (|final_scaled| / 4500) × (TRIM − MIN)" },
    ],
    accent: "cool",
    placement: "right",
  },
  {
    id: "9A",
    title: "RCOU.C5",
    subtitle: "Hardware out · right elevon",
    summary: "PWM is pushed to the FMU output and logged as RCOU.C5. On this airframe RCOU.C5 drives the right elevon. This is the last byte the autopilot owns before the ESC / servo PCB sees it.",
    outputs: [{ name: "RCOU.C5", unit: "µs, logged" }],
    files: ["libraries/SRV_Channel/SRV_Channel_aux.cpp:99"],
    formulas: [
      { label: "Push to hardware", body: "hal.rcout->write(4, PWM)\nhal.rcout->push()" },
    ],
    accent: "warn",
    placement: "left",
    terminal: true,
  },
  {
    id: "9B",
    title: "RCOU.C7",
    subtitle: "Hardware out · left elevon",
    summary: "PWM is pushed to the FMU output and logged as RCOU.C7. On this airframe RCOU.C7 drives the left elevon (with the reverse flag already applied upstream). End of the autopilot’s control surface chain.",
    outputs: [{ name: "RCOU.C7", unit: "µs, logged" }],
    files: ["libraries/SRV_Channel/SRV_Channel_aux.cpp:99"],
    formulas: [
      { label: "Push to hardware", body: "hal.rcout->write(6, PWM)\nhal.rcout->push()" },
    ],
    accent: "cool",
    placement: "right",
    terminal: true,
  },
];

// Adjacency for the SVG connectors.
// Each entry is [from_stage_id, to_stage_id].
const STAGE_FLOW = [
  ["1", "2"],
  ["2", "3A"],
  ["2", "3B"],
  ["3A", "4"],
  ["3B", "4"],
  ["4", "5"],
  ["5", "6A"],
  ["5", "6B"],
  ["6A", "7A"],
  ["6B", "7B"],
  ["7A", "8A"],
  ["7B", "8B"],
  ["8A", "9A"],
  ["8B", "9B"],
];

function StageCard({ stage, expanded, onToggle, showFormulas, traceValue, isActive, density }) {
  const { id, title, subtitle, summary, outputs, files, formulas, accent, keystone, terminal } = stage;
  const accentVar = `var(--${accent === "accent" ? "accent" : accent})`;

  return (
    <div
      id={`stage-${id}`}
      className={[
        "stage-card",
        expanded ? "is-expanded" : "",
        isActive ? "is-active" : "",
        keystone ? "is-keystone" : "",
        terminal ? "is-terminal" : "",
        `density-${density}`,
      ].join(" ")}
      style={{ "--card-accent": accentVar }}
      onClick={onToggle}
    >
      <div className="stage-card__rail" />
      <div className="stage-card__head">
        <div className="stage-card__id">
          <span className="stage-card__id-prefix">STAGE</span>
          <span className="stage-card__id-num">{id}</span>
        </div>
        <div className="stage-card__title-group">
          <h3 className="stage-card__title">{title}</h3>
          <p className="stage-card__subtitle">{subtitle}</p>
        </div>
        <div className="stage-card__chev" aria-hidden>
          {expanded ? "−" : "+"}
        </div>
      </div>

      <p className="stage-card__summary">{summary}</p>

      <div className="stage-card__outputs">
        {outputs.map((o) => (
          <div className="output-pill" key={o.name}>
            <span className="output-pill__dot" />
            <span className="output-pill__name">{o.name}</span>
            <span className="output-pill__unit">{o.unit}</span>
            {traceValue && traceValue[o.name] !== undefined && (
              <span className="output-pill__value">{traceValue[o.name]}</span>
            )}
          </div>
        ))}
      </div>

      {(expanded || showFormulas) && (
        <div className="stage-card__formulas">
          {formulas.map((f, i) => (
            <div className="formula" key={i}>
              <div className="formula__label">{f.label}</div>
              <pre className="formula__body">{f.body}</pre>
            </div>
          ))}
        </div>
      )}

      <div className="stage-card__foot">
        {files.map((f) => (
          <span className="file-ref" key={f}>{f}</span>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { STAGES, STAGE_FLOW, StageCard });
