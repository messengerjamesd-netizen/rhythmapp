// ui.js — all DOM rendering; zero audio/timing logic here

import { RHYTHM_LIBRARY } from "./rhythmLibrary.js";
import { gradeLabel } from "./analysisEngine.js";
import { renderStaff } from "./staffRenderer.js";

// ── Rhythm selector (categories + tabs) ──────────────────────────────────────

let _staffCanvas = null;

export function buildRhythmSelector(container, staffCanvas, onChange) {
  _staffCanvas = staffCanvas;
  container.innerHTML = "";

  const categories = Object.keys(RHYTHM_LIBRARY);

  // Tab bar
  const tabBar = document.createElement("div");
  tabBar.className = "category-tabs";

  // Panel area
  const panelWrap = document.createElement("div");
  panelWrap.className = "category-panels";

  let firstBtn  = null;
  let firstPanel = null;

  categories.forEach((cat) => {
    // Tab button
    const tab = document.createElement("button");
    tab.className = "cat-tab";
    tab.textContent = cat;
    tab.dataset.cat = cat;
    tabBar.appendChild(tab);

    // Panel
    const panel = document.createElement("div");
    panel.className = "cat-panel";
    panel.dataset.cat = cat;
    panel.hidden = true;

    RHYTHM_LIBRARY[cat].forEach((rhythm) => {
      const btn = document.createElement("button");
      btn.className = "rhythm-btn";
      btn.textContent = rhythm.name;
      btn.dataset.name = rhythm.name;
      btn.addEventListener("click", () => {
        // Deselect all rhythm buttons
        container.querySelectorAll(".rhythm-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        onChange(rhythm);
      });
      panel.appendChild(btn);
    });

    panelWrap.appendChild(panel);

    tab.addEventListener("click", () => {
      // Switch active tab
      tabBar.querySelectorAll(".cat-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      panelWrap.querySelectorAll(".cat-panel").forEach((p) => { p.hidden = true; });
      panel.hidden = false;
    });

    if (!firstBtn) { firstBtn = tab; firstPanel = panel; }
  });

  container.appendChild(tabBar);
  container.appendChild(panelWrap);

  // Activate first tab and first rhythm
  firstBtn.classList.add("active");
  firstPanel.hidden = false;
  firstPanel.querySelector(".rhythm-btn").click();
}

// ── Staff notation rendering ──────────────────────────────────────────────────

export function updateStaff(pattern, timeSig) {
  if (!_staffCanvas) return;
  renderStaff(_staffCanvas, pattern, timeSig);
}

// ── Beat block visualization (kept as secondary reference below staff) ────────

export function renderBlocks(container, pattern, bpm) {
  container.innerHTML = "";
  const msPerBeat = (60 / bpm) * 1000;
  const totalMs   = pattern.reduce((s, e) => s + e.duration * msPerBeat, 0);

  pattern.forEach((event) => {
    const widthPct = (event.duration * msPerBeat / totalMs) * 100;
    const block = document.createElement("div");
    block.className = `rhythm-block ${event.type}`;
    block.style.width = `${widthPct}%`;

    const label = document.createElement("span");
    label.className = "block-label";
    label.textContent = durationLabel(event.duration);
    block.appendChild(label);

    container.appendChild(block);
  });
}

function durationLabel(beats) {
  if (beats === 4)    return "𝅝";
  if (beats === 2)    return "𝅗𝅥";
  if (beats === 1)    return "♩";
  if (beats === 1.5)  return "♩.";
  if (beats === 0.75) return "♪.";
  if (beats === 0.5)  return "♪";
  if (beats === 0.25) return "𝅘𝅥𝅯";
  return beats;
}

// ── Metronome beat flash ──────────────────────────────────────────────────────

export function flashBeat(indicatorEl) {
  indicatorEl.classList.remove("flash");
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
  el.className   = "status-text";
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
  const { results, accuracy, extraClaps } = analysis;
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
    const icon      = { correct: "✓", early: "↑", late: "↓", missed: "✗" }[r.classification];
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
  timelineWrap.innerHTML = "<div class='timeline-label'>Timeline — ▲ expected &nbsp; ● actual clap</div>";

  const canvas    = document.createElement("canvas");
  canvas.className = "timeline-canvas";
  timelineWrap.appendChild(canvas);
  container.appendChild(timelineWrap);

  requestAnimationFrame(() =>
    drawTimeline(canvas, results, extraClaps, totalDurationMs)
  );

  if (extraClaps.length > 0) {
    const extra = document.createElement("p");
    extra.className = "extra-claps-note";
    extra.textContent = `${extraClaps.length} extra clap(s) detected that didn't match an expected beat.`;
    container.appendChild(extra);
  }
}

function drawTimeline(canvas, results, extraClaps, totalMs) {
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.parentElement ? canvas.parentElement.clientWidth : 600;
  const H   = 80;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + "px";
  canvas.style.height = H + "px";

  const ctx  = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const usableW = W - 20;
  const toX = (ms) => (ms / totalMs) * usableW + 10;

  ctx.clearRect(0, 0, W, H);

  // Baseline
  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(10, H / 2);
  ctx.lineTo(W - 10, H / 2);
  ctx.stroke();

  // Tolerance bands — each note uses its own per-note tolerance so bands
  // never overlap even for dense sixteenth-note patterns
  results.forEach((r) => {
    const x    = toX(r.expected);
    const tolW = (r.tolerance / totalMs) * usableW;
    ctx.fillStyle = "rgba(100,200,100,0.15)";
    ctx.fillRect(x - tolW, H / 2 - 14, tolW * 2, 28);
  });

  // Expected beats (triangles above line)
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

  // Actual claps (circles below line), color-coded
  const colorMap = { correct: "#4caf50", early: "#ff9800", late: "#e53935", missed: "#888" };
  results.forEach((r) => {
    if (r.actual === null) return;
    const x = toX(r.actual);
    ctx.fillStyle = colorMap[r.classification] || "#aaa";
    ctx.beginPath();
    ctx.arc(x, H / 2 + 14, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  // Extra claps (grey, smaller)
  extraClaps.forEach((t) => {
    const x = toX(Math.max(0, Math.min(totalMs, t)));
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.arc(x, H / 2 + 14, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}
