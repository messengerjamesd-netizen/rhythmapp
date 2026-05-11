// app.js — state machine and module wiring

import { rhythmToTimestamps, totalBeats, RHYTHM_LIBRARY } from "./rhythmEngine.js";
import { TimingEngine }   from "./timingEngine.js";
import { AudioInput }     from "./audioInput.js";
import { PlaybackEngine } from "./playback.js";
import { analyzePerformance } from "./analysisEngine.js";
import {
  buildRhythmSelector,
  selectRhythmByName,
  updateStaff,
  renderBlocks,
  flashBeat,
  flashClap,
  setStatus,
  showCountdown,
  clearCountdown,
  renderResults,
  renderLeaderboard,
  gradeLabel,
} from "./ui.js";

// ── State ─────────────────────────────────────────────────────────────────────

const STATE = {
  IDLE:           "idle",
  REQUESTING_MIC: "requesting_mic",
  COUNTDOWN:      "countdown",
  RECORDING:      "recording",
  RESULTS:        "results",
  PLAYBACK:       "playback",
  CALIBRATING:    "calibrating",
};

let state = STATE.IDLE;
let audioCtx       = null;
let timingEngine   = null;
let audioInput     = null;
let playbackEngine = null;

let currentRhythm       = null;
let clapTimestamps      = [];
let sequenceStartMs     = null;
let lastAnalysis        = null;
let lastTotalDurationMs = 0;

// Challenge mode — set when the user attempts the daily challenge
let isChallengeMode = false;
let dailyChallenge  = null; // set on init

// Per-mode latency offsets — each input type has its own timing characteristics.
// Positive value means input registers late; we subtract it from timestamps.
let micOffsetMs   = parseFloat(localStorage.getItem("rhythmapp_offset")       || "0");
let spaceOffsetMs = parseFloat(localStorage.getItem("rhythmapp_space_offset") || "0");
let isCalibrating = false;

const CALIB_PATTERN = [
  { type: "note", duration: 1 },
  { type: "note", duration: 1 },
  { type: "note", duration: 1 },
  { type: "note", duration: 1 },
];
const CALIB_TIMESIG = { beats: 4, value: 4 };

// ── Input mode ────────────────────────────────────────────────────────────────

let inputMode = localStorage.getItem("rhythmapp_input_mode") || "mic";
let lastSpaceMs = -Infinity;
let currentDebounceMs = 80;

// ── DOM refs ──────────────────────────────────────────────────────────────────

const bpmInput        = document.getElementById("bpm-input");
const startBtn        = document.getElementById("start-btn");
const playbackBtn     = document.getElementById("playback-btn");
const calibrateBtn    = document.getElementById("calibrate-btn");
const offsetDisplay   = document.getElementById("offset-display");
const modeMicBtn      = document.getElementById("mode-mic");
const modeSpaceBtn    = document.getElementById("mode-space");
const micControls     = document.getElementById("mic-controls");
const spacebarHint    = document.getElementById("spacebar-hint");
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

// Challenge DOM
const challengeBtn        = document.getElementById("challenge-btn");
const challengeDateEl     = document.getElementById("challenge-date");
const challengeNameEl     = document.getElementById("challenge-rhythm-name");
const challengeDiffEl     = document.getElementById("challenge-difficulty");
const leaderboardListEl   = document.getElementById("leaderboard-list");
const challengeSubmitWrap = document.getElementById("challenge-submit-wrap");
const lbSubmitBtn         = document.getElementById("lb-submit-btn");
const lbNameReveal        = document.getElementById("lb-name-reveal");

// ── Init ──────────────────────────────────────────────────────────────────────

buildRhythmSelector(rhythmSel, staffCanvas, (rhythm) => {
  currentRhythm = rhythm;
  updateStaff(rhythm.pattern, rhythm.timeSig);
  renderBlocks(blockViz, rhythm.pattern, getBpm());
  resultsEl.innerHTML          = "";
  resultsSection.style.display = "none";
  playbackBtn.style.display    = "none";
  challengeSubmitWrap.style.display = "none";
  isChallengeMode = false;
});

initChallenge(); // async, leaderboard loads in background

bpmInput.addEventListener("input", () => {
  if (currentRhythm) renderBlocks(blockViz, currentRhythm.pattern, getBpm());
});

thresholdSlider.addEventListener("input", () => {
  const v = parseFloat(thresholdSlider.value);
  thresholdVal.textContent = v.toFixed(2);
  if (audioInput) audioInput.THRESHOLD = v;
});

startBtn.addEventListener("click",     onStartClick);
playbackBtn.addEventListener("click",  onPlaybackClick);
calibrateBtn.addEventListener("click", onCalibrateClick);

