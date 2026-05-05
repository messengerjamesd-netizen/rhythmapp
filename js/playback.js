// playback.js — play back the rhythm using synthesized tones so students can hear it

export class PlaybackEngine {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this._scheduled = [];
    this._playing = false;
  }

  /**
   * Play the rhythm pattern once at the given BPM.
   * onDone() is called when playback finishes.
   */
  play(pattern, bpm, onDone) {
    this.stop();
    this._playing = true;

    const msPerBeat = (60 / bpm) * 1000;
    const ctx = this.audioCtx;
    const startTime = ctx.currentTime + 0.05; // tiny offset to avoid clipping
    let cursor = 0;
    let lastEventEnd = startTime;

    pattern.forEach((event) => {
      const eventStart = startTime + cursor / 1000;
      const eventDuration = (event.duration * msPerBeat) / 1000;

      if (event.type === "note") {
        // Use a short triangle-wave tone to represent each note
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "triangle";
        osc.frequency.value = 440; // A4 — neutral pitch for all notes

        // Envelope: quick attack, then fade to avoid harsh cutoff
        const noteDur = Math.min(eventDuration * 0.8, 0.3); // cap at 300ms
        gain.gain.setValueAtTime(0, eventStart);
        gain.gain.linearRampToValueAtTime(0.4, eventStart + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, eventStart + noteDur);

        osc.start(eventStart);
        osc.stop(eventStart + noteDur + 0.01);
        this._scheduled.push(osc);

        lastEventEnd = Math.max(lastEventEnd, eventStart + noteDur);
      }

      cursor += event.duration * msPerBeat;
    });

    // Fire onDone after all audio has played
    const totalSeconds = cursor / 1000 + 0.1;
    const timer = setTimeout(() => {
      this._playing = false;
      if (onDone) onDone();
    }, (startTime - ctx.currentTime + totalSeconds) * 1000);

    this._timer = timer;
  }

  stop() {
    this._playing = false;
    this._scheduled.forEach((osc) => {
      try { osc.stop(); } catch (_) {}
    });
    this._scheduled = [];
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  get isPlaying() {
    return this._playing;
  }
}
