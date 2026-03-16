class AudioRecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048; // 2048 frames
    this.buffer = new Int16Array(this.bufferSize);
    this.offset = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0]; // Mono channel
      if (!channelData) return true;

      for (let i = 0; i < channelData.length; i++) {
        // Convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
        let s = Math.max(-1, Math.min(1, channelData[i]));
        this.buffer[this.offset] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        this.offset++;

        if (this.offset >= this.bufferSize) {
            // Send copy of buffer
            const copy = new Int16Array(this.buffer);
            this.port.postMessage(copy.buffer, [copy.buffer]);
            this.offset = 0;
        }
      }
    }
    return true; // Keep processor alive
  }
}

registerProcessor('audio-recorder-worklet', AudioRecorderWorklet);
