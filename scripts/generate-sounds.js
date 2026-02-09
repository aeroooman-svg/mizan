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

function generateExpenseSound(sampleRate = 44100) {
  const duration = 0.35;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float64Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 12) * 0.7;
    const freq1 = 800 - t * 1200;
    const freq2 = 600 - t * 800;
    const s = Math.sin(2 * Math.PI * freq1 * t) * 0.5 +
              Math.sin(2 * Math.PI * freq2 * t) * 0.3 +
              Math.sin(2 * Math.PI * 200 * t) * 0.2;
    samples[i] = s * envelope;
  }

  const clickSamples = Math.floor(sampleRate * 0.008);
  for (let i = 0; i < clickSamples && i < totalSamples; i++) {
    const t = i / sampleRate;
    samples[i] += Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-t * 500) * 0.3;
  }

  return samples;
}

function generateIncomeSound(sampleRate = 44100) {
  const duration = 0.5;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float64Array(totalSamples);

  const notes = [
    { freq: 1047, start: 0, dur: 0.15 },
    { freq: 1319, start: 0.08, dur: 0.15 },
    { freq: 1568, start: 0.16, dur: 0.25 },
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    for (const note of notes) {
      if (t >= note.start && t < note.start + note.dur) {
        const nt = t - note.start;
        const attack = Math.min(nt / 0.01, 1);
        const decay = Math.exp(-(nt - 0.01) * 8);
        const env = attack * decay * 0.5;
        s += Math.sin(2 * Math.PI * note.freq * nt) * env * 0.6;
        s += Math.sin(2 * Math.PI * note.freq * 2 * nt) * env * 0.2;
        s += Math.sin(2 * Math.PI * note.freq * 3 * nt) * env * 0.1;
      }
    }

    const shimmer = Math.sin(2 * Math.PI * 4000 * t) * Math.exp(-t * 20) * 0.08;
    samples[i] = s + shimmer;
  }

  return samples;
}

const sampleRate = 44100;
const expenseSamples = generateExpenseSound(sampleRate);
const incomeSamples = generateIncomeSound(sampleRate);

const expenseBuffer = createWavBuffer(Array.from(expenseSamples), sampleRate);
const incomeBuffer = createWavBuffer(Array.from(incomeSamples), sampleRate);

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.writeFileSync(path.join(outDir, 'expense.wav'), expenseBuffer);
fs.writeFileSync(path.join(outDir, 'income.wav'), incomeBuffer);

console.log('Sound files generated successfully!');
console.log(`  expense.wav: ${expenseBuffer.length} bytes`);
console.log(`  income.wav: ${incomeBuffer.length} bytes`);
