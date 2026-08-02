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
   * The craft IS the CodeRocket wordmark, nose up, as single-stroke skeleton
   * vectors fitted to the glyph boxes of the brand PDF. The K's diagonal
   * legs are the engine bell: they articulate at the middle of the K with
   * the gimbal, and thrust emits from that pivot. */
  const BASE_Y = 70.0;
  const HALF_W = 7.7;
  const NOSE = [0, -70.0];
  const FEET = [[-HALF_W, BASE_Y], [HALF_W, BASE_Y]];
  const PIVOT = [0.01, 33.73]; // middle of the K
  const HULL = [[[-5.8,-63.6],[-7.09,-61.45],[-7.57,-58.9],[-6.07,-54.44],[-2.04,-51.91],[-4.1,-55.35],[-5.37,-58.09],[-5.32,-59.92],[-4.87,-61.19],[-3.11,-63.39],[-0.19,-66.73],[1.44,-65.33],[4.47,-61.83],[5.17,-60.57],[5.45,-59.25],[4.93,-56.53],[2.69,-54.27],[4.22,-52.78],[7.19,-56.44],[7.49,-60.21],[6.59,-62.58],[4.9,-64.63],[0.9,-69.01],[-0.9,-69.01],[-4.86,-64.63],[-5.8,-63.6]],[[0.0,-37.14],[-2.52,-37.64],[-4.66,-39.05],[-6.08,-41.17],[-6.58,-43.67],[-6.08,-46.17],[-4.66,-48.29],[-2.52,-49.7],[0.0,-50.2],[2.52,-49.7],[4.66,-48.29],[6.08,-46.17],[6.58,-43.67],[6.08,-41.17],[4.66,-39.05],[2.52,-37.64],[0.0,-37.14]],[[6.39,-33.48],[-6.37,-33.48],[-6.37,-28.22],[-6.37,-28.22],[-6.06,-26.59],[-5.15,-25.12],[-3.74,-23.96],[-1.96,-23.21],[0.01,-22.95],[1.98,-23.21],[3.76,-23.96],[5.17,-25.12],[6.08,-26.59],[6.39,-28.22],[6.39,-28.22],[6.39,-33.48]],[[-6.37,-12.46],[-6.37,-19.39],[6.39,-19.39],[6.39,-12.46]],[[0.01,-19.39],[0.01,-13.49]],[[6.39,-8.8],[-6.39,-8.8],[-6.39,-4.3],[-6.39,-4.3],[-6.15,-2.58],[-5.46,-1.12],[-4.42,-0.15],[-3.2,0.19],[-1.97,-0.15],[-0.94,-1.12],[-0.24,-2.58],[-0.0,-4.3],[-0.0,-4.3],[-0.0,-8.8]],[[-0.0,-4.3],[6.39,0.19]],[[0.0,15.08],[-2.52,14.58],[-4.66,13.17],[-6.08,11.05],[-6.58,8.55],[-6.08,6.05],[-4.66,3.93],[-2.52,2.52],[0.0,2.02],[2.52,2.52],[4.66,3.93],[6.08,6.05],[6.58,8.55],[6.08,11.05],[4.66,13.17],[2.52,14.58],[0.0,15.08]],[[-5.05,27.96],[-6.06,26.26],[-6.45,24.35],[-6.19,22.42],[-5.29,20.67],[-3.85,19.27],[-2.02,18.37],[0.02,18.06],[2.06,18.37],[3.89,19.27],[5.33,20.67],[6.23,22.42],[6.49,24.35],[6.1,26.26],[5.09,27.96]],[[-6.37,55.81],[-6.37,45.1],[6.4,45.1],[6.4,55.81]],[[0.02,45.1],[0.02,54.78]],[[6.41,54.59],[-6.39,54.59]],[[0.01,54.59],[0.01,64.68]],[[6.43,61.29],[6.43,65.8]],[[0.02,61.29],[0.02,70.0]],[[6.39,33.73],[-6.37,33.73]]];
  const LEGS = [[[0.0,0.0],[-6.38,8.88]],[[0.0,0.0],[6.38,8.88]]]; // relative to PIVOT
  let craft = 1;      // shrink factor for narrow (portrait phone) screens

  const WHITE = "#f2f2f2";
  const RED = "#ff4040";        // CodeRocket red, brightened for the dark bg
  const DIM = "#7a7a7a";

  let canvas, ctx, ui, raf = 0, last = 0, active = false;
  let W = 0, H = 0;

  const keys = {};
  const touch = { up: false, down: false, left: false, right: false, abort: false };

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
    const [nx, ny] = localToWorld([PIVOT[0], PIVOT[1] + 6]);
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
    ctx.lineWidth = 1.6 / (z * craft);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // engine: the K's legs swing with the gimbal; flame drawn first, beneath
    ctx.save();
    ctx.translate(PIVOT[0], PIVOT[1]);
    ctx.rotate(game.gimbal);
    if (game.throttle > 0.02 && game.fuel > 0) {
      const len = (18 + Math.random() * 14) * game.throttle;
      ctx.strokeStyle = "#ffb347";
      ctx.beginPath();
      ctx.moveTo(-3, 4);
      ctx.lineTo(0, 4 + len);
      ctx.lineTo(3, 4);
      ctx.stroke();
    }
    ctx.strokeStyle = RED;
    for (const sp of LEGS) {
      ctx.beginPath();
      sp.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = RED;
    for (const sp of HULL) {
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

  function makeTouchUi() {
    ui = document.createElement("div");
    ui.style.cssText =
      "position:fixed;bottom:12px;left:0;right:0;display:flex;justify-content:space-between;" +
      "padding:0 16px;z-index:1001;user-select:none;-webkit-user-select:none;";
    const mk = (label, prop, side) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText =
        "width:56px;height:56px;margin:0 6px;background:transparent;color:#f2f2f2;" +
        "border:1.5px solid #7a7a7a;border-radius:8px;font-size:20px;touch-action:none;";
      const set = (v) => (ev) => { touch[prop] = v; ev.preventDefault(); };
      b.addEventListener("pointerdown", set(true));
      b.addEventListener("pointerup", set(false));
      b.addEventListener("pointercancel", set(false));
      b.addEventListener("pointerleave", set(false));
      side.appendChild(b);
      return b;
    };
    const leftBox = document.createElement("div");
    const rightBox = document.createElement("div");
    mk("◀", "left", leftBox);
    mk("▶", "right", leftBox);
    const abortBtn = mk("X", "abort", rightBox);
    abortBtn.style.color = RED;
    abortBtn.style.borderColor = RED;
    abortBtn.title = "Abort: flight software rights the ship";
    mk("▼", "down", rightBox);
    mk("▲", "up", rightBox);
    ui.append(leftBox, rightBox);
    document.body.appendChild(ui);
  }

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    craft = Math.min(1, Math.max(0.5, W / 720));
  }

  function resize() {
    if (!canvas) return;
    fit();
    resetRound();
    game.attempt--; // resize shouldn't count as an attempt
  }

  function boot() {
    if (active) return;
    active = true;
    canvas = document.createElement("canvas");
    canvas.id = "lunarlander";
    canvas.style.cssText = "position:fixed;inset:0;z-index:1000;background:#121213;touch-action:none;width:100vw;height:100vh;";
    document.body.appendChild(canvas);
    canvas.addEventListener("pointerdown", () => {
      if (game.state !== "flying") resetRound();
    });
    ctx = canvas.getContext("2d");
    makeTouchUi();
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("resize", resize);
    fit();
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
    if (canvas) canvas.remove();
    if (ui) ui.remove();
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
  window.__lander = { game, boot, exit, resetRound, keys, touch };
})();
