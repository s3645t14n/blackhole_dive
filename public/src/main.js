import { PHYSICS, worldState } from './state.js';
import { generateSystem } from './generator.js';
import {
  stepSimulation,
  rebuildPrediction,
  resetCurrentLevel
} from './physics.js';
import { createControls } from './controls.js';
import { createCamera, renderWorld } from './renderer.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hardModeToggle = document.getElementById('hardModeToggle');
const zoomModeToggle = document.getElementById('zoomModeToggle');
const resetBtn = document.getElementById('resetBtn');
const regenBtn = document.getElementById('regenBtn');

const input = createControls();
const { camera, resize, backgroundStars } = createCamera(canvas);

hardModeToggle.checked = worldState.hardMode;
hardModeToggle.addEventListener('change', () => {
  worldState.hardMode = hardModeToggle.checked;
  rebuildPrediction(worldState);
  hardModeToggle.blur();
});

zoomModeToggle.checked = worldState.zoomMode;
zoomModeToggle.addEventListener('change', () => {
  worldState.zoomMode = zoomModeToggle.checked;
  zoomModeToggle.blur();
});

resetBtn.addEventListener('click', () => {
  resetCurrentLevel(worldState);
  resetBtn.blur();
});

function initLevel() {
  generateSystem(worldState);
  resize(worldState);
}

regenBtn.addEventListener('click', () => {
  initLevel();
  regenBtn.blur();
});

function advanceLevel() {
  worldState.level += 1;
  initLevel();
}

initLevel();

window.addEventListener('resize', () => {
  resize(worldState);
});

const tickMs = PHYSICS.DT * 1000;

setInterval(() => {
  stepSimulation(worldState, input, advanceLevel);
}, tickMs);

function frameLoop() {
  const now = performance.now();
  const alpha = (now - worldState.lastTickTime) / tickMs;
  renderWorld(ctx, camera, backgroundStars, worldState, input, alpha, now);
  requestAnimationFrame(frameLoop);
}

requestAnimationFrame(frameLoop);
