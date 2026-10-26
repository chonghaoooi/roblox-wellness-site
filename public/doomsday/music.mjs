// Original cinematic cue. Try autoplay, then unlock on the first page interaction
// when browser policy blocks sound before a user gesture.
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audio = null;
let master = null;
let scheduler = null;
let nextBeat = 0;
let beatIndex = 0;
let noiseBuffer = null;

function envelope(gain, time, peak, length) {
  gain.setValueAtTime(0.0001, time);
  gain.exponentialRampToValueAtTime(peak, time + 0.012);
  gain.exponentialRampToValueAtTime(0.0001, time + length);
}

function tone(frequency, time, length, peak, type, cutoff) {
  const oscillator = audio.createOscillator();
  const filter = audio.createBiquadFilter();
  const volume = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, time);
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  envelope(volume.gain, time, peak, length);
  oscillator.connect(filter).connect(volume).connect(master);
  oscillator.start(time);
  oscillator.stop(time + length + 0.02);
}

function pluck(semitones, time, strength = 1) {
  const frequency = 261.6256 * Math.pow(2, semitones / 12);
  tone(frequency, time, 1.3, 0.12 * strength, 'triangle', 2200);
  tone(frequency * 2.005, time, 0.4, 0.035 * strength, 'sine', 3000);
}

function drum(time, strength = 1) {
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(110, time);
  oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.32);
  envelope(volume.gain, time, 0.17 * strength, 0.58);
  oscillator.connect(volume).connect(master);
  oscillator.start(time);
  oscillator.stop(time + 0.6);
}

function gong(time) {
  const noise = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const volume = audio.createGain();
  noise.buffer = noiseBuffer;
  filter.type = 'bandpass';
  filter.frequency.value = 750;
  filter.Q.value = 0.5;
  envelope(volume.gain, time, 0.045, 4.8);
  noise.connect(filter).connect(volume).connect(master);
  noise.start(time);
  noise.stop(time + 4.9);
  tone(196, time, 5, 0.018, 'sine', 900);
  tone(301, time, 4, 0.012, 'sine', 900);
}

function shaker(time, strength = 1) {
  const noise = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const volume = audio.createGain();
  noise.buffer = noiseBuffer;
  filter.type = 'highpass';
  filter.frequency.value = 3800;
  envelope(volume.gain, time, 0.028 * strength, 0.13);
  noise.connect(filter).connect(volume).connect(master);
  noise.start(time);
  noise.stop(time + 0.14);
}

function tick(time, high) {
  const frequency = high ? 1820 : 1370;
  for (const [delay, strength] of [[0, 1], [0.055, 0.42]]) {
    const at = time + delay;
    const noise = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const volume = audio.createGain();
    noise.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 2.2;
    envelope(volume.gain, at, 0.16 * strength, 0.045);
    noise.connect(filter).connect(volume).connect(master);
    noise.start(at);
    noise.stop(at + 0.05);
    tone(frequency, at, 0.048, 0.022 * strength, 'sine', 3200);
  }
}

function createDrone() {
  for (const [frequency, level] of [[65.406, 0.045], [98, 0.018]]) {
    const oscillator = audio.createOscillator();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = frequency;
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    gain.gain.value = level;
    oscillator.connect(filter).connect(gain).connect(master);
    oscillator.start();
  }
}

const melody = [0, 3, 7, null, 10, 7, 5, 3,
  7, 5, 3, null, 0, 3, 5, null,
  0, 5, 7, 10, 12, 10, 7, 5,
  3, 5, 7, null, 3, 0, -2, null];
const beatDuration = 60 / 116;

function schedule() {
  while (nextBeat < audio.currentTime + 0.3) {
    const step = beatIndex % melody.length;
    if (melody[step] !== null) pluck(melody[step], nextBeat, step % 8 === 0 ? 1.15 : 0.72);
    if (step % 4 === 0) drum(nextBeat, 1);
    if (step % 4 === 2) drum(nextBeat, 0.55);
    shaker(nextBeat, step % 2 === 0 ? 1 : 0.65);
    shaker(nextBeat + beatDuration / 2, 0.42);
    if (step % 16 === 0) gong(nextBeat);
    if (step % 8 === 2) tone(130.8128 * Math.pow(2, melody[step - 2] / 12), nextBeat, 4.5, 0.03, 'sawtooth', 470);
    beatIndex++;
    nextBeat += beatDuration;
  }
}

function unlock() {
  if (!audio || audio.state === 'running') return;
  audio.resume().catch(() => {});
}

function start() {
  if (!AudioContextClass) return;
  audio = new AudioContextClass();
  document.documentElement.dataset.audioState = audio.state;
  audio.onstatechange = () => {
    document.documentElement.dataset.audioState = audio.state;
    if (audio.state === 'running') {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    }
  };
  master = audio.createGain();
  master.gain.setValueAtTime(0.0001, audio.currentTime);
  master.gain.exponentialRampToValueAtTime(0.55, audio.currentTime + 1.5);
  master.connect(audio.destination);
  noiseBuffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * 5), audio.sampleRate);
  const noise = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
  createDrone();
  nextBeat = audio.currentTime + 0.05;
  beatIndex = 0;
  schedule();
  scheduler = window.setInterval(schedule, 100);
  unlock();
}

window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);
window.addEventListener('touchstart', unlock, { passive: true });
window.addEventListener('doomsday-second', event => {
  if (audio?.state === 'running') tick(audio.currentTime + 0.005, event.detail % 2 === 0);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) unlock(); });
start();
