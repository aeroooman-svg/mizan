const fs = require('fs');
const path = require('path');

function createWavBuffer(samples, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(val * 32767), headerSize + i * 2);
  }
  return buffer;
}

function noise() {
  return Math.random() * 2 - 1;
}

function generateIncomeSound(sampleRate = 44100) {
  const duration = 0.65;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float64Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    // Part 1: Mechanical click/lever (0 - 0.04s)
    if (t < 0.04) {
      const clickEnv = Math.exp(-t * 150);
      s += noise() * clickEnv * 0.4;
      s += Math.sin(2 * Math.PI * 1800 * t) * clickEnv * 0.3;
    }

    // Part 2: Drawer slide noise burst (0.03 - 0.12s)
    if (t >= 0.03 && t < 0.12) {
      const dt = t - 0.03;
      const slideEnv = Math.sin(Math.PI * dt / 0.09) * 0.2;
      const filtered = noise() * slideEnv;
      s += filtered * 0.5;
      s += Math.sin(2 * Math.PI * 400 * dt) * slideEnv * 0.3;
    }

    // Part 3: Metal bell ring — the iconic "ching" (0.08 - 0.60s)
    if (t >= 0.08) {
      const bt = t - 0.08;
      const bellAttack = Math.min(bt / 0.003, 1);
      const bellDecay = Math.exp(-bt * 6);
      const bellEnv = bellAttack * bellDecay * 0.55;

      // Main bell tone with inharmonic partials (like a real bell)
      s += Math.sin(2 * Math.PI * 2093 * bt) * bellEnv;                    // C7
      s += Math.sin(2 * Math.PI * 2093 * 2.76 * bt) * bellEnv * 0.28;      // inharmonic partial
      s += Math.sin(2 * Math.PI * 2093 * 5.4 * bt) * bellEnv * 0.12;       // high partial
      s += Math.sin(2 * Math.PI * 2093 * 0.5 * bt) * bellEnv * 0.2;        // sub partial

      // Slight vibrato on the bell for realism
      const vibrato = Math.sin(2 * Math.PI * 6 * bt) * 0.002;
      s += Math.sin(2 * Math.PI * 2093 * (1 + vibrato) * bt) * bellEnv * 0.15;
    }

    // Part 4: Second bell strike "ka-CHING" (0.14 - 0.60s)
    if (t >= 0.14) {
      const bt2 = t - 0.14;
      const bell2Attack = Math.min(bt2 / 0.002, 1);
      const bell2Decay = Math.exp(-bt2 * 4.5);
      const bell2Env = bell2Attack * bell2Decay * 0.6;

      s += Math.sin(2 * Math.PI * 3136 * bt2) * bell2Env;                   // G7
      s += Math.sin(2 * Math.PI * 3136 * 2.76 * bt2) * bell2Env * 0.22;
      s += Math.sin(2 * Math.PI * 3136 * 5.4 * bt2) * bell2Env * 0.08;
      s += Math.sin(2 * Math.PI * 3136 * 0.5 * bt2) * bell2Env * 0.15;
    }

    // Part 5: Metallic shimmer tail (0.18 - 0.55s)
    if (t >= 0.18 && t < 0.55) {
      const st = t - 0.18;
      const shimmerEnv = Math.exp(-st * 8) * 0.06;
      s += Math.sin(2 * Math.PI * 5274 * st + Math.sin(2 * Math.PI * 11 * st) * 2) * shimmerEnv;
      s += Math.sin(2 * Math.PI * 6645 * st) * shimmerEnv * 0.5;
    }

    // Soft limiter
    if (s > 0.85) s = 0.85 + (s - 0.85) * 0.3;
    if (s < -0.85) s = -0.85 + (s + 0.85) * 0.3;

    samples[i] = s;
  }

  return samples;
}

const sampleRate = 44100;
const incomeSamples = generateIncomeSound(sampleRate);
const incomeBuffer = createWavBuffer(Array.from(incomeSamples), sampleRate);
const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.writeFileSync(path.join(outDir, 'income.wav'), incomeBuffer);
console.log('Income sound regenerated!');
console.log(`  income.wav: ${incomeBuffer.length} bytes`);
