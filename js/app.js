// app.js — state machine and module wiring

import { rhythmToTimestamps, totalBeats } from "./rhythmEngine.js";
import { TimingEngine }   from "./timingEngine.js";
import { AudioInput }     from "./audioInput.js";
import { PlaybackEngine } from "./playback.js";
import { analyzePerformance } from "./analysisEngine.js";
import {
  buildRhythmSelector,
  updateStaff,
  renderBlocks,
  flashBeat,
  flashClap,
  setStatus,
  showCountdown,
  clearCountdown,
  renderResults,
} from "./ui.js";

// ── State ─────────────────────────────────────────────────────────────────────

const STATE = {
  IDLE:           "idle",
  REQUESTING_MIC: "requesting_mic",
  COUNTDOWN:      "countdown",
  RECORDING:      "recording",
  RESULTS:        "results",
  PLAYBACK:       "playback",
};

let state = STATE.IDLE;
let audioCtx       = null;
let timingEngine   = null;
let audioInput     = null;
let playbackEngine = null;

let currentRhythm       = null;  // full rhythm object from library {name, timeSig, pattern}
let clapTimestamps      = [];    // relative ms from sequence start
let sequenceStartMs     = null;  // performance.now() at recording start
let lastAnalysis        = null;
let lastTotalDurationMs = 0;

// ── DOM refs ──────────────────────────────────────────────────────────────────

const bpmInput        = document.getElementById("bpm-input");
const startBtn        = document.getElementById("start-btn");
const playbackBtn     = document.getElementById("playback-btn");
const rhythmSel       = document.getElementById("rhythm-selector");
const staffCanvas     = document.getElementById("staff-canvas");
const blockViz        = document.getElementById("rhythm-blocks");
const beatIndicator   = document.getElementById("beat-indicator");
const clapIndicator   = document.getElementById("clap-indicator");
const beatLabel       = document.getElementById("beat-label");
const clapLabel       = document.getElementById("clap-label");
const countdownEl     = document.getElementById("countdown");
const statusEl        = document.getElementById("status-text");
const resultsSection  = document.getElementById("results-section");
const resultsEl       = document.getElementById("results");
const thresholdSlider = document.getElementById("threshold-slider");
const thresholdVal    = document.getElementById("threshold-val");

// ── Init ──────────────────────────────────────────────────────────────────────

buildRhythmSelector(rhythmSel, staffCanvas, (rhythm) => {
  currentRhythm = rhythm;
  updateStaff(rhythm.pattern, rhythm.timeSig);
  renderBlocks(blockViz, rhythm.pattern, getBpm());
  resultsEl.innerHTML    = "";
  resultsSection.style.display = "none";
  playbackBtn.style.display    = "none";
});

bpmInput.addEventListener("input", () => {
  if (currentRhythm) renderBlocks(blockViz, currentRhythm.pattern, getBpm());
});

thresholdSlider.addEventListener("input", () => {
  const v = parseFloat(thresholdSlider.value);
  thresholdVal.textContent = v.toFixed(2);
  if (audioInput) audioInput.THRESHOLD = v;
});

startBtn.addEventListener("click",    onStartClick);
playbackBtn.addEventListener("click", onPlaybackClick);

// Re-render staff on window resize (canvas must match container width)
window.addEventListener("resize", () => {
  if (currentRhythm) updateStaff(currentRhythm.pattern, currentRhythm.timeSig);
});

function getBpm() {
  return Math.max(20, Math.min(300, parseInt(bpmInput.value, 10) || 80));
}

// ── AudioContext (created on first user gesture) ──────────────────────────────

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx       = new (window.AudioContext || window.webkitAudioContext)();
    timingEngine   = new TimingEngine(audioCtx);
    playbackEngine = new PlaybackEngine(audioCtx);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

// ── Main flow ─────────────────────────────────────────────────────────────────

async function onStartClick() {
  if (state === STATE.RECORDING) {
    finishRecording();
    return;
  }
  if (state === STATE.PLAYBACK) stopPlayback();

  ensureAudioCtx();
  setState(STATE.REQUESTING_MIC);

  if (!audioInput) audioInput = new AudioInput(audioCtx);

  try {
    await audioInput.requestMic();
  } catch {
    setStatus(statusEl, "Microphone access denied — please allow mic access and try again.", "error");
    setState(STATE.IDLE);
    return;
  }

  startCountdown();
}

