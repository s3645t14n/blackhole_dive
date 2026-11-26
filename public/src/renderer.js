import { PHYSICS } from './state.js';

function createBackgroundStars(count = 55) {
  const stars = [];
  const tints = ['255, 255, 255', '210, 228, 255', '255, 240, 215'];

  for (let i = 0; i < count; i++) {
    stars.push({
      nx: Math.random(),
      ny: Math.random(),
      size: 0.8 + Math.random() * 0.9,
      baseAlpha: 0.14 + Math.random() * 0.28,
      twinkleAmp: 0.08 + Math.random() * 0.18,
      twinkleSpeed: 0.5 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      rgb: tints[Math.floor(Math.random() * tints.length)]
    });
  }

  return stars;
}

export function createCamera(canvas) {
  const camera = {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    scale: 1
  };

  const backgroundStars = createBackgroundStars(55);

  function resize(worldState) {
    camera.width = window.innerWidth;
    camera.height = window.innerHeight;
    camera.dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(camera.width * camera.dpr);
    canvas.height = Math.floor(camera.height * camera.dpr);

    const minDim = Math.min(camera.width, camera.height);
    const radius = Math.max(100, worldState.systemRadius || 600);
    camera.scale = minDim / (2 * radius * 1.05);

    worldState.bounds.halfWidth = (camera.width * 0.5) / camera.scale;
    worldState.bounds.halfHeight = (camera.height * 0.5) / camera.scale;
  }

  return { camera, resize, backgroundStars };
}

function drawBackgroundStars(ctx, camera, stars, timeSec) {
  const { width, height } = camera;
  for (const s of stars) {
    const alpha = Math.max(
      0.03,
      Math.min(0.65, s.baseAlpha + Math.sin(timeSec * s.twinkleSpeed + s.phase) * s.twinkleAmp)
    );
    ctx.fillStyle = `rgba(${s.rgb}, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(s.nx * width, s.ny * height, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLevelCounter(ctx, level) {
  ctx.save();
  ctx.font = '600 24px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.textBaseline = 'top';
  ctx.fillText(String(level), 20, 18);
  ctx.restore();
}

function drawFuelBar(ctx, camera, ship, alpha) {
  const barWidth = 180;
  const barHeight = 12;
  const x = 20;
  const y = camera.height - 18 - barHeight;

  const interpFuel = ship.prevFuel + (ship.fuel - ship.prevFuel) * alpha;
  const ratio = Math.max(0, Math.min(1, interpFuel / ship.maxFuel));

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(x, y, barWidth, barHeight);

  if (ratio > 0) {
    ctx.fillStyle = '#ff8c1a';
    ctx.fillRect(x, y, barWidth * ratio, barHeight);
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barWidth, barHeight);
  ctx.restore();
}

function drawOutOfFuelWarning(ctx, camera, ship, nowMs) {
  if (ship.status !== 'alive' || ship.fuel > 0) return;

  const fontSize = Math.round(Math.max(26, Math.min(54, camera.width * 0.042)));
  const pulse = 0.22 + 0.36 * (0.5 + 0.5 * Math.sin(nowMs * 0.006));

  ctx.save();
  ctx.font = `700 ${fontSize}px monospace`;
  ctx.fillStyle = `rgba(255, 45, 45, ${pulse.toFixed(3)})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OUT OF FUEL', camera.width * 0.5, camera.height * 0.16);
  ctx.restore();
}

function drawOrbitEllipse(ctx, body, centerX, centerY, lineWidth, strokeStyle) {
  const b = body.a * Math.sqrt(1 - body.e * body.e);
  const c = body.a * body.e;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(body.omega);
  ctx.beginPath();
  ctx.ellipse(-c, 0, body.a, b, 0, 0, Math.PI * 2);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
  ctx.restore();
}

function drawHillSphere(ctx, x, y, hillRadius, scale) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, hillRadius, 0, Math.PI * 2);
  ctx.setLineDash([5 / scale, 6 / scale]);
  ctx.lineWidth = 1 / scale;
  ctx.strokeStyle = 'rgba(130, 185, 255, 0.28)';
  ctx.stroke();
  ctx.restore();
}

