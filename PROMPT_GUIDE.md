# How to Prompt Your Way to This App

A reference for rebuilding the Rhythm Trainer from scratch with fewer
back-and-forth iterations.

---

## The Single Opening Prompt

Paste this as your very first message. The more context you give upfront,
the fewer clarifying rounds you need.

```
Build a rhythm training web app with these exact specs:

STACK
- Pure frontend: HTML + vanilla JS ES modules + Canvas 2D + Web Audio API
- No build step, no framework, no npm dependencies in the browser
- Deploy target: Netlify (static site + Netlify Functions v2 for any API)

FILE STRUCTURE
js/app.js            — main state machine, wires everything together
js/ui.js             — all DOM rendering, no audio/timing logic
js/staffRenderer.js  — Canvas 2D music notation renderer
js/rhythmLibrary.js  — rhythm pattern data
js/rhythmEngine.js   — pattern → millisecond timestamp conversion
js/audioInput.js     — microphone clap detection
js/timingEngine.js   — metronome / beat scheduling via Web Audio
js/playback.js       — plays back the correct rhythm so user can hear it
js/analysisEngine.js — scores user performance (timing accuracy)
netlify/functions/leaderboard.mjs  — GET /api/leaderboard?date=YYYY-MM-DD
netlify/functions/submit.mjs       — POST /api/submit
fonts/bravura.woff2  — self-hosted Bravura SMuFL music font (include it)
index.html, style.css, manifest.json, netlify.toml

FEATURES
1. Rhythm library — three difficulty tabs (Beginner / Intermediate / Advanced)
   with a Random button. Patterns include whole, half, quarter, dotted quarter,
   eighth, dotted eighth, sixteenth notes, and rests. One pattern called
   "3+3+2 Feel" uses dotted-quarter + dotted-quarter + quarter (NOT 8 eighths).

2. Staff notation — Canvas 2D, percussion clef, time signature, filled/open
   note heads, stems, flags, beams (primary + secondary for sixteenths),
   dotted notes, and proper rest symbols using the self-hosted Bravura font
   (SMuFL codepoints: quarter , eighth , sixteenth ).
   Load Bravura via FontFace API from /fonts/bravura.woff2; re-render staff
   after font resolves. Font-size for glyphs = 4 * line-spacing (LS=11px).

3. Beat-map bar — proportional colored blocks below the staff showing note
   vs rest layout at the selected BPM.

4. Two input modes (toggle button): Microphone and Spacebar.
   - Mic: getUserMedia with echoCancellation/noiseSuppression/autoGainControl
     all false. ScriptProcessorNode (512 samples), highpass BiquadFilter at
     1 kHz Q=0.7, adaptive noise floor (slow 3% blend), attack-rate check,
     timestamps from audio clock (not performance.now() directly).
   - Spacebar: keydown Space event with adaptive debounce.
   - Persist chosen mode in localStorage.

5. Calibration — "Calibrate" button plays a 4-beat metronome; user taps
   along; app measures average latency and stores it per mode
   (localStorage keys: rhythmapp_offset, rhythmapp_space_offset).
   Button label reads "Calibrate Mic" or "Calibrate Spacebar" depending
   on active mode. Show calibrated offset in the UI.

6. Start flow — countdown one full bar, then record exactly one bar.
   Scroll the staff into view when Start is pressed.

7. Analysis — compare clap timestamps to expected beat timestamps (after
   subtracting the per-mode latency offset). Score = % of notes hit within
   ±150 ms. Show per-note icons (✓ correct, ↑ early, ↓ late, ✗ missed)
   with ms error values. Grade labels: A / B / C / D / F.

8. Playback — "Play Correct Rhythm" button plays back the pattern as audio
   clicks so the user can hear what it should sound like.

9. Daily Challenge — one rhythm selected deterministically by date hash from
   the Intermediate + Advanced pool. Shows today's global leaderboard.
   - On submit, POST score to /api/submit. Server auto-generates a
     school-safe display name (adjective + animal + 2-digit number from
     30×30 curated wordlists — no user text input).
   - Leaderboard stored in Netlify Blobs keyed by date (top 20 stored,
     top 10 shown). Netlify Functions v2 syntax: export default async (req)
     and export const config = { path: "/api/..." }.
   - Validate: score 0–100, date YYYY-MM-DD, rhythm name ≤ 60 chars.
   - Show generated name to user after submit.

10. Calibrate reminder — styled callout box (accent left-border) above the
    daily challenge that links to the Calibrate button. Visible in both
    mic and spacebar modes; link text updates with mode.

DESIGN
- Dark theme: bg #0f1117, surface #1a1d27, surface2 #22263a,
  accent #5b8ef0, text #e8eaf0, muted #6b7280
- Responsive, max-width 900px, no external CSS frameworks

NETLIFY CONFIG
netlify.toml — headers only (no [build] section):
  [[headers]]
    for = "/*"
    [headers.values]
      Permissions-Policy = "microphone=(*)"

Git branch for development: [your-branch-name]
After every logical chunk of work: commit and push.
Also maintain a separate Netlify-watched branch and merge into it after
each push so the live site stays current.
```

