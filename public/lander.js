"use strict";

/* Lunar Lander — an easter egg at bordm.com/#lunarlander.
 * A vector-graphics tribute to the 1979 Atari arcade game. The lander is a
 * Starship-style rocket whose single engine gimbals at the base: linear
 * thrust acts along the gimbaled axis and the off-axis component produces
 * real torque about the center of mass (tau = -L * T * sin(gimbal)).
 * Physics constants informed by ehmorris/lunar-lander, tblazevic/moonlander,
 * Dan-Q/lunar-lander and 190n/lunar-lander. */

(function () {
  const HASH = "#lunarlander";

  /* ---------- physics constants (px, s, rad) ---------- */
  const G = 50;                 // gravity, px/s^2  (~1.62 m/s^2 at 31 px/m)
  const THRUST = 150;           // max thrust accel at dry mass, px/s^2
  const THROTTLE_RATE = 1.5;    // throttle ramp per second (analog feel)
  const GIMBAL_MAX = (15 * Math.PI) / 180;
  const GIMBAL_RATE = (120 * Math.PI) / 180; // slew, rad/s
  const TORQUE_K = 0.0773;      // leverArm/inertia; alpha = -K*T*sin(gimbal), max ~3 rad/s^2
  const ANG_DAMP = 0.6;         // artificial damping so it isn't a gyroscope
  const FUEL_MAX = 1000;
  const FUEL_BURN = 14;         // per second at full throttle
  const FUEL_MASS = 0.5;        // full tank adds 50% of dry mass
  const SAFE_SPEED = 70;        // total px/s
  const SAFE_TILT = (10 * Math.PI) / 180;
  const PERFECT_SPEED = 35;
  const PERFECT_TILT = (3 * Math.PI) / 180;

  /* ---------- lander geometry (local px; origin = COM, +y down) ----------
   * The craft IS the CodeRocket wordmark, nose up: outline paths extracted
   * from the brand PDF (bezier-flattened), rotated 90 degrees. The trailing
   * exhaust bars articulate at the engine pivot with the gimbal. */
  const BASE_Y = 65.8;        // engine pivot: tail of the T
  const HALF_W = 7.7;
  const NOSE = [0, -70.0];
  const FEET = [[-HALF_W, BASE_Y], [HALF_W, BASE_Y]];
  const HULL = [[[5.8,-63.6],[6.19,-63.11],[6.53,-62.59],[6.84,-62.03],[7.09,-61.45],[7.29,-60.84],[7.44,-60.21],[7.54,-59.56],[7.57,-58.9],[7.47,-57.65],[7.18,-56.48],[6.71,-55.41],[6.07,-54.44],[5.28,-53.59],[4.33,-52.88],[3.25,-52.31],[2.04,-51.91],[2.04,-54.05],[2.83,-54.4],[3.52,-54.83],[4.1,-55.35],[4.58,-55.95],[4.95,-56.6],[5.21,-57.32],[5.37,-58.09],[5.42,-58.9],[5.41,-59.25],[5.38,-59.59],[5.32,-59.92],[5.24,-60.25],[5.13,-60.57],[5.01,-60.88],[4.87,-61.19],[4.7,-61.48],[4.43,-61.83],[3.87,-62.5],[3.11,-63.39],[2.26,-64.37],[1.42,-65.33],[0.7,-66.15],[0.19,-66.73],[-0.0,-66.95],[-0.19,-66.73],[-0.71,-66.15],[-1.44,-65.33],[-2.28,-64.37],[-3.14,-63.39],[-3.9,-62.5],[-4.47,-61.83],[-4.75,-61.48],[-4.91,-61.19],[-5.05,-60.88],[-5.17,-60.57],[-5.28,-60.25],[-5.36,-59.92],[-5.42,-59.59],[-5.45,-59.25],[-5.46,-58.9],[-5.4,-58.06],[-5.22,-57.27],[-4.93,-56.53],[-4.53,-55.85],[-4.02,-55.24],[-3.4,-54.71],[-2.69,-54.27],[-1.88,-53.93],[-1.88,-51.8],[-3.11,-52.21],[-4.22,-52.78],[-5.19,-53.5],[-6.03,-54.36],[-6.7,-55.34],[-7.19,-56.44],[-7.5,-57.63],[-7.61,-58.9],[-7.58,-59.56],[-7.49,-60.21],[-7.34,-60.84],[-7.14,-61.45],[-6.89,-62.03],[-6.59,-62.58],[-6.24,-63.11],[-5.85,-63.6],[-5.57,-63.9],[-4.9,-64.63],[-3.96,-65.66],[-2.9,-66.83],[-1.83,-68.0],[-0.9,-69.01],[-0.25,-69.73],[-0.0,-70.0],[0.25,-69.73],[0.9,-69.01],[1.82,-68.0],[2.87,-66.83],[3.93,-65.66],[4.86,-64.63],[5.53,-63.9],[5.8,-63.6]],[[3.88,-39.8],[4.24,-40.19],[4.56,-40.62],[4.84,-41.08],[5.07,-41.56],[5.26,-42.07],[5.4,-42.59],[5.48,-43.13],[5.51,-43.68],[5.48,-44.23],[5.4,-44.76],[5.26,-45.28],[5.07,-45.78],[4.84,-46.26],[4.56,-46.71],[4.24,-47.13],[3.88,-47.52],[3.49,-47.87],[3.07,-48.18],[2.62,-48.46],[2.14,-48.69],[1.64,-48.88],[1.11,-49.01],[0.56,-49.1],[0.0,-49.13],[-0.56,-49.1],[-1.11,-49.01],[-1.64,-48.88],[-2.14,-48.69],[-2.62,-48.46],[-3.07,-48.18],[-3.49,-47.87],[-3.88,-47.52],[-4.24,-47.13],[-4.56,-46.71],[-4.84,-46.26],[-5.07,-45.78],[-5.26,-45.28],[-5.4,-44.76],[-5.48,-44.23],[-5.51,-43.68],[-5.48,-43.13],[-5.4,-42.59],[-5.26,-42.07],[-5.07,-41.56],[-4.84,-41.08],[-4.56,-40.62],[-4.24,-40.19],[-3.88,-39.8],[-3.49,-39.45],[-3.07,-39.14],[-2.63,-38.87],[-2.15,-38.64],[-1.65,-38.46],[-1.12,-38.33],[-0.57,-38.24],[0.0,-38.21],[0.57,-38.24],[1.12,-38.33],[1.65,-38.46],[2.15,-38.64],[2.63,-38.87],[3.08,-39.14],[3.49,-39.45],[3.88,-39.8]],[[5.42,-49.08],[5.92,-48.54],[6.37,-47.95],[6.76,-47.32],[7.08,-46.65],[7.34,-45.95],[7.54,-45.22],[7.66,-44.46],[7.7,-43.68],[7.66,-42.89],[7.54,-42.13],[7.34,-41.4],[7.08,-40.69],[6.76,-40.03],[6.37,-39.39],[5.92,-38.8],[5.42,-38.26],[4.88,-37.77],[4.29,-37.34],[3.66,-36.96],[2.99,-36.63],[2.28,-36.38],[1.55,-36.18],[0.79,-36.07],[0.0,-36.03],[-0.79,-36.07],[-1.55,-36.18],[-2.28,-36.38],[-2.98,-36.63],[-3.65,-36.96],[-4.29,-37.34],[-4.88,-37.77],[-5.42,-38.26],[-5.93,-38.8],[-6.37,-39.39],[-6.76,-40.03],[-7.09,-40.69],[-7.35,-41.4],[-7.54,-42.13],[-7.66,-42.89],[-7.7,-43.68],[-7.66,-44.46],[-7.54,-45.22],[-7.35,-45.95],[-7.09,-46.65],[-6.76,-47.32],[-6.37,-47.95],[-5.93,-48.54],[-5.42,-49.08],[-4.88,-49.57],[-4.29,-50.0],[-3.65,-50.38],[-2.98,-50.7],[-2.28,-50.96],[-1.55,-51.15],[-0.79,-51.27],[0.0,-51.31],[0.79,-51.27],[1.55,-51.15],[2.28,-50.96],[2.99,-50.7],[3.66,-50.38],[4.29,-50.0],[4.88,-49.57],[5.42,-49.08]],[[-5.34,-29.22],[-5.22,-27.99],[-4.88,-26.93],[-4.36,-26.03],[-3.68,-25.3],[-2.87,-24.72],[-1.97,-24.31],[-1.01,-24.07],[-0.02,-23.98],[0.97,-24.07],[1.93,-24.31],[2.84,-24.72],[3.64,-25.3],[4.33,-26.03],[4.86,-26.93],[5.2,-27.99],[5.32,-29.22],[5.32,-32.43],[-5.34,-32.43],[-5.34,-29.22]],[[7.48,-29.22],[7.31,-27.49],[6.84,-25.99],[6.1,-24.72],[5.14,-23.69],[4.0,-22.88],[2.73,-22.3],[1.38,-21.96],[-0.02,-21.84],[-1.42,-21.96],[-2.77,-22.3],[-4.04,-22.88],[-5.17,-23.69],[-6.12,-24.72],[-6.86,-25.99],[-7.33,-27.49],[-7.5,-29.22],[-7.5,-34.6],[7.48,-34.6],[7.48,-29.22]],[[-5.34,-18.32],[-5.34,-11.35],[-7.5,-11.35],[-7.5,-20.5],[7.48,-20.5],[7.48,-11.37],[5.32,-11.37],[5.32,-18.32],[1.09,-18.32],[1.09,-11.52],[-1.09,-11.52],[-1.09,-18.32],[-5.34,-18.32]],[[0.11,-6.97],[0.11,-4.44],[0.17,-3.8],[0.33,-3.25],[0.59,-2.78],[0.93,-2.4],[1.32,-2.1],[1.76,-1.89],[2.24,-1.76],[2.72,-1.72],[3.2,-1.76],[3.67,-1.89],[4.11,-2.1],[4.5,-2.4],[4.84,-2.78],[5.09,-3.25],[5.26,-3.8],[5.32,-4.44],[5.32,-7.76],[-7.5,-7.76],[-7.5,-9.91],[7.5,-9.91],[7.5,-4.44],[7.4,-3.29],[7.09,-2.3],[6.62,-1.46],[6.01,-0.77],[5.28,-0.24],[4.47,0.14],[3.61,0.37],[2.72,0.45],[1.94,0.39],[1.17,0.2],[0.46,-0.1],[-0.2,-0.53],[-0.77,-1.07],[-1.26,-1.74],[-1.62,-2.53],[-1.86,-3.43],[-7.5,1.31],[-7.5,-1.5],[-0.92,-6.97],[0.11,-6.97]],[[3.88,12.42],[4.24,12.02],[4.56,11.6],[4.84,11.14],[5.07,10.65],[5.26,10.15],[5.4,9.63],[5.48,9.09],[5.51,8.54],[5.48,7.99],[5.4,7.45],[5.26,6.93],[5.07,6.44],[4.84,5.96],[4.56,5.51],[4.24,5.09],[3.88,4.7],[3.49,4.35],[3.07,4.03],[2.62,3.76],[2.14,3.53],[1.64,3.34],[1.11,3.21],[0.56,3.12],[0.0,3.09],[-0.56,3.12],[-1.11,3.21],[-1.64,3.34],[-2.14,3.53],[-2.62,3.76],[-3.07,4.03],[-3.49,4.35],[-3.88,4.7],[-4.24,5.09],[-4.56,5.51],[-4.84,5.96],[-5.07,6.44],[-5.26,6.93],[-5.4,7.45],[-5.48,7.99],[-5.51,8.54],[-5.48,9.09],[-5.4,9.63],[-5.26,10.15],[-5.07,10.65],[-4.84,11.14],[-4.56,11.6],[-4.24,12.02],[-3.88,12.42],[-3.49,12.76],[-3.07,13.07],[-2.63,13.34],[-2.15,13.57],[-1.65,13.76],[-1.12,13.89],[-0.57,13.98],[0.0,14.0],[0.57,13.98],[1.12,13.89],[1.65,13.76],[2.15,13.57],[2.63,13.34],[3.08,13.07],[3.49,12.76],[3.88,12.42]],[[5.42,3.14],[5.92,3.68],[6.37,4.26],[6.76,4.89],[7.08,5.56],[7.34,6.27],[7.54,7.0],[7.66,7.76],[7.7,8.54],[7.66,9.32],[7.54,10.08],[7.34,10.82],[7.08,11.52],[6.76,12.19],[6.37,12.83],[5.92,13.42],[5.42,13.96],[4.88,14.45],[4.29,14.88],[3.66,15.26],[2.99,15.58],[2.28,15.84],[1.55,16.03],[0.79,16.15],[0.0,16.19],[-0.79,16.15],[-1.55,16.03],[-2.28,15.84],[-2.98,15.58],[-3.65,15.26],[-4.29,14.88],[-4.88,14.45],[-5.42,13.96],[-5.93,13.42],[-6.37,12.83],[-6.76,12.19],[-7.09,11.52],[-7.35,10.82],[-7.54,10.08],[-7.66,9.32],[-7.7,8.54],[-7.66,7.76],[-7.54,7.0],[-7.35,6.27],[-7.09,5.56],[-6.76,4.89],[-6.37,4.26],[-5.93,3.68],[-5.42,3.14],[-4.88,2.65],[-4.29,2.22],[-3.65,1.84],[-2.98,1.51],[-2.28,1.26],[-1.55,1.07],[-0.79,0.95],[0.0,0.91],[0.79,0.95],[1.55,1.07],[2.28,1.26],[2.99,1.51],[3.66,1.84],[4.29,2.22],[4.88,2.65],[5.42,3.14]],[[5.34,19.09],[5.82,19.61],[6.26,20.17],[6.64,20.77],[6.96,21.42],[7.22,22.09],[7.41,22.8],[7.53,23.53],[7.57,24.28],[7.47,25.53],[7.18,26.7],[6.71,27.78],[6.07,28.74],[5.28,29.59],[4.33,30.3],[3.25,30.87],[2.04,31.27],[2.04,29.13],[2.83,28.78],[3.52,28.35],[4.1,27.83],[4.58,27.24],[4.95,26.58],[5.21,25.86],[5.37,25.09],[5.42,24.28],[5.4,23.75],[5.31,23.23],[5.18,22.73],[4.99,22.25],[4.76,21.8],[4.48,21.37],[4.17,20.97],[3.82,20.6],[3.43,20.26],[3.01,19.96],[2.57,19.69],[2.1,19.47],[1.6,19.29],[1.07,19.16],[0.53,19.08],[-0.04,19.05],[-0.6,19.08],[-1.13,19.16],[-1.65,19.29],[-2.14,19.47],[-2.61,19.69],[-3.06,19.96],[-3.47,20.26],[-3.86,20.6],[-4.21,20.97],[-4.53,21.37],[-4.8,21.8],[-5.03,22.25],[-5.22,22.73],[-5.35,23.23],[-5.44,23.75],[-5.46,24.28],[-5.4,25.12],[-5.22,25.91],[-4.93,26.65],[-4.53,27.33],[-4.02,27.94],[-3.4,28.47],[-2.69,28.91],[-1.89,29.26],[-1.89,31.38],[-3.11,30.97],[-4.22,30.4],[-5.19,29.68],[-6.03,28.82],[-6.7,27.84],[-7.19,26.74],[-7.5,25.56],[-7.61,24.28],[-7.57,23.53],[-7.45,22.8],[-7.27,22.09],[-7.01,21.42],[-6.69,20.77],[-6.31,20.17],[-5.87,19.61],[-5.38,19.09],[-4.84,18.63],[-4.26,18.22],[-3.64,17.85],[-2.98,17.54],[-2.28,17.29],[-1.56,17.11],[-0.81,16.99],[-0.04,16.95],[0.74,16.99],[1.5,17.11],[2.23,17.29],[2.93,17.54],[3.59,17.85],[4.22,18.22],[4.8,18.63],[5.34,19.09]],[[0.54,35.17],[7.48,40.4],[7.48,43.13],[0.04,37.4],[-7.5,43.72],[-7.5,40.9],[-0.56,35.17],[0.54,35.17]],[[-7.5,34.76],[-7.5,32.62],[7.48,32.62],[7.48,34.76],[-7.5,34.76]],[[-5.34,46.18],[-5.35,56.92],[-7.51,56.92],[-7.5,43.99],[7.48,43.99],[7.47,52.35],[5.31,52.35],[5.32,46.18],[1.09,46.18],[1.08,56.83],[-1.1,56.83],[-1.09,46.18],[-5.34,46.18]],[[-7.52,58.01],[5.32,58.02],[5.32,53.47],[7.5,53.47],[7.5,64.71],[6.4,65.8],[5.32,64.71],[5.32,60.19],[-7.52,60.17],[-7.52,58.01]]];
  const EXHAUST = [[[-5.36,-4.51],[-7.5,-4.51],[-7.5,-1.09],[-6.43,0.0],[-5.36,-1.09],[-5.36,-4.51]],[[1.07,-4.51],[-1.11,-4.51],[-1.11,3.1],[-0.02,4.2],[1.07,3.1],[1.07,-4.51]]]; // relative to the pivot (0, BASE_Y)
  let craft = 1;      // shrink factor for narrow (portrait phone) screens

  const WHITE = "#f2f2f2";
  const RED = "#ff4040";        // CodeRocket red, brightened for the dark bg
  const DIM = "#7a7a7a";

  let canvas, ctx, ui, raf = 0, last = 0, active = false;
  let W = 0, H = 0;

  const keys = {};
  const touch = { up: false, down: false, left: false, right: false, abort: false, nub: null };

  const game = {
    state: "flying", // flying | landed | crashed
    x: 0, y: 0, vx: 0, vy: 0,
    angle: 0, omega: 0,
    throttle: 0, gimbal: 0,
    fuel: FUEL_MAX,
    score: 0, attempt: 0,
    message: "", grade: "",
    terrain: [], pads: [],
    particles: [],
    stars: [],
    zoom: 1,
    time: 0,
  };

  /* ---------- terrain: midpoint displacement + carved pads ---------- */

  function generateTerrain() {
    const n = 128;
    const pts = new Array(n + 1).fill(0);
    const avg = H * 0.8;
    let disp = H * 0.18;
    pts[0] = avg + (Math.random() * 2 - 1) * disp;
    pts[n] = avg + (Math.random() * 2 - 1) * disp;
    for (let step = n; step > 1; step = Math.floor(step / 2)) {
      for (let i = step / 2; i < n; i += step) {
        pts[i] = (pts[i - step / 2] + pts[i + step / 2]) / 2 +
          (Math.random() * 2 - 1) * disp;
      }
      disp *= 0.58;
    }
    const minY = H * 0.55, maxY = H * 0.94;
    for (let i = 0; i <= n; i++) pts[i] = Math.min(maxY, Math.max(minY, pts[i]));

    game.terrain = pts.map((y, i) => [(i / n) * W, y]);

    // Three pads in left/center/right thirds; narrower pad = bigger multiplier.
    game.pads = [];
    const specs = [[90, 2], [60, 3], [36, 5]].map(([w, m]) => [w * craft, m]);
    const thirds = [0, 1, 2].sort(() => Math.random() - 0.5);
    specs.forEach(([w, mult], k) => {
      const third = thirds[k];
      const cx = W * (third / 3) + W * (0.08 + Math.random() * 0.17) + W * 0.04;
      const i0 = Math.max(1, Math.round((cx - w / 2) / W * n));
      const i1 = Math.min(n - 1, i0 + Math.max(1, Math.round(w / W * n)));
      const y = Math.min(maxY, game.terrain.slice(i0, i1 + 1)
        .reduce((s, p) => s + p[1], 0) / (i1 - i0 + 1));
      for (let i = i0; i <= i1; i++) game.terrain[i][1] = y;
      game.pads.push({ x0: game.terrain[i0][0], x1: game.terrain[i1][0], y, mult });
    });

    game.stars = Array.from({ length: 90 }, () => [
      Math.random() * W, Math.random() * H * 0.7, Math.random() < 0.2 ? 1.6 : 0.9,
    ]);
  }

  function terrainYAt(x) {
    const n = game.terrain.length - 1;
    const fx = Math.min(Math.max(x, 0), W - 0.01) / W * n;
    const i = Math.floor(fx), t = fx - i;
    return game.terrain[i][1] * (1 - t) + game.terrain[Math.min(i + 1, n)][1] * t;
  }

  function padAt(x) {
    return game.pads.find((p) => x >= p.x0 && x <= p.x1) || null;
  }

  /* ---------- round lifecycle ---------- */

  function resetRound() {
    generateTerrain();
    game.state = "flying";
    game.x = W * 0.15;
    game.y = H * 0.14;
    game.vx = 40;
    game.vy = 0;
    game.angle = (Math.random() * 2 - 1) * 0.1;
    game.omega = (Math.random() * 2 - 1) * 0.15;
    game.throttle = 0;
    game.gimbal = 0;
    game.fuel = FUEL_MAX;
    game.particles = [];
    game.message = "";
    game.grade = "";
    game.time = 0;
    game.attempt++;
  }

  /* ---------- physics ---------- */

  function localToWorld([lx, ly]) {
    const c = Math.cos(game.angle), s = Math.sin(game.angle);
    return [game.x + (lx * c - ly * s) * craft, game.y + (lx * s + ly * c) * craft];
  }

  function step(dt) {
    if (game.state !== "flying") return;
    game.time += dt;

    const up = keys.ArrowUp || keys.KeyW || touch.up;
    const down = keys.ArrowDown || keys.KeyS || touch.down;
    const left = keys.ArrowLeft || keys.KeyA || touch.left;
    const right = keys.ArrowRight || keys.KeyD || touch.right;
    const abort = keys.KeyX || touch.abort;

    let gimbalTarget = 0;
    if (left) gimbalTarget = GIMBAL_MAX;    // +gimbal -> CCW torque -> nose left
    if (right) gimbalTarget = -GIMBAL_MAX;  // -gimbal -> CW torque  -> nose right
    if (touch.nub) {
      gimbalTarget = -touch.nub.x * GIMBAL_MAX;
      game.throttle = Math.max(0, Math.min(1, -touch.nub.y)); // push up = thrust
    }

    if (abort && game.fuel > 0) {
      // Flight software: full throttle, gimbal commanded to null angle+spin.
      game.throttle = Math.min(1, game.throttle + THROTTLE_RATE * 2 * dt);
      const accel = (game.throttle * THRUST) / mass();
      const alphaWanted = -(8 * game.angle + 5 * game.omega);
      const s = Math.max(-1, Math.min(1, -alphaWanted / (TORQUE_K * Math.max(accel, 1))));
      gimbalTarget = Math.max(-GIMBAL_MAX, Math.min(GIMBAL_MAX, Math.asin(s)));
      game.gimbal = approach(game.gimbal, gimbalTarget, GIMBAL_RATE * 2 * dt);
    } else {
      if (up) game.throttle = Math.min(1, game.throttle + THROTTLE_RATE * dt);
      if (down) game.throttle = Math.max(0, game.throttle - THROTTLE_RATE * dt);
      game.gimbal = approach(game.gimbal, gimbalTarget, GIMBAL_RATE * dt);
    }

    if (game.fuel <= 0) game.throttle = 0;

    const accel = (game.throttle * THRUST) / mass();
    const dir = game.angle + game.gimbal;
    game.vx += accel * Math.sin(dir) * dt;
    game.vy += (G - accel * Math.cos(dir)) * dt;
    game.omega += -TORQUE_K * accel * Math.sin(game.gimbal) * dt;
    game.omega *= Math.max(0, 1 - ANG_DAMP * dt);
    game.angle += game.omega * dt;
    game.x += game.vx * dt;
    game.y += game.vy * dt;
    game.fuel = Math.max(0, game.fuel - FUEL_BURN * game.throttle * dt);

    // wrap horizontally like the arcade; ceiling is soft
    if (game.x < -20) game.x = W + 20;
    if (game.x > W + 20) game.x = -20;
    if (game.y < -H * 0.3) game.y = -H * 0.3;

    emitExhaust(dt, accel, dir);
    updateParticles(dt);
    checkContact();

    // arcade zoom-in near the ground
    const altitude = terrainYAt(game.x) - game.y;
    const zTarget = altitude < 240 * craft ? 1.6 : 1;
    game.zoom += (zTarget - game.zoom) * Math.min(1, dt * 2.5);
  }

  function mass() { return 1 + FUEL_MASS * (game.fuel / FUEL_MAX); }

  function approach(v, target, maxDelta) {
    const d = target - v;
    return Math.abs(d) <= maxDelta ? target : v + Math.sign(d) * maxDelta;
  }

  function checkContact() {
    const feet = FEET.map(localToWorld);
    const nose = localToWorld(NOSE);
    if (nose[1] >= terrainYAt(nose[0])) return crash("NOSE FIRST");

    const touching = feet.filter(([x, y]) => y >= terrainYAt(x));
    if (!touching.length) return;

    const speed = Math.hypot(game.vx, game.vy);
    const tilt = Math.abs(normalizeAngle(game.angle));
    const pad = padAt(feet[0][0]) && padAt(feet[1][0]);
    if (pad && speed <= SAFE_SPEED && tilt <= SAFE_TILT) {
      const perfect = speed <= PERFECT_SPEED && tilt <= PERFECT_TILT;
      const points = 100 * pad.mult * (perfect ? 2 : 1) + Math.round(game.fuel / 10);
      game.score += points;
      game.state = "landed";
      game.grade = perfect ? "PERFECT LANDING" : "THE CREW SURVIVED";
      game.message = `+${points} PTS  (PAD x${pad.mult}${perfect ? ", PERFECT x2" : ""})`;
      settle(pad.y);
    } else {
      crash(!pad ? "NOT A LANDING PAD" : speed > SAFE_SPEED ? "TOO FAST" : "TOO TILTED");
    }
  }

  function settle(padY) {
    game.vx = 0; game.vy = 0; game.omega = 0; game.throttle = 0;
    game.angle = 0;
    game.y = padY - BASE_Y * craft;
  }

  function crash(why) {
    game.state = "crashed";
    game.grade = "DESTROYED";
    game.message = why;
    for (let i = 0; i < 130; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * 240;
      game.particles.push({
        x: game.x, y: game.y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
        life: 0.6 + Math.random() * 1.8, age: 0,
        color: Math.random() < 0.35 ? RED : WHITE,
      });
    }
  }

  function normalizeAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  /* ---------- particles ---------- */

  function emitExhaust(dt, accel, dir) {
    if (game.throttle <= 0.02 || game.fuel <= 0) return;
    const count = Math.ceil(game.throttle * 300 * dt);
    const [nx, ny] = localToWorld([0, BASE_Y + 10]);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() * 2 - 1) * 0.25;
      const a = dir + Math.PI + spread; // opposite the thrust vector
      const v = 120 + Math.random() * 160;
      game.particles.push({
        x: nx, y: ny,
        vx: game.vx + -Math.sin(a) * v, vy: game.vy + Math.cos(a) * v,
        life: 0.25 + Math.random() * 0.4, age: 0,
        color: Math.random() < 0.5 ? RED : "#ffb347",
      });
    }
  }

  function updateParticles(dt) {
    for (const p of game.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += G * 0.4 * dt;
    }
    game.particles = game.particles.filter((p) => p.age < p.life);
  }

  /* ---------- rendering ---------- */

  function render() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#121213";
    ctx.fillRect(0, 0, W, H);

    // camera: zoom on the lander when near the ground
    const z = game.zoom;
    let cx = game.x, cy = game.y + 60;
    cx = Math.max(W / (2 * z), Math.min(W - W / (2 * z), cx));
    cy = Math.max(H / (2 * z), Math.min(H - H / (2 * z), cy));
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cx * z), dpr * (H / 2 - cy * z));

    // stars
    ctx.fillStyle = DIM;
    for (const [sx, sy, r] of game.stars) ctx.fillRect(sx, sy, r, r);

    // terrain
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 1.5 / z;
    ctx.beginPath();
    game.terrain.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();

    // pads + multipliers
    ctx.lineWidth = 3 / z;
    for (const p of game.pads) {
      ctx.strokeStyle = RED;
      ctx.beginPath();
      ctx.moveTo(p.x0, p.y);
      ctx.lineTo(p.x1, p.y);
      ctx.stroke();
      ctx.fillStyle = DIM;
      ctx.font = `${11 / z}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`x${p.mult}`, (p.x0 + p.x1) / 2, p.y + 14 / z);
    }

    // particles (short velocity-aligned strokes — vector exhaust)
    for (const p of game.particles) {
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.lineWidth = 1.4 / z;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (game.state !== "crashed") drawLander(z);
    drawHud();
  }

  function drawLander(z) {
    ctx.save();
    ctx.translate(game.x, game.y);
    ctx.rotate(game.angle);
    ctx.scale(craft, craft);
    ctx.lineWidth = 1.3 / (z * craft);
    ctx.lineJoin = "round";

    ctx.strokeStyle = WHITE;
    for (const sp of HULL) {
      ctx.beginPath();
      sp.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }

    // engine: exhaust bars swing with the gimbal; flame beyond them
    ctx.translate(0, BASE_Y);
    ctx.rotate(game.gimbal);
    if (game.throttle > 0.02 && game.fuel > 0) {
      const len = (16 + Math.random() * 12) * game.throttle;
      ctx.strokeStyle = "#ffb347";
      ctx.beginPath();
      ctx.moveTo(-3.5, 7);
      ctx.lineTo(0, 7 + len);
      ctx.lineTo(3.5, 7);
      ctx.stroke();
    }
    ctx.strokeStyle = WHITE;
    for (const sp of EXHAUST) {
      ctx.beginPath();
      sp.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHud() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    const altitude = Math.max(0, Math.round(terrainYAt(game.x) - game.y - BASE_Y));
    const rows = [
      ["SCORE", String(game.score).padStart(5, "0")],
      ["TIME", game.time.toFixed(0).padStart(3, " ") + "s"],
      ["FUEL", Math.round(game.fuel)],
      ["ALTITUDE", altitude],
      ["H-SPEED", Math.abs(Math.round(game.vx)) + (game.vx > 2 ? " >" : game.vx < -2 ? " <" : "")],
      ["V-SPEED", Math.abs(Math.round(game.vy)) + (game.vy > 2 ? " v" : game.vy < -2 ? " ^" : "")],
    ];
    rows.forEach(([label, val], i) => {
      ctx.fillStyle = DIM;
      ctx.fillText(label, W - 150, 28 + i * 17);
      ctx.fillStyle = (label === "V-SPEED" && Math.abs(game.vy) > 60) ||
                      (label === "FUEL" && game.fuel < 200) ? RED : WHITE;
      ctx.fillText(String(val), W - 62, 28 + i * 17);
    });

    // throttle + gimbal bars
    ctx.fillStyle = DIM;
    ctx.fillText("THR", 20, 28);
    ctx.strokeStyle = DIM;
    ctx.strokeRect(52, 18, 80, 12);
    ctx.fillStyle = RED;
    ctx.fillRect(52, 18, 80 * game.throttle, 12);
    ctx.fillStyle = DIM;
    ctx.fillText("GMB", 20, 47);
    ctx.strokeRect(52, 37, 80, 12);
    ctx.fillStyle = WHITE;
    const g = game.gimbal / GIMBAL_MAX; // -1..1
    ctx.fillRect(92 + Math.min(0, g * 40), 37, Math.abs(g) * 40, 12);

    if (game.state !== "flying") {
      ctx.textAlign = "center";
      ctx.fillStyle = game.state === "landed" ? WHITE : RED;
      ctx.font = "700 22px ui-monospace, monospace";
      ctx.fillText(game.grade, W / 2, H * 0.32);
      ctx.font = "13px ui-monospace, monospace";
      ctx.fillStyle = WHITE;
      ctx.fillText(game.message, W / 2, H * 0.32 + 26);
      ctx.fillStyle = DIM;
      ctx.fillText("PRESS R OR TAP TO FLY AGAIN — ESC EXITS", W / 2, H * 0.32 + 48);
    }
  }

  /* ---------- boot / teardown ---------- */

  function loop(t) {
    if (!active) return;
    const dt = Math.min((t - last) / 1000 || 0, 0.05);
    last = t;
    step(dt);
    render();
    raf = requestAnimationFrame(loop);
  }

  function onKey(e) {
    if (!active) return;
    if (e.type === "keydown" && e.code === "Escape") return exit();
    if (e.type === "keydown" && e.code === "KeyR" && game.state !== "flying") {
      resetRound();
      return;
    }
    keys[e.code] = e.type === "keydown";
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
  }

  function preventZoom(e) { e.preventDefault(); }

  function makeTouchUi(force) {
    if (!force && !("ontouchstart" in window) && navigator.maxTouchPoints === 0) return;
    ui = document.createElement("div");
    ui.style.cssText =
      "position:fixed;bottom:0;left:0;right:0;z-index:1001;display:flex;flex-direction:column;" +
      "align-items:stretch;gap:10px;padding:0 18px calc(14px + env(safe-area-inset-bottom));" +
      "user-select:none;-webkit-user-select:none;pointer-events:none;";

    const btn = (label, size, color) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText =
        `width:${size}px;height:${size}px;flex:none;background:rgba(18,18,19,0.55);` +
        `color:${color};border:1.5px solid ${color === RED ? RED : "#7a7a7a"};` +
        `border-radius:10px;font-size:${size > 50 ? 24 : 18}px;` +
        "touch-action:none;pointer-events:auto;";
      return b;
    };
    const hold = (b, prop) => {
      const set = (v) => (ev) => { touch[prop] = v; ev.preventDefault(); };
      b.addEventListener("pointerdown", set(true));
      b.addEventListener("pointerup", set(false));
      b.addEventListener("pointercancel", set(false));
      b.addEventListener("pointerleave", set(false));
    };
    const row = (justify) => {
      const r = document.createElement("div");
      r.style.cssText = `display:flex;flex-wrap:nowrap;justify-content:${justify};gap:10px;`;
      return r;
    };
    const drag = (track, onValue, onRelease) => {
      let held = false;
      track.addEventListener("pointerdown", (ev) => {
        held = true;
        track.setPointerCapture(ev.pointerId);
        onValue(ev);
        ev.preventDefault();
      });
      track.addEventListener("pointermove", (ev) => { if (held) onValue(ev); });
      const end = () => { held = false; if (onRelease) onRelease(); };
      track.addEventListener("pointerup", end);
      track.addEventListener("pointercancel", end);
    };

    // small secondary actions, centered above the main controls
    const top = row("space-between");
    const restart = btn("⟳", 44, "#f2f2f2");
    restart.title = "Restart";
    restart.addEventListener("pointerdown", (ev) => { ev.preventDefault(); resetRound(); });
    const abortBtn = btn("X", 44, RED);
    abortBtn.title = "Abort: flight software rights the ship";
    hold(abortBtn, "abort");
    top.append(restart, abortBtn);

    // big primary pairs in the corners for two-thumb play
    const main = row("space-between");
    main.style.margin = "0 -9px"; // pair centers land 78px from the edges, where the sliders sat
    const leftPair = row("flex-start");
    const l = btn("◀", 64, "#f2f2f2"); hold(l, "left");
    const r = btn("▶", 64, "#f2f2f2"); hold(r, "right");
    leftPair.append(l, r);
    const rightPair = row("flex-end");
    const dn = btn("▼", 64, "#f2f2f2"); hold(dn, "down");
    const up = btn("▲", 64, "#f2f2f2"); hold(up, "up");
    rightPair.append(dn, up);
    // trackpoint nub: one thumb for both vectoring (x) and thrust (y, up)
    const nubR = 32, dotR = 11, nubRange = 36;
    const nubPad = document.createElement("div");
    nubPad.style.cssText =
      `position:relative;width:${nubR * 2}px;height:${nubR * 2}px;flex:none;` +
      "border:1.5px solid rgba(122,122,122,0.5);border-radius:50%;" +
      "background:rgba(18,18,19,0.35);touch-action:none;pointer-events:auto;align-self:center;";
    const dot = document.createElement("div");
    dot.style.cssText =
      `position:absolute;width:${dotR * 2}px;height:${dotR * 2}px;border-radius:50%;` +
      "background:rgba(160,160,160,0.45);border:1.5px solid rgba(200,200,200,0.8);" +
      "left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;";
    nubPad.appendChild(dot);
    const nubValue = (ev) => {
      const r = nubPad.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (ev.clientX - r.left - r.width / 2) / nubRange));
      const y = Math.max(-1, Math.min(1, (ev.clientY - r.top - r.height / 2) / nubRange));
      touch.nub = { x, y };
      dot.style.left = 50 + x * 32 + "%";
      dot.style.top = 50 + y * 32 + "%";
    };
    drag(nubPad, nubValue, () => {
      touch.nub = null;
      game.throttle = 0; // momentary: releasing the nub cuts the engine
      dot.style.left = "50%";
      dot.style.top = "50%";
    });
    main.append(leftPair, nubPad, rightPair);


    ui.append(top, main);
    document.body.appendChild(ui);
  }

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const vv = window.visualViewport;
    W = Math.round(vv ? vv.width : window.innerWidth);
    H = Math.round(vv ? vv.height : window.innerHeight);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    craft = Math.min(1, Math.max(0.5, W / 720));
  }

  function resize() {
    if (!canvas) return;
    const oldW = W, oldH = H;
    fit();
    if (W === oldW && H === oldH) return;
    if (!game.terrain.length || Math.abs(W - oldW) > 120 || Math.abs(H - oldH) > 240) {
      resetRound();
      game.attempt--; // resize shouldn't count as an attempt
      return;
    }
    // minor shift (mobile address bar, viewport settling): stretch in place
    const fx = W / oldW;
    for (const p of game.terrain) p[0] *= fx;
    for (const p of game.pads) { p.x0 *= fx; p.x1 *= fx; }
    for (const st of game.stars) st[0] *= fx;
    game.x *= fx;
  }

  function boot() {
    if (active) return;
    active = true;
    canvas = document.createElement("canvas");
    canvas.id = "lunarlander";
    canvas.style.cssText = "position:fixed;left:0;top:0;z-index:1000;background:#121213;touch-action:none;";
    document.body.appendChild(canvas);
    canvas.addEventListener("pointerdown", () => {
      if (game.state !== "flying") resetRound();
    });
    ctx = canvas.getContext("2d");
    makeTouchUi();
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("resize", resize);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    document.addEventListener("gesturestart", preventZoom, { passive: false });
    canvas.addEventListener("touchmove", preventZoom, { passive: false });
    fit();
    setTimeout(resize, 400); // mobile viewport settles after load/refresh
    game.score = 0;
    game.attempt = 0;
    resetRound();
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function exit() {
    active = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKey);
    window.removeEventListener("resize", resize);
    if (window.visualViewport) window.visualViewport.removeEventListener("resize", resize);
    window.removeEventListener("orientationchange", resize);
    document.removeEventListener("gesturestart", preventZoom);
    if (canvas) canvas.remove();
    if (ui) ui.remove();
    touch.nub = null;
    canvas = ctx = ui = null;
    if (location.hash === HASH) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function sync() {
    if (location.hash === HASH) boot();
    else if (active) exit();
  }

  window.addEventListener("hashchange", sync);
  sync();

  // debug/test handle
  window.__lander = { game, boot, exit, resetRound, keys, touch, makeTouchUi };
})();
