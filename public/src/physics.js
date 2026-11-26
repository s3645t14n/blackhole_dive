import { PHYSICS, resetShipToSpawn } from './state.js';

const TWO_PI = Math.PI * 2;

export function solveKepler(M, e) {
  let normM = M % TWO_PI;
  if (normM > Math.PI) normM -= TWO_PI;
  else if (normM < -Math.PI) normM += TWO_PI;

  if (e === 0) return normM;

  let E = normM + e * Math.sin(normM);
  for (let i = 0; i < 5; i++) {
    const f = E - e * Math.sin(E) - normM;
    const fPrime = 1 - e * Math.cos(E);
    E -= f / fPrime;
  }
  return E;
}

export function computeKeplerPosition(body, t, centerX, centerY) {
  const M = body.M0 + body.n * t;
  const E = solveKepler(M, body.e);

  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const xOrb = body.a * (cosE - body.e);
  const yOrb = body.a * Math.sqrt(1 - body.e * body.e) * sinE;

  const cosW = Math.cos(body.omega);
  const sinW = Math.sin(body.omega);

  return {
    x: centerX + xOrb * cosW - yOrb * sinW,
    y: centerY + xOrb * sinW + yOrb * cosW
  };
}

export function computeKeplerVelocity(body, t, centerX, centerY) {
  const eps = 0.002;
  const p1 = computeKeplerPosition(body, t - eps, centerX, centerY);
  const p2 = computeKeplerPosition(body, t, centerX, centerY);
  return {
    vx: (p2.x - p1.x) / eps,
    vy: (p2.y - p1.y) / eps
  };
}

export function placeShipOnOuterPlanetOrbit(worldState) {
  const planets = worldState.planets;
  if (planets.length === 0) return;

  const outerPlanet = planets[planets.length - 1];
  const bh = worldState.blackHole;
  const pVel = computeKeplerVelocity(outerPlanet, worldState.simTime, bh.x, bh.y);

  const minOrbit = outerPlanet.radius * 2.2 + 20;
  const maxOrbit = outerPlanet.hillRadius * 0.72;
  const orbitRadius = Math.max(
    minOrbit,
    Math.min(maxOrbit, outerPlanet.hillRadius * 0.58)
  );

  const muPlanetShip =
    PHYSICS.G * outerPlanet.mass * PHYSICS.PLANET_COMET_SHIP_GRAVITY_MULT;
  const orbitSpeed = Math.sqrt(muPlanetShip / orbitRadius);

  const planetAngle = Math.atan2(outerPlanet.y, outerPlanet.x);
  const theta = planetAngle + Math.PI * 0.5;

  const rx = Math.cos(theta) * orbitRadius;
  const ry = Math.sin(theta) * orbitRadius;
  const tx = -Math.sin(theta);
  const ty = Math.cos(theta);

  const sx = outerPlanet.x + rx;
  const sy = outerPlanet.y + ry;
  const svx = pVel.vx + tx * orbitSpeed;
  const svy = pVel.vy + ty * orbitSpeed;

  worldState.spawnPoint = {
    x: sx,
    y: sy,
    vx: svx,
    vy: svy,
    angle: Math.atan2(svy, svx)
  };

  resetShipToSpawn(worldState);
}

export function updateAllOrbitalBodies(worldState, syncPrev = false) {
  const t = worldState.simTime;
  const bhX = worldState.blackHole.x;
  const bhY = worldState.blackHole.y;

  for (const planet of worldState.planets) {
    planet.prevX = planet.x;
    planet.prevY = planet.y;
    const pPos = computeKeplerPosition(planet, t, bhX, bhY);
    planet.x = pPos.x;
    planet.y = pPos.y;
    if (syncPrev) {
      planet.prevX = planet.x;
      planet.prevY = planet.y;
    }

    for (const moon of planet.moons) {
      moon.prevX = moon.x;
      moon.prevY = moon.y;
      const mPos = computeKeplerPosition(moon, t, planet.x, planet.y);
      moon.x = mPos.x;
      moon.y = mPos.y;
      if (syncPrev) {
        moon.prevX = moon.x;
        moon.prevY = moon.y;
      }
    }
  }

  for (const belt of worldState.belts) {
    for (const ast of belt.asteroids) {
      if (ast.isPerturbed && !syncPrev) {
        ast.prevX = ast.x;
        ast.prevY = ast.y;
        continue;
      }

      ast.prevX = ast.x;
      ast.prevY = ast.y;
      const aPos = computeKeplerPosition(ast, t, bhX, bhY);
      ast.x = aPos.x;
      ast.y = aPos.y;
      if (syncPrev) {
        ast.prevX = ast.x;
        ast.prevY = ast.y;
      }
    }
  }

  for (const comet of worldState.comets) {
    comet.prevX = comet.x;
    comet.prevY = comet.y;
    const cPos = computeKeplerPosition(comet, t, bhX, bhY);
    comet.x = cPos.x;
    comet.y = cPos.y;
    if (syncPrev) {
      comet.prevX = comet.x;
      comet.prevY = comet.y;
    }
  }
}

