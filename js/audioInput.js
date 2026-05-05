// audioInput.js — microphone access and clap detection via amplitude spikes

export class AudioInput {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this._stream = null;
    this._sourceNode = null;
    this._processorNode = null;
    this._analyser = null;
    this._listening = false;
    this._onClap = null;
    this._lastClapTime = -Infinity; // ms, for debounce
    this.DEBOUNCE_MS = 150;         // minimum gap between two claps
    this.THRESHOLD = 0.25;          // amplitude threshold (0–1); raised to avoid noise
  }

  async requestMic() {
    this._stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }

  /**
   * Start listening. onClap(timestampMs) is called each time a clap is detected.
   * timestampMs is performance.now() at detection — callers subtract sequence start.
   */
  start(onClap) {
    if (!this._stream) throw new Error("Call requestMic() first");
    this._onClap = onClap;
    this._listening = true;

    const ctx = this.audioCtx;
    this._sourceNode = ctx.createMediaStreamSource(this._stream);

    // ScriptProcessorNode gives us raw PCM buffers to scan for peaks.
    // bufferSize 512 ≈ 11ms at 44100Hz — responsive enough for clap detection.
    this._processorNode = ctx.createScriptProcessor(512, 1, 1);
    this._processorNode.onaudioprocess = (e) => this._processBuffer(e);

    this._sourceNode.connect(this._processorNode);
    // Connect to destination is required for the processor to fire, but we
    // mute it so the student doesn't hear mic feedback.
    const muter = ctx.createGain();
    muter.gain.value = 0;
    this._processorNode.connect(muter);
    muter.connect(ctx.destination);
  }

  stop() {
    this._listening = false;
    if (this._processorNode) {
      this._processorNode.disconnect();
      this._processorNode = null;
    }
    if (this._sourceNode) {
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }
  }

  releaseMic() {
    this.stop();
    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
      this._stream = null;
    }
  }

  _processBuffer(event) {
    if (!this._listening) return;
    const buffer = event.inputBuffer.getChannelData(0);

    // Find the peak amplitude in this buffer window
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const abs = Math.abs(buffer[i]);
      if (abs > peak) peak = abs;
    }

    // Spike above threshold = potential clap
    if (peak > this.THRESHOLD) {
      const now = performance.now();
      // Debounce: ignore if too soon after the last detected clap
      if (now - this._lastClapTime > this.DEBOUNCE_MS) {
        this._lastClapTime = now;
        if (this._onClap) this._onClap(now);
      }
    }
  }
}
