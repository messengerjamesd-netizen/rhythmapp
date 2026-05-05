// ui.js — all DOM rendering; zero audio/timing logic here

import { RHYTHMS } from "./rhythmEngine.js";
import { gradeLabel } from "./analysisEngine.js";

// ── Rhythm selector ──────────────────────────────────────────────────────────

export function buildRhythmSelector(container, onChange) {
  container.innerHTML = "";
  Object.keys(RHYTHMS).forEach((name) => {
    const btn = document.createElement("button");
    btn.className = "rhythm-btn";
    btn.textContent = name;
    btn.dataset.name = name;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".rhythm-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onChange(name, RHYTHMS[name]);
    });
    container.appendChild(btn);
  });
  // Select first by default
  container.querySelector(".rhythm-btn").click();
}

// ── Rhythm visualization ─────────────────────────────────────────────────────

/**
 * Draw rhythm blocks. Each event is a proportional-width box.
 * Notes are filled; rests are empty/hatched.
 */
export function renderRhythm(container, pattern, bpm) {
  container.innerHTML = "";
  const msPerBeat = (60 / bpm) * 1000;
  const totalMs = pattern.reduce((s, e) => s + e.duration * msPerBeat, 0);

  pattern.forEach((event, i) => {
    const widthPct = (event.duration * msPerBeat / totalMs) * 100;
    const block = document.createElement("div");
    block.className = `rhythm-block ${event.type}`;
    block.style.width = `${widthPct}%`;
    block.dataset.index = i;

    // Label: note duration as fraction
    const label = document.createElement("span");
    label.className = "block-label";
    label.textContent = durationLabel(event.duration);
    block.appendChild(label);

    container.appendChild(block);
  });
}

function durationLabel(beats) {
  if (beats === 2)   return "𝅗𝅥";   // half
  if (beats === 1)   return "♩";   // quarter
  if (beats === 1.5) return "♩.";  // dotted quarter
  if (beats === 0.5) return "♪";   // eighth
  if (beats === 0.25) return "𝅘𝅥𝅯"; // sixteenth
  return beats;
}

// ── Metronome beat flash ──────────────────────────────────────────────────────

export function flashBeat(indicatorEl, beatIndex, pattern) {
  // Find which rhythm block this quarter-beat falls on and light it up
  const blocks = document.querySelectorAll(".rhythm-block");
  blocks.forEach((b) => b.classList.remove("active-beat"));

  indicatorEl.classList.remove("flash");
  // Trigger reflow to restart CSS animation
  void indicatorEl.offsetWidth;
  indicatorEl.classList.add("flash");
}

// ── Clap indicator ────────────────────────────────────────────────────────────

export function flashClap(el) {
  el.classList.remove("clap-flash");
  void el.offsetWidth;
  el.classList.add("clap-flash");
}

// ── Status text ───────────────────────────────────────────────────────────────

export function setStatus(el, text, type = "") {
  el.textContent = text;
  el.className = "status-text";
  if (type) el.classList.add(type);
}

// ── Countdown ────────────────────────────────────────────────────────────────

export function showCountdown(el, number) {
  el.textContent = number > 0 ? number : "GO!";
  el.classList.add("countdown-pop");
  el.addEventListener("animationend", () => el.classList.remove("countdown-pop"), { once: true });
}

export function clearCountdown(el) {
  el.textContent = "";
}

// ── Results rendering ─────────────────────────────────────────────────────────

export function renderResults(container, analysis, totalDurationMs) {
  const { results, accuracy, extraClaps, toleranceMs } = analysis;
  container.innerHTML = "";

  // Score header
  const scoreEl = document.createElement("div");
  scoreEl.className = "score-header";
  scoreEl.innerHTML = `
    <span class="score-number">${accuracy}%</span>
    <span class="score-grade">${gradeLabel(accuracy)}</span>
  `;
  container.appendChild(scoreEl);

  // Per-note breakdown
  const breakdown = document.createElement("div");
  breakdown.className = "breakdown";
  results.forEach((r, i) => {
    const item = document.createElement("div");
    item.className = `breakdown-item ${r.classification}`;
    const icon = { correct: "✓", early: "↑", late: "↓", missed: "✗" }[r.classification];
    const errorText = r.error !== null
      ? `${r.error > 0 ? "+" : ""}${Math.round(r.error)}ms`
      : "—";
    item.innerHTML = `
      <span class="beat-icon">${icon}</span>
      <span class="beat-label">Note ${i + 1}</span>
      <span class="beat-error">${errorText}</span>
      <span class="beat-class">${r.classification}</span>
    `;
    breakdown.appendChild(item);
  });
  container.appendChild(breakdown);

  // Timeline visualization
  const timelineWrap = document.createElement("div");
  timelineWrap.className = "timeline-wrap";
  timelineWrap.innerHTML = "<div class='timeline-label'>Timeline (expected ▲ vs actual ●)</div>";

  const canvas = document.createElement("canvas");
  canvas.className = "timeline-canvas";
  canvas.width = 600;
  canvas.height = 80;
  timelineWrap.appendChild(canvas);
  container.appendChild(timelineWrap);

  // Draw after DOM insertion (requestAnimationFrame ensures canvas is sized)
  requestAnimationFrame(() =>
    drawTimeline(canvas, results, extraClaps, totalDurationMs, toleranceMs)
  );

  // Extra claps note
  if (extraClaps.length > 0) {
    const extra = document.createElement("p");
    extra.className = "extra-claps-note";
    extra.textContent = `${extraClaps.length} extra clap(s) detected that didn't match an expected beat.`;
    container.appendChild(extra);
  }
}

function drawTimeline(canvas, results, extraClaps, totalMs, toleranceMs) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const toX = (ms) => (ms / totalMs) * (W - 20) + 10;

  ctx.clearRect(0, 0, W, H);

  // Baseline
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, H / 2);
  ctx.lineTo(W - 10, H / 2);
  ctx.stroke();

  // Tolerance bands
  results.forEach((r) => {
    const x = toX(r.expected);
    const tolW = (toleranceMs / totalMs) * (W - 20);
    ctx.fillStyle = "rgba(100,200,100,0.15)";
    ctx.fillRect(x - tolW, H / 2 - 14, tolW * 2, 28);
  });

  // Expected beats (triangles)
  results.forEach((r) => {
    const x = toX(r.expected);
    ctx.fillStyle = "#7eb8f7";
    ctx.beginPath();
    ctx.moveTo(x, H / 2 - 20);
    ctx.lineTo(x - 7, H / 2 - 6);
    ctx.lineTo(x + 7, H / 2 - 6);
    ctx.closePath();
    ctx.fill();
  });

  // Actual claps (circles), color-coded
  const colorMap = { correct: "#4caf50", early: "#ff9800", late: "#e53935", missed: "#888" };
  results.forEach((r) => {
    if (r.actual === null) return;
    const x = toX(r.actual);
    ctx.fillStyle = colorMap[r.classification] || "#aaa";
    ctx.beginPath();
    ctx.arc(x, H / 2 + 14, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  // Extra claps (grey circles below)
  extraClaps.forEach((t) => {
    const relT = t - (results[0]?.expected ?? 0);
    const x = toX(Math.max(0, Math.min(totalMs, relT + (results[0]?.expected ?? 0))));
    ctx.fillStyle = "#666";
    ctx.beginPath();
    ctx.arc(x, H / 2 + 14, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}