function drawShipTrail(ctx, worldState, shipX, shipY, alpha, scale) {
  const { ship, simTime } = worldState;
  if (ship.status !== 'alive' || !ship.trail || ship.trail.length === 0) return;

  const renderTime = simTime - PHYSICS.DT + alpha * PHYSICS.DT;
  const minTime = renderTime - PHYSICS.SHIP_TRAIL_DURATION;

  const visible = [];
  for (let i = 0; i < ship.trail.length; i++) {
    const pt = ship.trail[i];
    if (pt.t >= minTime && pt.t <= renderTime) {
      visible.push(pt);
    }
  }
  visible.push({ x: shipX, y: shipY, t: renderTime });

  if (visible.length < 2) return;

  ctx.save();
  ctx.lineWidth = 1.1 / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const segments = 4;
  const total = visible.length - 1;

  for (let seg = 0; seg < segments; seg++) {
    const startIdx = Math.floor((seg / segments) * total);
    const endIdx = Math.floor(((seg + 1) / segments) * total);
    if (endIdx <= startIdx) continue;

    const segAlpha = 0.14 + seg * 0.19;
    ctx.beginPath();
    ctx.moveTo(visible[startIdx].x, visible[startIdx].y);
    for (let i = startIdx + 1; i <= endIdx; i++) {
      ctx.lineTo(visible[i].x, visible[i].y);
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${segAlpha.toFixed(2)})`;
    ctx.stroke();
  }

  ctx.restore();
}

function drawShipPrediction(ctx, worldState, shipX, shipY, alpha, scale) {
  const { ship, prediction } = worldState;
  if (worldState.hardMode || ship.status !== 'alive') return;

  const { points, impact, hasCurrentTickPrefix } = prediction;
  if (!points || points.length < 2) return;

  const startIdx = hasCurrentTickPrefix
    ? Math.min(points.length - 1, Math.floor(alpha * PHYSICS.SUBSTEPS) + 1)
    : 1;

  if (startIdx >= points.length) return;

  ctx.save();
  ctx.lineWidth = 1.6 / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const remaining = points.length - startIdx;
  const segments = 4;

  for (let seg = 0; seg < segments; seg++) {
    const segFrom = startIdx + Math.floor((seg / segments) * remaining);
    const segTo =
      seg === segments - 1
        ? points.length - 1
        : startIdx + Math.floor(((seg + 1) / segments) * remaining);

    if (segTo < segFrom) continue;

    const alphaVal = 0.88 - seg * 0.2;
    ctx.beginPath();
    if (seg === 0) {
      ctx.moveTo(shipX, shipY);
      ctx.lineTo(points[segFrom].x, points[segFrom].y);
    } else {
      ctx.moveTo(points[Math.max(startIdx, segFrom - 1)].x, points[Math.max(startIdx, segFrom - 1)].y);
      ctx.lineTo(points[segFrom].x, points[segFrom].y);
    }
    for (let i = segFrom + 1; i <= segTo; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = `rgba(55, 145, 255, ${alphaVal.toFixed(2)})`;
    ctx.stroke();
  }

  if (impact) {
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4.2 / scale, 0, Math.PI * 2);
    ctx.fillStyle = '#ff1a1a';
    ctx.fill();
  }

  ctx.restore();
}

function drawBlackHole(ctx, bh) {
  const outerGlowRadius = bh.radius * 2.1;
  const grad = ctx.createRadialGradient(
    bh.x,
    bh.y,
    bh.radius * 0.85,
    bh.x,
    bh.y,
    outerGlowRadius
  );
  grad.addColorStop(0, 'rgba(255, 220, 120, 1)');
  grad.addColorStop(0.18, 'rgba(255, 145, 30, 0.95)');
  grad.addColorStop(0.45, 'rgba(220, 75, 10, 0.55)');
  grad.addColorStop(0.75, 'rgba(140, 30, 0, 0.18)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.beginPath();
  ctx.arc(bh.x, bh.y, outerGlowRadius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(bh.x, bh.y, bh.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();
}

function drawShip(ctx, ship, x, y, input, alpha, scale) {
  if (ship.status === 'exploding') return;

  const angle = ship.prevAngle + (ship.angle - ship.prevAngle) * alpha;
  const absorbScale =
    ship.status === 'absorbing'
      ? ship.prevAbsorbScale + (ship.absorbScale - ship.prevAbsorbScale) * alpha
      : 1;

  const minWorldScale = Math.max(1, 0.7 / scale);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(absorbScale * minWorldScale, absorbScale * minWorldScale);

  const flicker = 0.85 + Math.random() * 0.35;
  const hasFuel = ship.fuel > 0;

  if (ship.status === 'alive' && hasFuel && input.thrustForward) {
    ctx.beginPath();
    ctx.moveTo(-4.2, -2.5);
    ctx.lineTo(-14.5 * flicker, 0);
    ctx.lineTo(-4.2, 2.5);
    ctx.closePath();
    ctx.fillStyle = '#ff6a00';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-4.0, -1.3);
    ctx.lineTo(-10.5 * flicker, 0);
    ctx.lineTo(-4.0, 1.3);
    ctx.closePath();
    ctx.fillStyle = '#ffe066';
    ctx.fill();
  }

  if (ship.status === 'alive' && hasFuel && input.thrustBackward) {
    ctx.beginPath();
    ctx.moveTo(9.5, -1.8);
    ctx.lineTo(16.5 * flicker, 0);
    ctx.lineTo(9.5, 1.8);
    ctx.closePath();
    ctx.fillStyle = '#ff6a00';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(9.5, -0.9);
    ctx.lineTo(13.5 * flicker, 0);
    ctx.lineTo(9.5, 0.9);
    ctx.closePath();
    ctx.fillStyle = '#ffe066';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-7, 6.2);
  ctx.lineTo(-3.5, 0);
  ctx.lineTo(-7, -6.2);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.restore();
}

export function renderWorld(ctx, camera, backgroundStars, worldState, input, alpha, nowMs) {
  const { width, height, dpr, scale } = camera;
  const clampedAlpha = Math.max(0, Math.min(1, alpha));

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  drawBackgroundStars(ctx, camera, backgroundStars, nowMs * 0.001);

  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);
  ctx.scale(scale, scale);

  const bh = worldState.blackHole;
  const planetOrbitWidth = 1 / scale;
  const moonOrbitWidth = 0.8 / scale;
  const cometOrbitWidth = 1 / scale;

  // 1. рбиты планет, лун и сферы Хилла планет
  for (const planet of worldState.planets) {
    drawOrbitEllipse(
      ctx,
      planet,
      bh.x,
      bh.y,
      planetOrbitWidth,
      'rgba(220, 225, 235, 0.2)'
    );

    const px = planet.prevX + (planet.x - planet.prevX) * clampedAlpha;
    const py = planet.prevY + (planet.y - planet.prevY) * clampedAlpha;

    drawHillSphere(ctx, px, py, planet.hillRadius, scale);

    for (const moon of planet.moons) {
      drawOrbitEllipse(
        ctx,
        moon,
        px,
        py,
        moonOrbitWidth,
        'rgba(200, 205, 215, 0.16)'
      );
    }
  }

  // 2. рбиты комет (тонкие красные линии)
  for (const comet of worldState.comets) {
    drawOrbitEllipse(
      ctx,
      comet,
      bh.x,
      bh.y,
      cometOrbitWidth,
      'rgba(255, 65, 65, 0.45)'
    );
  }

  // 3. ояса астероидов (точки размером 1-2 пикселя на экране)
  ctx.fillStyle = 'rgba(180, 175, 165, 0.78)';
  for (const belt of worldState.belts) {
    for (const ast of belt.asteroids) {
      const ax = ast.prevX + (ast.x - ast.prevX) * clampedAlpha;
      const ay = ast.prevY + (ast.y - ast.prevY) * clampedAlpha;
      const screenPxSize = ast.size / scale;
      ctx.fillRect(
        ax - screenPxSize * 0.5,
        ay - screenPxSize * 0.5,
        screenPxSize,
        screenPxSize
      );
    }
  }

  // 4. ерная дыра
  drawBlackHole(ctx, bh);

  // 5. ометы
  for (const comet of worldState.comets) {
    const cx = comet.prevX + (comet.x - comet.prevX) * clampedAlpha;
    const cy = comet.prevY + (comet.y - comet.prevY) * clampedAlpha;

    const dist = Math.hypot(cx, cy) || 1;
    const tailLen = comet.radius * 4.5;
    const tx = cx + (cx / dist) * tailLen;
    const ty = cy + (cy / dist) * tailLen;

    const tailGrad = ctx.createLinearGradient(cx, cy, tx, ty);
    tailGrad.addColorStop(0, 'rgba(160, 225, 255, 0.65)');
    tailGrad.addColorStop(1, 'rgba(160, 225, 255, 0)');

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx, ty);
    ctx.lineWidth = comet.radius * 1.1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = tailGrad;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, comet.radius, 0, Math.PI * 2);
    ctx.fillStyle = comet.color;
    ctx.fill();
  }

  // 6. ланеты и их луны
  for (const planet of worldState.planets) {
    const px = planet.prevX + (planet.x - planet.prevX) * clampedAlpha;
    const py = planet.prevY + (planet.y - planet.prevY) * clampedAlpha;

    ctx.beginPath();
    ctx.arc(px, py, planet.radius, 0, Math.PI * 2);
    ctx.fillStyle = planet.color;
    ctx.fill();

    for (const moon of planet.moons) {
      const mx = moon.prevX + (moon.x - moon.prevX) * clampedAlpha;
      const my = moon.prevY + (moon.y - moon.prevY) * clampedAlpha;

      ctx.beginPath();
      ctx.arc(mx, my, moon.radius, 0, Math.PI * 2);
      ctx.fillStyle = moon.color;
      ctx.fill();
    }
  }

  // 7. Трейс-шлейф за кораблем (последние 2 секунды) и траектория предикции
  const { ship } = worldState;
  const shipX = ship.prevX + (ship.x - ship.prevX) * clampedAlpha;
  const shipY = ship.prevY + (ship.y - ship.prevY) * clampedAlpha;
  drawShipTrail(ctx, worldState, shipX, shipY, clampedAlpha, scale);
  drawShipPrediction(ctx, worldState, shipX, shipY, clampedAlpha, scale);

  // 8. астицы взрыва
  if (worldState.particles.length > 0) {
    for (const p of worldState.particles) {
      const px = p.prevX + (p.x - p.prevX) * clampedAlpha;
      const py = p.prevY + (p.y - p.prevY) * clampedAlpha;
      ctx.beginPath();
      ctx.arc(px, py, p.size / Math.max(0.7, scale), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
  }

  // 9. орабль игрока
  drawShip(ctx, ship, shipX, shipY, input, clampedAlpha, scale);

  ctx.restore();

  // 10. HUD: уровень в левом верхнем углу, топливо в левом нижнем, предупреждение о топливе
  drawLevelCounter(ctx, worldState.level);
  drawFuelBar(ctx, camera, ship, clampedAlpha);
  drawOutOfFuelWarning(ctx, camera, ship, nowMs);
}
