const canvas = document.querySelector('.fire-canvas');
const context = canvas.getContext('2d', { alpha: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let width = 0;
let height = 0;
let particles = [];
let previousFrame = 0;

function newParticle(scattered = false) {
  const life = 75 + Math.random() * 105;
  const speed = 0.35 + Math.random() * 1.1;
  const age = scattered ? Math.random() * life : 0;
  return {
    x: Math.random() * width,
    y: height * (0.87 + Math.random() * 0.2) - age * speed * 1.6,
    age,
    life,
    speed,
    drift: (Math.random() - 0.5) * 0.45,
    radius: 1.2 + Math.random() * 3.4,
    hue: 22 + Math.random() * 24,
  };
}

function resize() {
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  particles = Array.from({ length: width < 700 ? 65 : 125 }, () => newParticle(true));
  draw();
}

function draw() {
  context.clearRect(0, 0, width, height);
  context.globalCompositeOperation = 'lighter';
  for (const particle of particles) {
    const alpha = Math.sin(Math.PI * particle.age / particle.life) * 0.75;
    if (alpha <= 0) continue;
    const glow = particle.radius * 4;
    const gradient = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, glow);
    gradient.addColorStop(0, `hsla(${particle.hue + 10}, 100%, 81%, ${alpha})`);
    gradient.addColorStop(0.18, `hsla(${particle.hue}, 100%, 56%, ${alpha * 0.75})`);
    gradient.addColorStop(1, `hsla(8, 100%, 45%, 0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(particle.x, particle.y, glow, 0, Math.PI * 2);
    context.fill();
  }
  context.globalCompositeOperation = 'source-over';
}

function frame(time) {
  const elapsed = Math.min((time - (previousFrame || time)) / 16.67, 2);
  previousFrame = time;
  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    particle.age += elapsed;
    particle.y -= particle.speed * elapsed * 1.6;
    particle.x += (particle.drift + Math.sin(time / 850 + i) * 0.16) * elapsed;
    if (particle.age >= particle.life || particle.y < -20) particles[i] = newParticle();
  }
  draw();
  if (!reducedMotion.matches) requestAnimationFrame(frame);
}

if (context) {
  resize();
  window.addEventListener('resize', resize);
  if (!reducedMotion.matches) requestAnimationFrame(frame);
}