function startCountdown() {
  setState(STATE.COUNTDOWN);
  const bpm    = getBpm();
  const beatMs = (60 / bpm) * 1000;
  let count = currentRhythm.timeSig.beats; // count in for one full bar

  // Schedule count-in clicks
  ensureAudioCtx();
  const countStart = audioCtx.currentTime + 0.05;
  for (let i = 0; i < currentRhythm.timeSig.beats; i++) {
    scheduleCountClick(countStart + i * (beatMs / 1000), i === 0);
  }

  showCountdown(countdownEl, count);
  count--;

  const interval = setInterval(() => {
    if (count > 0) {
      showCountdown(countdownEl, count);
      count--;
    } else {
      showCountdown(countdownEl, 0); // "GO!"
      clearInterval(interval);
      setTimeout(() => {
        clearCountdown(countdownEl);
        startRecording();
      }, Math.min(beatMs, 600));
    }
  }, beatMs);
}

function scheduleCountClick(audioTime, accent = false) {
  const ctx  = audioCtx;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = accent ? 1100 : 880;
  gain.gain.setValueAtTime(accent ? 0.4 : 0.25, audioTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.06);
  osc.start(audioTime);
  osc.stop(audioTime + 0.07);
}

function startRecording() {
  const bpm = getBpm();
  const { beats, totalDuration } = rhythmToTimestamps(currentRhythm.pattern, bpm);
  const quarterBeats = totalBeats(currentRhythm.pattern);

  clapTimestamps      = [];
  sequenceStartMs     = performance.now();
  lastTotalDurationMs = totalDuration;

  setState(STATE.RECORDING);

  audioInput.start((absoluteMs) => {
    // Convert absolute timestamp to relative ms from sequence start
    clapTimestamps.push(absoluteMs - sequenceStartMs);
    flashClap(clapIndicator);
  });

  const audioStartTime = audioCtx.currentTime + 0.01;
  timingEngine.start(
    bpm,
    quarterBeats,
    () => flashBeat(beatIndicator),
    audioStartTime,
    currentRhythm.timeSig.beats
  );

  // Auto-stop after rhythm completes + small buffer
  setTimeout(() => {
    if (state === STATE.RECORDING) finishRecording();
  }, totalDuration + 600);
}

function finishRecording() {
  audioInput.stop();
  timingEngine.stop();

  const { beats } = rhythmToTimestamps(currentRhythm.pattern, getBpm());
  lastAnalysis = analyzePerformance(beats, clapTimestamps);

  setState(STATE.RESULTS);
  renderResults(resultsEl, lastAnalysis, lastTotalDurationMs);
  playbackBtn.style.display = "";
}

// ── Playback ──────────────────────────────────────────────────────────────────

function onPlaybackClick() {
  ensureAudioCtx();
  if (state === STATE.PLAYBACK) { stopPlayback(); return; }

  setState(STATE.PLAYBACK);
  playbackBtn.textContent = "⏹ Stop Playback";

  playbackEngine.play(currentRhythm.pattern, getBpm(), () => {
    if (state === STATE.PLAYBACK) setState(STATE.RESULTS);
  });
}

function stopPlayback() {
  playbackEngine.stop();
  setState(STATE.RESULTS);
}

// ── State management ──────────────────────────────────────────────────────────

function setState(newState) {
  state = newState;

  const messages = {
    [STATE.IDLE]:           ["Select a rhythm and press Start.", ""],
    [STATE.REQUESTING_MIC]: ["Requesting microphone access…", "info"],
    [STATE.COUNTDOWN]:      ["Get ready…", "info"],
    [STATE.RECORDING]:      ["Clap along! Press Stop when done.", "recording"],
    [STATE.RESULTS]:        ["Done! See your results below.", "success"],
    [STATE.PLAYBACK]:       ["Playing back the correct rhythm…", "info"],
  };

  const [msg, type] = messages[newState] || ["", ""];
  setStatus(statusEl, msg, type);

  startBtn.textContent = newState === STATE.RECORDING ? "⏹ Stop" : "▶ Start";
  startBtn.disabled    = newState === STATE.COUNTDOWN || newState === STATE.REQUESTING_MIC;

  if (newState === STATE.RESULTS) playbackBtn.textContent = "▶ Play Correct Rhythm";
  if (newState !== STATE.RESULTS && newState !== STATE.PLAYBACK) {
    playbackBtn.style.display = "none";
  }

  const isRecording = newState === STATE.RECORDING;
  beatIndicator.classList.toggle("hidden", !isRecording);
  clapIndicator.classList.toggle("hidden", !isRecording);
  beatLabel.classList.toggle("hidden",     !isRecording);
  clapLabel.classList.toggle("hidden",     !isRecording);

  resultsSection.style.display =
    (newState === STATE.RESULTS || newState === STATE.PLAYBACK) ? "" : "none";
}
