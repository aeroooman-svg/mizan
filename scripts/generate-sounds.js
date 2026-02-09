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

function generateIncomeSound(sampleRate = 44100) {
  const duration = 0.75;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float64Array(totalSamples);

  const coins = [
    { start: 0.0, freq: 2637, dur: 0.12, vol: 0.25 },
    { start: 0.03, freq: 3520, dur: 0.10, vol: 0.15 },
    { start: 0.06, freq: 4186, dur: 0.08, vol: 0.10 },
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    for (const c of coins) {
      if (t >= c.start && t < c.start + c.dur) {
        const ct = t - c.start;
        const env = Math.exp(-ct * 35) * c.vol;
        s += Math.sin(2 * Math.PI * c.freq * ct) * env;
        s += Math.sin(2 * Math.PI * c.freq * 1.5 * ct) * env * 0.3;
      }
    }

    const chimeNotes = [
      { freq: 1319, start: 0.10, dur: 0.18 },
      { freq: 1568, start: 0.18, dur: 0.18 },
      { freq: 1976, start: 0.26, dur: 0.20 },
      { freq: 2637, start: 0.34, dur: 0.35 },
    ];

    for (const note of chimeNotes) {
      if (t >= note.start && t < note.start + note.dur) {
        const nt = t - note.start;
        const attack = Math.min(nt / 0.008, 1);
        const sustain = Math.exp(-nt * 5);
        const env = attack * sustain * 0.35;
        s += Math.sin(2 * Math.PI * note.freq * nt) * env;
        s += Math.sin(2 * Math.PI * note.freq * 2 * nt) * env * 0.15;
        s += Math.sin(2 * Math.PI * note.freq * 3 * nt) * env * 0.05;
      }
    }

    const sparkleFreqs = [5274, 6645, 7902];
    for (let si = 0; si < sparkleFreqs.length; si++) {
      const sStart = 0.35 + si * 0.04;
      if (t >= sStart && t < sStart + 0.08) {
        const st = t - sStart;
        const env = Math.exp(-st * 50) * 0.06;
        s += Math.sin(2 * Math.PI * sparkleFreqs[si] * st) * env;
      }
    }

    if (t >= 0.34 && t < 0.70) {
      const rt = t - 0.34;
      const rEnv = Math.exp(-rt * 4) * 0.08;
      s += Math.sin(2 * Math.PI * 2637 * rt + Math.sin(2 * Math.PI * 5 * rt) * 0.3) * rEnv;
    }

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