function buildSnapshotAtTime(worldState, t) {
  const bhX = worldState.blackHole.x;
  const bhY = worldState.blackHole.y;
  const planetsSnap = [];
  const moonsSnap = [];
  const cometsSnap = [];

  for (const planet of worldState.planets) {
    const pPos = computeKeplerPosition(planet, t, bhX, bhY);
    planetsSnap.push({
      x: pPos.x,
      y: pPos.y,
      radius: planet.radius,
      mass: planet.mass,
      hillRadius: planet.hillRadius
    });

    for (const moon of planet.moons) {
      const mPos = computeKeplerPosition(moon, t, pPos.x, pPos.y);
      moonsSnap.push({
        x: mPos.x,
        y: mPos.y,
        radius: moon.radius,
        mass: moon.mass
      });
    }
  }

  for (const comet of worldState.comets) {
    const cPos = computeKeplerPosition(comet, t, bhX, bhY);
    cometsSnap.push({
      x: cPos.x,
      y: cPos.y,
      radius: comet.radius,
      mass: comet.mass,
      hillRadius: comet.hillRadius
    });
  }

  return {
    planets: planetsSnap,
    moons: moonsSnap,
    comets: cometsSnap
  };
}

function extractCurrentBodiesSnapshot(worldState) {
  const planetsSnap = [];
  const moonsSnap = [];
  const cometsSnap = [];

  for (const planet of worldState.planets) {
    planetsSnap.push({
      x: planet.x,
      y: planet.y,
      radius: planet.radius,
      mass: planet.mass,
      hillRadius: planet.hillRadius
    });
    for (const moon of planet.moons) {
      moonsSnap.push({
        x: moon.x,
        y: moon.y,
        radius: moon.radius,
        mass: moon.mass
      });
    }
  }

  for (const comet of worldState.comets) {
    cometsSnap.push({
      x: comet.x,
      y: comet.y,
      radius: comet.radius,
      mass: comet.mass,
      hillRadius: comet.hillRadius
    });
  }

  return {
    planets: planetsSnap,
    moons: moonsSnap,
    comets: cometsSnap
  };
}

function advanceFutureSnapshots(worldState) {
  const totalTicks = PHYSICS.PREDICTION_TICKS;
  const dt = PHYSICS.DT;

  if (worldState.futureSnapshots.length !== totalTicks) {
    const snapshots = new Array(totalTicks);
    for (let k = 0; k < totalTicks; k++) {
      const t = (worldState.tickCount + k + 1) * dt;
      snapshots[k] = buildSnapshotAtTime(worldState, t);
    }
    worldState.futureSnapshots = snapshots;
  } else {
    worldState.futureSnapshots.shift();
    const lastT = (worldState.tickCount + totalTicks) * dt;
    worldState.futureSnapshots.push(buildSnapshotAtTime(worldState, lastT));
  }
}

