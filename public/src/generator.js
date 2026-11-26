import { PHYSICS } from './state.js';
import {
  updateAllOrbitalBodies,
  rebuildPrediction,
  placeShipOnOuterPlanetOrbit
} from './physics.js';

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

function randomPlanetColor() {
  const hue = randInt(0, 359);
  const sat = randInt(55, 85);
  const light = randInt(48, 68);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function randomMoonColor() {
  const light = randInt(58, 78);
  const hue = randInt(20, 220);
  const sat = randInt(8, 25);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

export function generateSystem(worldState) {
  worldState.tickCount = 0;
  worldState.simTime = 0;
  worldState.lastTickTime = performance.now();
  worldState.futureSnapshots = [];
  worldState.prediction = { points: [], impact: false, hasCurrentTickPrefix: false };

  const bhRadius = randRange(30, 40);
  worldState.blackHole = {
    x: 0,
    y: 0,
    radius: bhRadius,
    mass: PHYSICS.BLACK_HOLE_MASS
  };

  const muBH = PHYSICS.G * worldState.blackHole.mass;

  const planetCount = Math.max(1, worldState.level);
  const beltCount = randInt(1, 3);
  const cometCount = randInt(0, 5);

  const slotBeltCounts = new Array(planetCount + 1).fill(0);
  for (let b = 0; b < beltCount; b++) {
    const slot = b <= planetCount ? randInt(0, planetCount) : planetCount;
    slotBeltCounts[slot]++;
  }

  const planets = [];
  const belts = [];

  const spacingScale =
    planetCount === 1
      ? 3.4
      : planetCount <= 5
        ? 2.2
        : planetCount <= 9
          ? 1.4
          : planetCount <= 15
            ? 1.0
            : Math.max(0.45, 12 / planetCount);

  const planetSizeScale =
    planetCount === 1
      ? 1.1
      : planetCount <= 6
        ? 1.0
        : planetCount <= 10
          ? 0.82
          : planetCount <= 15
            ? 0.68
            : Math.max(0.42, 9 / planetCount);

  let prevMax = planetCount === 1 ? bhRadius + 210 : bhRadius + 150;

  for (let b = 0; b < slotBeltCounts[0]; b++) {
    const beltWidth = randRange(50, 90);
    const beltCenter = prevMax + 45 + beltWidth * 0.5;
    belts.push(createAsteroidBelt(beltCenter, beltWidth, muBH));
    prevMax = beltCenter + beltWidth * 0.5 + 35;
  }

  for (let i = 0; i < planetCount; i++) {
    const radius = randRange(22, 44) * planetSizeScale;
    const mass = radius * PHYSICS.PLANET_MASS_PER_RADIUS;
    const muPlanet = PHYSICS.G * mass;

    const orbitGap = randRange(55, 95) * spacingScale + radius * 1.5;
    const rMin = prevMax + orbitGap;
    const e = Math.random() < 0.35 ? 0 : randRange(0.01, 0.065);
    const a = rMin / (1 - e);
    const rMax = a * (1 + e);

    const hillRadius = a * (1 - e) * Math.cbrt(mass / (3 * worldState.blackHole.mass));

    //  самой дальней планеты (i === planetCount - 1) луны не создаются
    const moonCount = i === planetCount - 1 ? 0 : randInt(0, 3);
    const moons = [];
    const minMoonOrbit = radius + 16;
    const maxMoonOrbit = Math.max(minMoonOrbit + 24, hillRadius * 0.94);
    const span = maxMoonOrbit - minMoonOrbit;

    for (let m = 0; m < moonCount; m++) {
      const maxMoonRadius = Math.max(3.0, radius * 0.32);
      const moonRadius = randRange(2.5, Math.min(9.5, maxMoonRadius));

      const slotStart = minMoonOrbit + (m / moonCount) * span;
      const slotEnd = minMoonOrbit + ((m + 1) / moonCount) * span;
      const slotSize = slotEnd - slotStart;

      const safeStart = Math.max(
        minMoonOrbit + moonRadius + 4,
        slotStart + slotSize * 0.14
      );
      const safeEnd = Math.max(
        safeStart + 2,
        slotEnd - slotSize * 0.12 - moonRadius
      );

      const moonE = Math.random() < 0.4 ? 0 : randRange(0.01, 0.05);
      let moonA = randRange(safeStart, safeEnd);

      const minAllowedA = (radius + moonRadius + 6) / (1 - moonE);
      const maxAllowedA = (hillRadius * 0.97) / (1 + moonE);
      if (maxAllowedA > minAllowedA) {
        moonA = Math.max(minAllowedA, Math.min(maxAllowedA, moonA));
      } else {
        moonA = minAllowedA;
      }

      moons.push({
        radius: moonRadius,
        mass: moonRadius * PHYSICS.MOON_MASS_PER_RADIUS,
        color: randomMoonColor(),
        a: moonA,
        e: moonE,
        omega: randRange(0, Math.PI * 2),
        M0: randRange(0, Math.PI * 2),
        n: Math.sqrt(muPlanet / (moonA * moonA * moonA)),
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0
      });
    }

    planets.push({
      radius,
      mass,
      color: randomPlanetColor(),
      a,
      e,
      omega: randRange(0, Math.PI * 2),
      M0: randRange(0, Math.PI * 2),
      n: Math.sqrt(muBH / (a * a * a)),
      hillRadius,
      moons,
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0
    });

    prevMax = rMax + radius * 1.5 + 24;

    for (let b = 0; b < slotBeltCounts[i + 1]; b++) {
      const beltWidth = randRange(55, 95);
      const beltCenter = prevMax + 45 + beltWidth * 0.5;
      belts.push(createAsteroidBelt(beltCenter, beltWidth, muBH));
      prevMax = beltCenter + beltWidth * 0.5 + 35;
    }
  }

  let outerOrbitRadius = prevMax - 24;
  let maxPlanetHill = 0;
  let maxPlanetMass = 0;

  for (const p of planets) {
    const pMax = p.a * (1 + p.e);
    if (pMax > outerOrbitRadius) outerOrbitRadius = pMax;
    if (p.hillRadius > maxPlanetHill) maxPlanetHill = p.hillRadius;
    if (p.mass > maxPlanetMass) maxPlanetMass = p.mass;
  }

  for (const b of belts) {
    if (b.outerRadius > outerOrbitRadius) outerOrbitRadius = b.outerRadius;
  }

  const cometHillRadius = maxPlanetHill * 1.5;
  const cometMass = maxPlanetMass * 0.85;

  const comets = [];
  for (let c = 0; c < cometCount; c++) {
    const rApo = randRange(outerOrbitRadius * 0.8, outerOrbitRadius * 1.0);
    const maxPeri = Math.min(rApo * 0.28, outerOrbitRadius * 0.25);
    const minPeri = bhRadius + 55;
    const rPeri = randRange(Math.min(minPeri, maxPeri * 0.8), Math.max(minPeri + 10, maxPeri));

    const e = Math.max(0.55, (rApo - rPeri) / (rApo + rPeri));
    const adjustedA = rApo / (1 + e);

    comets.push({
      radius: randRange(13, 22),
      mass: cometMass,
      hillRadius: cometHillRadius,
      color: '#bfe8ff',
      a: adjustedA,
      e,
      omega: randRange(0, Math.PI * 2),
      M0: randRange(0, Math.PI * 2),
      n: Math.sqrt(muBH / (adjustedA * adjustedA * adjustedA)),
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0
    });

    if (rApo > outerOrbitRadius) {
      outerOrbitRadius = rApo;
    }
  }

  worldState.planets = planets;
  worldState.belts = belts;
  worldState.comets = comets;

  updateAllOrbitalBodies(worldState, true);
  placeShipOnOuterPlanetOrbit(worldState);

  const outerPlanet = planets[planets.length - 1];
  const shipMaxExtent = outerPlanet
    ? outerPlanet.a * (1 + outerPlanet.e) + outerPlanet.hillRadius * 0.72
    : outerOrbitRadius;

  worldState.systemRadius = Math.max(outerOrbitRadius, shipMaxExtent);
  rebuildPrediction(worldState);
}

function createAsteroidBelt(centerRadius, width, muBH) {
  const count = randInt(200, 500);
  const asteroids = [];
  let maxApo = centerRadius;

  for (let i = 0; i < count; i++) {
    const a = centerRadius + randRange(-width * 0.5, width * 0.5);
    const e = randRange(0, 0.12);
    const apo = a * (1 + e);
    if (apo > maxApo) maxApo = apo;

    const speedFactor = randRange(0.55, 1.65);

    asteroids.push({
      a,
      e,
      omega: randRange(0, Math.PI * 2),
      M0: randRange(0, Math.PI * 2),
      n: Math.sqrt(muBH / (a * a * a)) * speedFactor,
      size: randRange(1, 2),
      radius: 1.8,
      mass: PHYSICS.ASTEROID_MASS,
      isPerturbed: false,
      vx: 0,
      vy: 0,
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0
    });
  }

  return {
    centerRadius,
    width,
    outerRadius: maxApo,
    asteroids
  };
}
