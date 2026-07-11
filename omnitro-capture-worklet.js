// omnitro-capture-worklet.js
//
// Single-path recording capture processor. Runs on the audio rendering
// thread. Captures all 8 input channels (omni L/R, drum L/R, vocal L/R,
// mix L/R) every render quantum (128 samples) and posts them to the main
// thread. Because every channel is read from the same process() call, all
// 8 channels describe the exact same audio-time window — sync between
// stems is structural, not empirically close.
//
// Loaded as a real file (not a Blob URL) because Safari has an unreliable
// implementation of audioWorklet.addModule() with blob: URLs that can
// throw a bare SyntaxError even for syntactically valid module code.

class OmnitroMultiChannelCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.port.onmessage = (e) => {
      if (e.data.cmd === 'start') { this.recording = true; }
      if (e.data.cmd === 'stop')  { this.recording = false; }
    };
  }
  process(inputs) {
    const input = inputs[0];
    if (this.recording && input && input.length > 0 && input[0] && input[0].length > 0) {
      const channels = input.map(ch => ch.slice()); // copy: buffers are reused
      this.port.postMessage({ channels }, channels.map(c => c.buffer));
    }
    return true;
  }
}
registerProcessor('omnitro-multi-channel-capture', OmnitroMultiChannelCapture);