function computeShipPredictionPoints(worldState, prefixPoints) {
  const snapshots = worldState.futureSnapshots;
  const tickCount = snapshots.length;
  const substeps = PHYSICS.SUBSTEPS;
  const subDt = PHYSICS.DT / substeps;
  const bh = worldState.blackHole;
  const shipRadius = worldState.ship.radius;
  const gravMult = PHYSICS.PLANET_COMET_SHIP_GRAVITY_MULT;

  let x = worldState.ship.x;
  let y = worldState.ship.y;
  let vx = worldState.ship.vx;
  let vy = worldState.ship.vy;

  const hasCurrentTickPrefix = Boolean(prefixPoints && prefixPoints.length > 0);
  const points = hasCurrentTickPrefix ? prefixPoints.slice() : [{ x, y }];
  let impact = false;

  let prevSnap = extractCurrentBodiesSnapshot(worldState);

  for (let k = 0; k < tickCount; k++) {
    const currSnap = snapshots[k];

    for (let s = 0; s < substeps; s++) {
      const tRatio = (s + 1) / substeps;
      let ax = 0;
      let ay = 0;

      const bhDx = bh.x - x;
      const bhDy = bh.y - y;
      const bhDistSq = bhDx * bhDx + bhDy * bhDy;
      const bhDist = Math.sqrt(bhDistSq);

      if (bhDist <= bh.radius + shipRadius * 0.4) {
        impact = true;
        break;
      }

      if (bhDist > 1e-4) {
        const bhAcc = (PHYSICS.G * bh.mass) / bhDistSq;
        ax += (bhDx / bhDist) * bhAcc;
        ay += (bhDy / bhDist) * bhAcc;
      }

      let hitBody = false;
      for (let i = 0; i < currSnap.planets.length; i++) {
        const pPrev = prevSnap.planets[i];
        const pCurr = currSnap.planets[i];
        const px = pPrev.x + (pCurr.x - pPrev.x) * tRatio;
        const py = pPrev.y + (pCurr.y - pPrev.y) * tRatio;
        const dx = px - x;
        const dy = py - y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist <= pCurr.radius + shipRadius * 0.75) {
          hitBody = true;
          break;
        }

        if (dist <= pCurr.hillRadius && dist > 1e-4) {
          const acc = (PHYSICS.G * pCurr.mass * gravMult) / distSq;
          ax += (dx / dist) * acc;
          ay += (dy / dist) * acc;
        }
      }
      if (hitBody) {
        impact = true;
        break;
      }

      for (let i = 0; i < currSnap.moons.length; i++) {
        const mPrev = prevSnap.moons[i];
        const mCurr = currSnap.moons[i];
        const mx = mPrev.x + (mCurr.x - mPrev.x) * tRatio;
        const my = mPrev.y + (mCurr.y - mPrev.y) * tRatio;
        const dx = mx - x;
        const dy = my - y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist <= mCurr.radius + shipRadius * 0.75) {
          hitBody = true;
          break;
        }

        const moonFlyby = Math.max(
          mCurr.radius * PHYSICS.CLOSE_FLYBY_MOON_FACTOR,
          PHYSICS.CLOSE_FLYBY_MOON_MIN
        );
        if (dist <= moonFlyby && dist > 1e-4) {
          const acc = (PHYSICS.G * mCurr.mass) / distSq;
          ax += (dx / dist) * acc;
          ay += (dy / dist) * acc;
        }
      }
      if (hitBody) {
        impact = true;
        break;
      }

      for (let i = 0; i < currSnap.comets.length; i++) {
        const cPrev = prevSnap.comets[i];
        const cCurr = currSnap.comets[i];
        const cx = cPrev.x + (cCurr.x - cPrev.x) * tRatio;
        const cy = cPrev.y + (cCurr.y - cPrev.y) * tRatio;
        const dx = cx - x;
        const dy = cy - y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist <= cCurr.radius + shipRadius * 0.75) {
          hitBody = true;
          break;
        }

        if (dist <= cCurr.hillRadius && dist > 1e-4) {
          const acc = (PHYSICS.G * cCurr.mass * gravMult) / distSq;
          ax += (dx / dist) * acc;
          ay += (dy / dist) * acc;
        }
      }
      if (hitBody) {
        impact = true;
        break;
      }

      vx += ax * subDt;
      vy += ay * subDt;
      x += vx * subDt;
      y += vy * subDt;

      points.push({ x, y });

      if (
        Math.abs(x) > worldState.bounds.halfWidth ||
        Math.abs(y) > worldState.bounds.halfHeight
      ) {
        impact = true;
        break;
      }
    }

    if (impact) break;
    prevSnap = currSnap;
  }

  worldState.prediction = {
    points,
    impact,
    hasCurrentTickPrefix
  };
}

