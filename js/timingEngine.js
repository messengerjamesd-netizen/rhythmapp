// timingEngine.js — metronome scheduler using Web Audio API clock
// Uses AudioContext.currentTime for sample-accurate scheduling.

export class TimingEngine {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this._scheduledBeats = [];
    this._rafId = null;
    this._onTick = null;     // callback(beatNumber) for UI flash
    this._running = false;
  }

  /**
   * Start metronome. Fires onTick(beatIndex) each beat for UI.
   * lookahead: how far ahead to schedule (ms)
   * scheduleInterval: how often the scheduler runs (ms)
   */
  start(bpm, totalBeatCount, onTick, startAudioTime, beatsPerBar = 4) {
    this._running = true;
    this._onTick = onTick;
    this._bpm = bpm;
    this._msPerBeat = (60 / bpm) * 1000;
    this._startAudioTime = startAudioTime;
    this._totalBeats = totalBeatCount;
    this._beatsPerBar = beatsPerBar;
    this._lookahead = 0.1;       // seconds ahead to schedule audio
    this._scheduleInterval = 25; // ms between scheduler runs
    this._nextBeat = 0;
    this._notifiedBeats = new Set();
    this._clickNodes = [];       // keep JS refs so GC doesn't collect audio nodes

    this._schedule();
  }

  stop() {
    this._running = false;
    if (this._rafId) {
      clearTimeout(this._rafId);
      this._rafId = null;
    }
    this._scheduledBeats = [];
    this._notifiedBeats = new Set();
    if (this._clickNodes) {
      this._clickNodes.forEach(({ osc, gain }) => {
        try { osc.stop(); } catch (_) {}
        try { osc.disconnect(); gain.disconnect(); } catch (_) {}
      });
      this._clickNodes = [];
    }
  }

  _schedule() {
    if (!this._running) return;

    const now = this.audioCtx.currentTime;
    const scheduleUntil = now + this._lookahead;

    // Schedule all beats that fall within the lookahead window
    while (
      this._nextBeat < this._totalBeats &&
      this._startAudioTime + (this._nextBeat * this._msPerBeat) / 1000 < scheduleUntil
    ) {
      const beatAudioTime =
        this._startAudioTime + (this._nextBeat * this._msPerBeat) / 1000;
      this._scheduleClick(beatAudioTime, this._nextBeat);
      this._scheduledBeats.push({ beatIndex: this._nextBeat, audioTime: beatAudioTime });
      this._nextBeat++;
    }

    // Notify UI for beats that have passed (for visual flash)
    const nowMs = this.audioCtx.currentTime;
    this._scheduledBeats.forEach(({ beatIndex, audioTime }) => {
      if (audioTime <= nowMs && !this._notifiedBeats.has(beatIndex)) {
        this._notifiedBeats.add(beatIndex);
        if (this._onTick) this._onTick(beatIndex);
      }
    });

    this._rafId = setTimeout(() => this._schedule(), this._scheduleInterval);
  }

  // Create a short click sound at the given AudioContext time
  _scheduleClick(audioTime, beatIndex) {
    const ctx = this.audioCtx;

    // Accent beat 0 of each bar (every 4 quarter-note beats)
    const isAccent = Math.round(beatIndex) % this._beatsPerBar === 0;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = isAccent ? 1000 : 800;
    gain.gain.setValueAtTime(isAccent ? 0.5 : 0.4, audioTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.05);

    osc.start(audioTime);
    osc.stop(audioTime + 0.06);

    this._clickNodes.push({ osc, gain });
  }
}
