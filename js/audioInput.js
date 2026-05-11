// audioInput.js — microphone access and clap detection

export class AudioInput {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this._stream        = null;
    this._sourceNode    = null;
    this._highpass      = null;
    this._processorNode = null;
    this._listening     = false;
    this._onClap        = null;
    this._lastClapTime  = -Infinity;
    this.DEBOUNCE_MS    = 80;
    this.THRESHOLD      = 0.15; // user-adjustable sensitivity floor

    // Internal state
    this._noiseFloor = 0.02; // adaptive background level
    this._prevPeak   = 0;    // previous buffer peak for attack detection

    // Clock anchors for accurate timestamps
    this._audioAtStart = 0;
    this._perfAtStart  = 0;
  }

  async requestMic() {
    // Disable browser processing so we get the raw signal
    this._stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl:  false,
      },
      video: false,
    });
  }

  start(onClap) {
    if (!this._stream) throw new Error("Call requestMic() first");
    this._onClap    = onClap;
    this._listening = true;

    // Pin both clocks at the same instant for accurate timestamp conversion
    this._audioAtStart = this.audioCtx.currentTime;
    this._perfAtStart  = performance.now();
    this._noiseFloor   = 0.02;
    this._prevPeak     = 0;

    const ctx = this.audioCtx;
    this._sourceNode = ctx.createMediaStreamSource(this._stream);

    // High-pass filter: attenuates low-frequency noise (voices, HVAC, handling noise).
    // Claps are broadband; most background noise concentrates below 1 kHz.
    this._highpass = ctx.createBiquadFilter();
    this._highpass.type            = "highpass";
    this._highpass.frequency.value = 1000;
    this._highpass.Q.value         = 0.7;

    // bufferSize 512 ≈ 11 ms at 44100 Hz — fine resolution for onset detection
    this._processorNode = ctx.createScriptProcessor(512, 1, 1);
    this._processorNode.onaudioprocess = (e) => this._processBuffer(e);

    this._sourceNode.connect(this._highpass);
    this._highpass.connect(this._processorNode);

    // Must connect to destination to keep the processor alive; gain=0 prevents feedback
    const muter = ctx.createGain();
    muter.gain.value = 0;
    this._processorNode.connect(muter);
    muter.connect(ctx.destination);
  }

  stop() {
    this._listening = false;
    if (this._processorNode) { this._processorNode.disconnect(); this._processorNode = null; }
    if (this._highpass)      { this._highpass.disconnect();      this._highpass      = null; }
    if (this._sourceNode)    { this._sourceNode.disconnect();    this._sourceNode    = null; }
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

    // Peak amplitude in this 11 ms window
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const abs = Math.abs(buffer[i]);
      if (abs > peak) peak = abs;
    }

    // Attack rate: how sharply amplitude rose from the previous buffer.
    // Claps rise in < 10 ms; sustained sounds rise slowly.
    const attack    = peak - this._prevPeak;
    this._prevPeak  = peak;

    // Accurate timestamp: audio clock time for this buffer, converted to performance.now() ms.
    // This is more reliable than calling performance.now() inside the JS callback,
    // which fires slightly late due to scheduling jitter.
    const bufferPerfMs =
      this._perfAtStart + (event.playbackTime - this._audioAtStart) * 1000;

    // Adaptive noise floor: update only during quiet periods (well after last clap).
    // Slow blend (3%) so brief loud sounds don't permanently raise the floor.
    if (bufferPerfMs - this._lastClapTime > this.DEBOUNCE_MS * 2) {
      this._noiseFloor = this._noiseFloor * 0.97 + peak * 0.03;
    }

    // Dynamic threshold: 4× the live noise floor, floored by the user's sensitivity slider.
    const dynThreshold = Math.max(this._noiseFloor * 4, this.THRESHOLD * 0.4);

    // Trigger when: amplitude clearly exceeds threshold AND rose sharply (transient onset)
    if (peak > dynThreshold && attack > dynThreshold * 0.35) {
      if (bufferPerfMs - this._lastClapTime > this.DEBOUNCE_MS) {
        this._lastClapTime = bufferPerfMs;
        if (this._onClap) this._onClap(bufferPerfMs);
      }
    }
  }
}