export function rebuildPrediction(worldState) {
  if (worldState.hardMode || worldState.ship.status !== 'alive') {
    worldState.prediction = { points: [], impact: false, hasCurrentTickPrefix: false };
    return;
  }
  worldState.futureSnapshots = [];
  advanceFutureSnapshots(worldState);
  computeShipPredictionPoints(worldState, null);
}

export function resetCurrentLevel(worldState) {
  worldState.tickCount = 0;
  worldState.simTime = 0;
  worldState.lastTickTime = performance.now();
  worldState.cameraNeedsSnap = true;

  for (const belt of worldState.belts) {
    for (const ast of belt.asteroids) {
      ast.isPerturbed = false;
      ast.vx = 0;
      ast.vy = 0;
    }
  }

  updateAllOrbitalBodies(worldState, true);
  placeShipOnOuterPlanetOrbit(worldState);
  rebuildPrediction(worldState);
}

function stepPerturbedAsteroids(worldState, subDt, shipAlive) {
  const bh = worldState.blackHole;
  const ship = worldState.ship;
  const rangeSq = PHYSICS.SHIP_ASTEROID_GRAVITY_RANGE * PHYSICS.SHIP_ASTEROID_GRAVITY_RANGE;
  const minBhDistSq = bh.radius * bh.radius;

  for (const belt of worldState.belts) {
    for (const ast of belt.asteroids) {
      if (!ast.isPerturbed) continue;

      let ax = 0;
      let ay = 0;

      const bhDx = bh.x - ast.x;
      const bhDy = bh.y - ast.y;
      const bhDistSq = bhDx * bhDx + bhDy * bhDy;
      const bhDist = Math.sqrt(bhDistSq);

      if (bhDist > 1e-4) {
        const bhAcc = (PHYSICS.G * bh.mass) / Math.max(bhDistSq, minBhDistSq);
        ax += (bhDx / bhDist) * bhAcc;
        ay += (bhDy / bhDist) * bhAcc;
      }

      if (shipAlive) {
        const sDx = ship.x - ast.x;
        const sDy = ship.y - ast.y;
        const sDistSq = sDx * sDx + sDy * sDy;
        if (sDistSq <= rangeSq && sDistSq > 1e-4) {
          const sDist = Math.sqrt(sDistSq);
          const sAcc = (PHYSICS.G * ship.mass) / Math.max(sDistSq, 400);
          ax += (sDx / sDist) * sAcc;
          ay += (sDy / sDist) * sAcc;
        }
      }

      ast.vx += ax * subDt;
      ast.vy += ay * subDt;
      ast.x += ast.vx * subDt;
      ast.y += ast.vy * subDt;
    }
  }
}

function activateNearbyAsteroids(worldState, tickStartTime) {
  const { ship, blackHole } = worldState;
  const rangeSq = PHYSICS.SHIP_ASTEROID_GRAVITY_RANGE * PHYSICS.SHIP_ASTEROID_GRAVITY_RANGE;

  for (const belt of worldState.belts) {
    for (const ast of belt.asteroids) {
      if (ast.isPerturbed) continue;

      const dx = ship.x - ast.prevX;
      const dy = ship.y - ast.prevY;
      if (dx * dx + dy * dy <= rangeSq) {
        const vel = computeKeplerVelocity(ast, tickStartTime, blackHole.x, blackHole.y);
        ast.isPerturbed = true;
        ast.x = ast.prevX;
        ast.y = ast.prevY;
        ast.vx = vel.vx;
        ast.vy = vel.vy;
      }
    }
  }
}

function triggerExplosion(worldState) {
  const { ship } = worldState;
  ship.status = 'exploding';
  ship.statusTimer = PHYSICS.EXPLOSION_DURATION;
  ship.vx = 0;
  ship.vy = 0;
  ship.trail = [];
  worldState.prediction = { points: [], impact: false, hasCurrentTickPrefix: false };

  const particles = [];
  for (let i = 0; i < 28; i++) {
    const angle = Math.random() * TWO_PI;
    const speed = 35 + Math.random() * 180;
    particles.push({
      x: ship.x,
      y: ship.y,
      prevX: ship.x,
      prevY: ship.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1.5 + Math.random() * 2.5,
      color: Math.random() < 0.4 ? '#ffffff' : (Math.random() < 0.6 ? '#ff9922' : '#ff4411')
    });
  }
  worldState.particles = particles;
}