document.getElementById("challenge-calibrate-btn")?.addEventListener("click", () => {
  calibrateBtn.scrollIntoView({ behavior: "smooth", block: "center" });
  calibrateBtn.click();
});

modeMicBtn.addEventListener("click",   () => setInputMode("mic"));
modeSpaceBtn.addEventListener("click", () => setInputMode("space"));

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  if (state !== STATE.RECORDING && state !== STATE.CALIBRATING) return;
  if (inputMode !== "space") return;
  e.preventDefault();
  const now = performance.now();
  if (now - lastSpaceMs < currentDebounceMs) return;
  lastSpaceMs = now;
  clapTimestamps.push(now - sequenceStartMs);
  flashClap(clapIndicator);
});

updateOffsetDisplay();
applyInputMode();

window.addEventListener("resize", () => {
  if (currentRhythm) updateStaff(currentRhythm.pattern, currentRhythm.timeSig);
});

// ── Daily challenge helpers ───────────────────────────────────────────────────

function getDailyChallengeRhythm() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  const pool = [
    ...(RHYTHM_LIBRARY["Intermediate"] || []),
    ...(RHYTHM_LIBRARY["Advanced"]     || []),
  ];
  return pool[Math.abs(hash) % pool.length];
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function fetchLeaderboard() {
  try {
    const res = await fetch(`/api/leaderboard?date=${todayStr()}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function submitScore(score, rhythm) {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score, rhythm, date: todayStr() }),
  });
  if (!res.ok) throw new Error("Submit failed");
  return await res.json(); // { name, entries }
}

async function initChallenge() {
  dailyChallenge = getDailyChallengeRhythm();

  let diffLabel = "";
  for (const [cat, rhythms] of Object.entries(RHYTHM_LIBRARY)) {
    if (rhythms.some((r) => r.name === dailyChallenge.name)) { diffLabel = cat; break; }
  }

  const today = new Date();
  challengeDateEl.textContent = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  challengeNameEl.textContent = dailyChallenge.name;
  challengeDiffEl.textContent = diffLabel;

  renderLeaderboard(leaderboardListEl, await fetchLeaderboard());
}

// ── Challenge attempt ─────────────────────────────────────────────────────────

challengeBtn.addEventListener("click", async () => {
  if (state !== STATE.IDLE && state !== STATE.RESULTS) return;

  // Select the challenge rhythm in the picker and update notation
  selectRhythmByName(rhythmSel, dailyChallenge.name);
  currentRhythm = dailyChallenge;
  updateStaff(currentRhythm.pattern, currentRhythm.timeSig);
  renderBlocks(blockViz, currentRhythm.pattern, getBpm());

  // Reset submit UI for new attempt
  challengeSubmitWrap.style.display = "none";
  lbNameReveal.style.display = "none";
  lbSubmitBtn.disabled = false;
  lbSubmitBtn.textContent = "Submit Score";
  isChallengeMode = true;

  await onStartClick();
});

lbSubmitBtn.addEventListener("click", async () => {
  lbSubmitBtn.disabled = true;
  lbSubmitBtn.textContent = "Submitting…";
  try {
    const { name, entries } = await submitScore(lastAnalysis.accuracy, currentRhythm.name);
    renderLeaderboard(leaderboardListEl, entries);
    challengeSubmitWrap.style.display = "none";
    lbNameReveal.textContent = `You're on the board as ${name}!`;
    lbNameReveal.style.display = "";
    document.getElementById("challenge-section").scrollIntoView({ behavior: "smooth" });
  } catch {
    lbSubmitBtn.textContent = "Submit Score";
    lbSubmitBtn.disabled = false;
    lbNameReveal.textContent = "Couldn't reach the leaderboard — check your connection.";
    lbNameReveal.style.display = "";
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

function getBpm() {
  return Math.max(20, Math.min(300, parseInt(bpmInput.value, 10) || 80));
}

function adaptiveDebounceMs(pattern, bpm) {
  const msPerBeat = (60 / bpm) * 1000;
  const minDuration = pattern
    .filter((e) => e.type === "note")
    .reduce((min, e) => Math.min(min, e.duration), Infinity);
  const minGapMs = minDuration * msPerBeat;
  return Math.max(50, minGapMs * 0.4);
}

// ── Input mode ────────────────────────────────────────────────────────────────

function setInputMode(mode) {
  inputMode = mode;
  localStorage.setItem("rhythmapp_input_mode", mode);
  applyInputMode();
}

function applyInputMode() {
  const isMic = inputMode === "mic";
  modeMicBtn.classList.toggle("active",   isMic);
  modeSpaceBtn.classList.toggle("active", !isMic);
  micControls.style.display = isMic ? "" : "none";
  calibrateBtn.textContent = isMic ? "🎯 Calibrate Mic" : "🎯 Calibrate Spacebar";
  const tipLink = document.getElementById("challenge-calibrate-btn");
  if (tipLink) tipLink.textContent = isMic ? "calibrate your mic" : "calibrate your spacebar timing";
  updateOffsetDisplay();
}

// ── AudioContext ────────────────────────────────────────────────────────────────

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

  if (!currentRhythm) {
    setStatus(statusEl, "Please select a rhythm first.", "error");
    return;
  }

  ensureAudioCtx();

  if (inputMode === "mic") {
    setState(STATE.REQUESTING_MIC);
    if (!audioInput) audioInput = new AudioInput(audioCtx);
    try {
      await audioInput.requestMic();
    } catch {
      setStatus(statusEl, "Microphone access denied — please allow mic access and try again.", "error");
      setState(STATE.IDLE);
      isChallengeMode = false;
      return;
    }
  }

  startCountdown();
}

function startCountdown() {
  document.querySelector(".staff-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setState(isCalibrating ? STATE.CALIBRATING : STATE.COUNTDOWN);
  const bpm          = getBpm();
  const beatSec      = 60 / bpm;
  const beatMs       = beatSec * 1000;
  const activeTimeSig = isCalibrating ? CALIB_TIMESIG : currentRhythm.timeSig;
  const beatsPerBar  = activeTimeSig.beats;

  ensureAudioCtx();

  const audioNow = audioCtx.currentTime;
  const perfNow  = performance.now();
  const countStartAudio = audioNow + 0.05;

  for (let i = 0; i < beatsPerBar; i++) {
    scheduleCountClick(countStartAudio + i * beatSec, i === 0);
  }

  const rhythmStartAudio = countStartAudio + beatsPerBar * beatSec;
  const rhythmStartPerf = perfNow + (rhythmStartAudio - audioNow) * 1000;

  let count = beatsPerBar;
  showCountdown(countdownEl, count);
  count--;
  const interval = setInterval(() => {
    if (count > 0) {
      showCountdown(countdownEl, count);
      count--;
    } else {
      showCountdown(countdownEl, 0);
      clearInterval(interval);
    }
  }, beatMs);

  const msUntilBeat1 = (rhythmStartAudio - audioNow) * 1000;
  setTimeout(() => {
    clearCountdown(countdownEl);
    startRecording(rhythmStartAudio, rhythmStartPerf);
  }, msUntilBeat1 - 30);
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

function startRecording(rhythmStartAudio, rhythmStartPerf) {
  const bpm = getBpm();
  const activePattern = isCalibrating ? CALIB_PATTERN : currentRhythm.pattern;
  const activeTimeSig = isCalibrating ? CALIB_TIMESIG : currentRhythm.timeSig;
  const { beats, totalDuration } = rhythmToTimestamps(activePattern, bpm);
  const quarterBeats = totalBeats(activePattern);

  clapTimestamps = [];
  sequenceStartMs     = rhythmStartPerf;
  lastTotalDurationMs = totalDuration;

  lastSpaceMs = -Infinity;
  currentDebounceMs = adaptiveDebounceMs(activePattern, bpm);
  setState(STATE.RECORDING);

  if (inputMode === "mic") {
    audioInput.DEBOUNCE_MS = currentDebounceMs;
    audioInput.start((absoluteMs) => {
      clapTimestamps.push(absoluteMs - sequenceStartMs);
      flashClap(clapIndicator);
    });
  }

  timingEngine.start(
    bpm,
    quarterBeats,
    () => flashBeat(beatIndicator),
    rhythmStartAudio,
    activeTimeSig.beats
  );

  setTimeout(() => {
    if (state === STATE.RECORDING || state === STATE.CALIBRATING) finishRecording();
  }, totalDuration + 600);
}

function finishRecording() {
  if (inputMode === "mic" && audioInput) audioInput.stop();
  timingEngine.stop();

  if (isCalibrating) {
    isCalibrating = false;
    finishCalibration();
    return;
  }

  const activeOffset = inputMode === "mic" ? micOffsetMs : spaceOffsetMs;
  const adjustedClaps = clapTimestamps.map((t) => t - activeOffset);
  const { beats } = rhythmToTimestamps(currentRhythm.pattern, getBpm());
  lastAnalysis = analyzePerformance(beats, adjustedClaps);

  setState(STATE.RESULTS);
  renderResults(resultsEl, lastAnalysis, lastTotalDurationMs);
  playbackBtn.style.display = "";

  if (isChallengeMode) {
    isChallengeMode = false;
    challengeSubmitWrap.style.display = "";
    lbSubmitBtn.focus();
  }
}

// ── Calibration ───────────────────────────────────────────────────────────────

async function onCalibrateClick() {
  if (state !== STATE.IDLE && state !== STATE.RESULTS) return;

  ensureAudioCtx();

  if (inputMode === "mic") {
    if (!audioInput) audioInput = new AudioInput(audioCtx);
    try {
      await audioInput.requestMic();
    } catch {
      setStatus(statusEl, "Microphone access denied — please allow mic access and try again.", "error");
      return;
    }
  }

  isCalibrating = true;
  startCountdown();
}

function finishCalibration() {
  const bpm = getBpm();
  const { beats } = rhythmToTimestamps(CALIB_PATTERN, bpm);

  const offsets = [];
  beats.forEach((beat) => {
    let nearest = null;
    let nearestDist = Infinity;
    clapTimestamps.forEach((t) => {
      const dist = Math.abs(t - beat.time);
      if (dist < nearestDist) { nearestDist = dist; nearest = t; }
    });
    if (nearest !== null && nearestDist < 400) {
      offsets.push(nearest - beat.time);
    }
  });

  if (offsets.length >= 2) {
    offsets.sort((a, b) => a - b);
    const median = offsets[Math.floor(offsets.length / 2)];
    const label  = inputMode === "mic" ? "Mic" : "Spacebar";

    if (inputMode === "mic") {
      micOffsetMs = median;
      localStorage.setItem("rhythmapp_offset", String(micOffsetMs));
    } else {
      spaceOffsetMs = median;
      localStorage.setItem("rhythmapp_space_offset", String(spaceOffsetMs));
    }

    updateOffsetDisplay();
    setStatus(statusEl,
      `Calibrated! ${label} offset set to ${median > 0 ? "+" : ""}${Math.round(median)}ms. You're ready to practice.`,
      "success"
    );
  } else {
    setStatus(statusEl, "Calibration needs at least 2 matched inputs — try again.", "error");
  }

  setState(STATE.IDLE);
}

function updateOffsetDisplay() {
  if (!offsetDisplay) return;
  const offset = inputMode === "mic" ? micOffsetMs : spaceOffsetMs;
  const label  = inputMode === "mic" ? "Mic" : "Spacebar";
  if (offset === 0) {
    offsetDisplay.textContent = "Not calibrated";
    offsetDisplay.className   = "offset-display uncalibrated";
  } else {
    offsetDisplay.textContent = `${label} offset: ${offset > 0 ? "+" : ""}${Math.round(offset)}ms`;
    offsetDisplay.className   = "offset-display calibrated";
  }
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

  const recordingMsg  = inputMode === "space"
    ? "Press spacebar on every beat! Press Stop when done."
    : "Clap along! Press Stop when done.";
  const calibrateMsg = inputMode === "space"
    ? "Press spacebar with every beat to calibrate…"
    : "Clap with every beat to calibrate…";

  const messages = {
    [STATE.IDLE]:           ["Select a rhythm and press Start.", ""],
    [STATE.REQUESTING_MIC]: ["Requesting microphone access…", "info"],
    [STATE.COUNTDOWN]:      ["Get ready…", "info"],
    [STATE.CALIBRATING]:    [calibrateMsg, "recording"],
    [STATE.RECORDING]:      [recordingMsg, "recording"],
    [STATE.RESULTS]:        ["Done! See your results below.", "success"],
    [STATE.PLAYBACK]:       ["Playing back the correct rhythm…", "info"],
  };

  const [msg, type] = messages[newState] || ["", ""];
  setStatus(statusEl, msg, type);

  const busy = newState === STATE.COUNTDOWN || newState === STATE.REQUESTING_MIC
            || newState === STATE.CALIBRATING;
  startBtn.textContent  = newState === STATE.RECORDING ? "⏹ Stop" : "▶ Start";
  startBtn.disabled     = busy;
  calibrateBtn.disabled = busy || newState === STATE.RECORDING;

  if (newState === STATE.RESULTS) playbackBtn.textContent = "▶ Play Correct Rhythm";
  if (newState !== STATE.RESULTS && newState !== STATE.PLAYBACK) {
    playbackBtn.style.display = "none";
  }

  const isActive = newState === STATE.RECORDING || newState === STATE.CALIBRATING;
  beatIndicator.classList.toggle("hidden", !isActive);
  clapIndicator.classList.toggle("hidden", !isActive);
  beatLabel.classList.toggle("hidden",     !isActive);
  clapLabel.classList.toggle("hidden",     !isActive);
  if (spacebarHint) spacebarHint.classList.toggle("hidden", !(isActive && inputMode === "space"));

  resultsSection.style.display =
    (newState === STATE.RESULTS || newState === STATE.PLAYBACK) ? "" : "none";
}
