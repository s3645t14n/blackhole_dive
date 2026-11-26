export const PHYSICS = {
  DT: 0.1,
  SUBSTEPS: 8,
  G: 300,
  BLACK_HOLE_MASS: 60000,
  PLANET_MASS_PER_RADIUS: 420,
  MOON_MASS_PER_RADIUS: 18,
  PLANET_COMET_SHIP_GRAVITY_MULT: 6,
  ASTEROID_MASS: 0.8,
  SHIP_MASS: 5000,
  SHIP_ASTEROID_GRAVITY_RANGE: 200,
  SHIP_RADIUS: 7,
  SHIP_MAX_FUEL: 5.0,
  SHIP_THRUST_FORWARD: 130,
  SHIP_THRUST_BACKWARD: 82.5,
  SHIP_TURN_SPEED: 3.4,
  SHIP_TRAIL_DURATION: 2.0,
  CLOSE_FLYBY_MOON_FACTOR: 5,
  CLOSE_FLYBY_MOON_MIN: 45,
  CLOSE_FLYBY_ASTEROID: 20,
  EXPLOSION_DURATION: 0.8,
  ABSORB_DURATION: 0.4,
  PREDICTION_TICKS: 100
};

export const worldState = {
  level: 1,
  hardMode: false,
  zoomMode: false,
  tickCount: 0,
  simTime: 0,
  lastTickTime: performance.now(),
  systemRadius: 1200,
  cameraNeedsSnap: true,
  bounds: {
    halfWidth: 1260,
    halfHeight: 1260
  },
  spawnPoint: { x: 1230, y: 0, angle: Math.PI },
  blackHole: {
    x: 0,
    y: 0,
    radius: 35,
    mass: PHYSICS.BLACK_HOLE_MASS
  },
  planets: [],
  belts: [],
  comets: [],
  futureSnapshots: [],
  prediction: {
    points: [],
    impact: false,
    hasCurrentTickPrefix: false
  },
  ship: {
    x: 1230,
    y: 0,
    prevX: 1230,
    prevY: 0,
    vx: 0,
    vy: 0,
    angle: Math.PI,
    prevAngle: Math.PI,
    radius: PHYSICS.SHIP_RADIUS,
    mass: PHYSICS.SHIP_MASS,
    fuel: PHYSICS.SHIP_MAX_FUEL,
    prevFuel: PHYSICS.SHIP_MAX_FUEL,
    maxFuel: PHYSICS.SHIP_MAX_FUEL,
    trail: [],
    status: 'alive', // 'alive' | 'exploding' | 'absorbing'
    statusTimer: 0,
    absorbStartX: 0,
    absorbStartY: 0,
    absorbScale: 1,
    prevAbsorbScale: 1
  },
  particles: []
};

export function resetShipToSpawn(state) {
  const { spawnPoint, ship } = state;
  ship.x = spawnPoint.x;
  ship.y = spawnPoint.y;
  ship.prevX = spawnPoint.x;
  ship.prevY = spawnPoint.y;
  ship.vx = spawnPoint.vx || 0;
  ship.vy = spawnPoint.vy || 0;
  ship.angle = spawnPoint.angle;
  ship.prevAngle = spawnPoint.angle;
  ship.fuel = ship.maxFuel;
  ship.prevFuel = ship.maxFuel;
  ship.trail = [{ x: spawnPoint.x, y: spawnPoint.y, t: state.simTime }];
  ship.status = 'alive';
  ship.statusTimer = 0;
  ship.absorbScale = 1;
  ship.prevAbsorbScale = 1;
  state.particles = [];

  for (const belt of state.belts) {
    for (const ast of belt.asteroids) {
      ast.isPerturbed = false;
      ast.vx = 0;
      ast.vy = 0;
    }
  }
}