export function stepSimulation(worldState, input, onLevelComplete) {
  const dt = PHYSICS.DT;
  const { ship, blackHole } = worldState;
  const gravMult = PHYSICS.PLANET_COMET_SHIP_GRAVITY_MULT;
  const tickStartTime = worldState.simTime;

  worldState.lastTickTime = performance.now();
  worldState.tickCount += 1;
  worldState.simTime = worldState.tickCount * dt;
  updateAllOrbitalBodies(worldState, false);

  const substeps = PHYSICS.SUBSTEPS;
  const subDt = dt / substeps;

  if (ship.status === 'exploding') {
    for (let s = 0; s < substeps; s++) {
      stepPerturbedAsteroids(worldState, subDt, false);
    }
    for (const p of worldState.particles) {
      p.prevX = p.x;
      p.prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    ship.statusTimer -= dt;
    if (ship.statusTimer <= 0) {
      resetCurrentLevel(worldState);
    }
    return;
  }

  if (ship.status === 'absorbing') {
    for (let s = 0; s < substeps; s++) {
      stepPerturbedAsteroids(worldState, subDt, false);
    }
    ship.prevX = ship.x;
    ship.prevY = ship.y;
    ship.prevAngle = ship.angle;
    ship.prevAbsorbScale = ship.absorbScale;

    ship.statusTimer -= dt;
    const progress = Math.min(1, 1 - ship.statusTimer / PHYSICS.ABSORB_DURATION);
    ship.x = ship.absorbStartX * (1 - progress);
    ship.y = ship.absorbStartY * (1 - progress);
    ship.absorbScale = Math.max(0, 1 - progress);
    ship.angle += 6 * dt;

    if (ship.statusTimer <= 0) {
      onLevelComplete();
    }
    return;
  }

  ship.prevX = ship.x;
  ship.prevY = ship.y;
  ship.prevAngle = ship.angle;
  ship.prevFuel = ship.fuel;

  const currentTickPoints = [{ x: ship.x, y: ship.y }];

  activateNearbyAsteroids(worldState, tickStartTime);

  for (let s = 0; s < substeps; s++) {
    const tRatio = (s + 1) / substeps;
    const subTime = tickStartTime + (s + 1) * subDt;

    stepPerturbedAsteroids(worldState, subDt, true);

    let angularVel = 0;
    if (input.turnLeft) angularVel -= PHYSICS.SHIP_TURN_SPEED;
    if (input.turnRight) angularVel += PHYSICS.SHIP_TURN_SPEED;
    ship.angle += angularVel * subDt;

    let thrust = 0;
    const engineRequested = input.thrustForward || input.thrustBackward;
    if (engineRequested && ship.fuel > 0) {
      if (input.thrustForward) thrust += PHYSICS.SHIP_THRUST_FORWARD;
      if (input.thrustBackward) thrust -= PHYSICS.SHIP_THRUST_BACKWARD;
      ship.fuel = Math.max(0, ship.fuel - subDt);
    }

    let ax = Math.cos(ship.angle) * thrust;
    let ay = Math.sin(ship.angle) * thrust;

    // 1. равитация черной дыры (действует всегда)
    const bhDx = blackHole.x - ship.x;
    const bhDy = blackHole.y - ship.y;
    const bhDistSq = bhDx * bhDx + bhDy * bhDy;
    const bhDist = Math.sqrt(bhDistSq);

    if (bhDist > 1e-4) {
      const bhAcc = (PHYSICS.G * blackHole.mass) / bhDistSq;
      ax += (bhDx / bhDist) * bhAcc;
      ay += (bhDy / bhDist) * bhAcc;
    }

    if (bhDist <= blackHole.radius + ship.radius * 0.4) {
      ship.status = 'absorbing';
      ship.statusTimer = PHYSICS.ABSORB_DURATION;
      ship.absorbStartX = ship.x;
      ship.absorbStartY = ship.y;
      ship.absorbScale = 1;
      ship.prevAbsorbScale = 1;
      worldState.prediction = { points: [], impact: false, hasCurrentTickPrefix: false };
      return;
    }

    let collided = false;

    // 2. ланеты (внутри сферы Хилла) и луны (при близком пролете)
    for (const planet of worldState.planets) {
      const px = planet.prevX + (planet.x - planet.prevX) * tRatio;
      const py = planet.prevY + (planet.y - planet.prevY) * tRatio;
      const dx = px - ship.x;
      const dy = py - ship.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      if (dist <= planet.radius + ship.radius * 0.75) {
        collided = true;
        break;
      }

      if (dist <= planet.hillRadius && dist > 1e-4) {
        const acc = (PHYSICS.G * planet.mass * gravMult) / distSq;
        ax += (dx / dist) * acc;
        ay += (dy / dist) * acc;
      }

      for (const moon of planet.moons) {
        const mx = moon.prevX + (moon.x - moon.prevX) * tRatio;
        const my = moon.prevY + (moon.y - moon.prevY) * tRatio;
        const mdx = mx - ship.x;
        const mdy = my - ship.y;
        const mDistSq = mdx * mdx + mdy * mdy;
        const mDist = Math.sqrt(mDistSq);

        if (mDist <= moon.radius + ship.radius * 0.75) {
          collided = true;
          break;
        }

        const moonFlyby = Math.max(
          moon.radius * PHYSICS.CLOSE_FLYBY_MOON_FACTOR,
          PHYSICS.CLOSE_FLYBY_MOON_MIN
        );
        if (mDist <= moonFlyby && mDist > 1e-4) {
          const acc = (PHYSICS.G * moon.mass) / mDistSq;
          ax += (mdx / mDist) * acc;
          ay += (mdy / mDist) * acc;
        }
      }

      if (collided) break;
    }

    if (collided) {
      triggerExplosion(worldState);
      return;
    }

    // 3. ометы (внутри сферы Хилла)
    for (const comet of worldState.comets) {
      const cx = comet.prevX + (comet.x - comet.prevX) * tRatio;
      const cy = comet.prevY + (comet.y - comet.prevY) * tRatio;
      const dx = cx - ship.x;
      const dy = cy - ship.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      if (dist <= comet.radius + ship.radius * 0.75) {
        collided = true;
        break;
      }

      if (dist <= comet.hillRadius && dist > 1e-4) {
        const acc = (PHYSICS.G * comet.mass * gravMult) / distSq;
        ax += (dx / dist) * acc;
        ay += (dy / dist) * acc;
      }
    }

    if (collided) {
      triggerExplosion(worldState);
      return;
    }

    // 4. стероиды: слабое притяжение при близком пролете (без разрушения корабля)
    for (const belt of worldState.belts) {
      for (const ast of belt.asteroids) {
        const axPos = ast.isPerturbed
          ? ast.x
          : ast.prevX + (ast.x - ast.prevX) * tRatio;
        const ayPos = ast.isPerturbed
          ? ast.y
          : ast.prevY + (ast.y - ast.prevY) * tRatio;
        const dx = axPos - ship.x;
        const dy = ayPos - ship.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > PHYSICS.CLOSE_FLYBY_ASTEROID * PHYSICS.CLOSE_FLYBY_ASTEROID) {
          continue;
        }

        const dist = Math.sqrt(distSq);
        if (dist > 1e-4) {
          const acc = (PHYSICS.G * ast.mass) / Math.max(distSq, 16);
          ax += (dx / dist) * acc;
          ay += (dy / dist) * acc;
        }
      }
    }

    ship.vx += ax * subDt;
    ship.vy += ay * subDt;
    ship.x += ship.vx * subDt;
    ship.y += ship.vy * subDt;

    currentTickPoints.push({ x: ship.x, y: ship.y });

    ship.trail.push({ x: ship.x, y: ship.y, t: subTime });
    const minTrailTime = subTime - PHYSICS.SHIP_TRAIL_DURATION - PHYSICS.DT;
    while (ship.trail.length > 0 && ship.trail[0].t < minTrailTime) {
      ship.trail.shift();
    }

    if (
      Math.abs(ship.x) > worldState.bounds.halfWidth ||
      Math.abs(ship.y) > worldState.bounds.halfHeight
    ) {
      triggerExplosion(worldState);
      return;
    }
  }

  if (!worldState.hardMode) {
    advanceFutureSnapshots(worldState);
    computeShipPredictionPoints(worldState, currentTickPoints);
  }
}
