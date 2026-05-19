# Arduplane Elevon Control Flow

Interactive, single-page visualization of the **ArduPlane attitude pipeline** —
every step from `nav_roll_cd` in the navigation controller down to
`RCOU.C5 / RCOU.C7` on the FMU pins.

## 🔗 Live page

Once GitHub Pages is enabled (see below), the diagram will be live at:

```
https://<your-github-username>.github.io/Arduplane-Elevon-control-flow/
```

## What's inside

- **9-stage pipeline diagram** — click any stage to expand its formulas and
  source-file references.
- **Two case studies** — worked numerical examples from `AETR` to `RCOU`,
  including a saturation case.
- **Live calculator** — type `AETR.Ail`, `AETR.Elev`, and `mixing_gain`
  to see the resulting `RCOU.C5 / RCOU.C7` PWM and a small airframe diagram
  with live elevon deflection.

## Airframe assumptions

- Flying wing · twin elevon
- **SERVO5** → right elevon (non-reversed)
- **SERVO7** → left elevon (`SERVO7_REVERSED = 1`)
- Servo MIN / TRIM / MAX = 1000 / 1500 / 2000 µs

## Repository layout

```
.
├── index.html        # the published page (self-contained, works offline)
├── .nojekyll         # ensure GitHub Pages serves files as-is
├── src/              # unbundled source (jsx + css + html)
└── README.md
```

`index.html` is a single self-contained bundle — open it locally with a
browser and it just works, no build step. The unbundled source files live
under `src/` for reading and editing.

## Enabling GitHub Pages (one-time setup)

1. Push this folder to your repo (`main` branch).
2. On GitHub: **Settings → Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** / Folder: **/ (root)**
5. Save. The site URL appears within a minute.

## Local edits

Edit the files under `src/`, open `src/index.html` in a browser to preview,
then re-bundle into a new standalone `index.html` (any "inline all assets"
tool works, e.g. `html-inline`, or rebuild using the source you originated
from).

---

Built as a debugging reference for engineers working with ArduPlane logs.