---

## Key Decisions to State Upfront (Lessons Learned)

These caused the most back-and-forth. Mentioning them in the opening
prompt would have saved many rounds.

| Topic | What to say |
|-------|-------------|
| Leaderboard privacy | "No user-entered names — auto-generate school-safe names server-side" |
| Rest symbols | "Use the self-hosted Bravura font for rests, not hand-drawn bezier curves" |
| Calibration scope | "Calibration applies to both mic AND spacebar, not just mic" |
| 3+3+2 pattern | "Dotted quarter + dotted quarter + quarter, NOT 8 straight eighths" |
| Secondary beams | "Dotted eighth gets only the primary beam; secondary beam only for notes < 0.5 beats" |
| Netlify Functions | "Use Functions v2 (export default + export const config), not v1" |
| Font hosting | "Self-host Bravura — CDN URLs like jsDelivr return 403 for font files" |
| Deployment branch | "Keep a separate Netlify-watched branch; merge feature branch into it after each push" |
| Button labels | "Calibrate button text should update dynamically with input mode" |

---

## How to Structure Follow-Up Prompts

**Be specific about what you see, not what you think the cause is.**

| Instead of… | Say… |
|-------------|------|
| "the notation is wrong" | "the secondary beam extends past the last sixteenth note" |
| "rests look bad" | "the rests don't look like standard music notation symbols" |
| "calibration is broken" | "the spacebar is off by about 200ms after calibrating" |
| "nothing shows up" | "the rhythm selector is blank — no tabs, no buttons" |

**Include the exact error if there is one.** Open DevTools → Console, copy
the full error message and paste it into the chat.

**Say the input mode when reporting audio issues.** Mic and spacebar have
separate code paths. "Clap detection is missing fast notes in Spacebar mode
at 120 BPM" is much easier to fix than "detection is iffy."

---

## Token-Saving Workflow Tips

1. **One topic per message.** Don't bundle three unrelated bugs into one
   message — it forces the model to hold more context at once.

2. **Confirm before branching.** If you're unsure whether a feature is
   heading in the right direction, ask "does this approach make sense?" before
   asking for implementation.

3. **Say "just the file" for small fixes.** For a one-line CSS change, say
   "just fix the CSS, no explanation needed."

4. **Reference file and line.** "In staffRenderer.js around the beam drawing
   section" focuses the model faster than a vague description.

5. **Use CLAUDE.md for standing instructions.** Anything you want remembered
   across sessions (branch names, deployment workflow, design decisions) lives
   in CLAUDE.md so you don't have to re-explain it each time.

---

## What's in CLAUDE.md Right Now

```
# Rhythm Trainer — Dev Notes

## Stack
Pure frontend: HTML + vanilla JS (ES modules) + Canvas 2D + Web Audio API.
No build step.

## Active branch
claude/rhythm-app-features-7jI3S

## Netlify-watched branch
claude/rhythm-training-app-OOn4V
Merge feature branch into this after every push.

## Global Leaderboard
Netlify Functions v2 + Netlify Blobs.
Schema: { date, name (auto-generated), score, rhythm }
Endpoints: GET /api/leaderboard?date=  POST /api/submit
```

Keep CLAUDE.md updated as the project evolves — it's the model's persistent
memory between sessions.
