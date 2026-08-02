"use strict";

/* Bordm — daily vowel-restoration puzzle.
 * Puzzle source: Wikimedia featured-content feed (CORS-open, updates every UTC day).
 * The same UTC date always yields the same puzzle for every player. */

const VOWELS = "AEIOU";
const MAX_CHECKS = 4;
const EPOCH_UTC = Date.UTC(2026, 7, 1); // Aug 1 2026 = Bordm #1
const FEED_URL = (y, m, d) =>
  `https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;

/* Evergreen fallbacks if the feed is unreachable; picked deterministically by date. */
const FALLBACK_PUZZLES = [
  ["PIECE OF CAKE", "Something very easy to do"],
  ["ONCE IN A BLUE MOON", "Very rarely"],
  ["SPILL THE BEANS", "Reveal a secret"],
  ["UNDER THE WEATHER", "Feeling slightly ill"],
  ["BREAK THE ICE", "Get a conversation going"],
  ["HIT THE HAY", "Go to bed"],
  ["COLD TURKEY", "Quit abruptly"],
  ["SILVER LINING", "The upside of a bad situation"],
  ["CURIOSITY KILLED THE CAT", "A warning against prying"],
  ["EASIER SAID THAN DONE", "Simple in theory, hard in practice"],
  ["AGAINST THE CLOCK", "Racing a deadline"],
  ["DOWN TO EARTH", "Practical and unpretentious"],
  ["FULL OF HOT AIR", "Talking nonsense"],
  ["OUT OF THE BLUE", "Completely unexpected"],
  ["SECOND WIND", "A burst of renewed energy"],
  ["THROW IN THE TOWEL", "Give up"],
  ["UP IN THE AIR", "Still undecided"],
  ["WILD GOOSE CHASE", "A hopeless pursuit"],
  ["BENEFIT OF THE DOUBT", "Trusting without proof"],
  ["BURN THE MIDNIGHT OIL", "Work late into the night"],
  ["CUT TO THE CHASE", "Get to the point"],
  ["RAIN CHECK", "A polite postponement"],
  ["FOOD FOR THOUGHT", "Something worth considering"],
  ["HEART OF GOLD", "A deeply kind nature"],
];

/* ---------- deterministic RNG ---------- */

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/* ---------- puzzle derivation ---------- */

function todayUTC() {
  const now = new Date();
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
}

function dateKey({ y, m, d }) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function puzzleNumber({ y, m, d }) {
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH_UTC) / 86400000) + 1;
}

function cleanTitle(raw) {
  if (!raw) return null;
  let hint = null;
  let t = raw.replace(/\s*\(([^)]*)\)\s*$/, (_, p) => { hint = p; return ""; });
  t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  t = t.replace(/[:,.!?"“”]/g, "").replace(/[‘’]/g, "'").replace(/[–—]/g, "-");
  t = t.trim().toUpperCase();
  if (!/^[A-Z' -]+$/.test(t)) return null;
  const words = t.split(/\s+/).filter(Boolean);
  const letters = t.replace(/[^A-Z]/g, "");
  const vowels = letters.replace(/[^AEIOU]/g, "");
  if (words.length < 2 || words.length > 5) return null;
  if (letters.length < 6 || letters.length > 26) return null;
  if (vowels.length < 2 || vowels.length > 12) return null;
  if (words.some((w) => w.replace(/[^A-Z]/g, "").length > 12)) return null;
  return { answer: words.join(" "), hint };
}

const TITLE_BLACKLIST = /^(deaths in|list of|main page|wikipedia|portal)/i;

function candidatesFromFeed(feed) {
  const out = [];
  const push = (title, desc, source) => {
    if (!title || TITLE_BLACKLIST.test(title)) return;
    const cleaned = cleanTitle(title);
    if (!cleaned) return;
    out.push({
      answer: cleaned.answer,
      clue: desc || cleaned.hint || "A name in the news",
      source,
    });
  };
  for (const a of (feed.mostread && feed.mostread.articles) || []) {
    push(a.titles && a.titles.normalized, a.description, "Trending on Wikipedia yesterday");
  }
  if (feed.tfa) {
    push(feed.tfa.titles && feed.tfa.titles.normalized, feed.tfa.description, "Today's featured article");
  }
  return out;
}

function redactClue(clue, answer) {
  let c = clue;
  for (const w of answer.split(" ")) {
    const bare = w.replace(/[^A-Z]/g, "");
    if (bare.length > 3) c = c.replace(new RegExp(bare, "gi"), "…");
  }
  return c;
}

async function loadPuzzle() {
  const utc = todayUTC();
  const key = dateKey(utc);
  const num = puzzleNumber(utc);
  const rand = xmur3("bordm-" + key);
  try {
    const res = await fetch(FEED_URL(utc.y, utc.m, utc.d), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("feed " + res.status);
    const feed = await res.json();
    const cands = candidatesFromFeed(feed);
    if (!cands.length) throw new Error("no candidates");
    const pick = cands[rand() % cands.length];
    return { ...pick, clue: redactClue(pick.clue, pick.answer), key, num, fallback: false };
  } catch (err) {
    console.warn("Feed unavailable, using fallback puzzle:", err);
    const [answer, clue] = FALLBACK_PUZZLES[rand() % FALLBACK_PUZZLES.length];
    return { answer, clue, source: "Classic phrase", key, num, fallback: true };
  }
}

/* ---------- game state ---------- */

const game = {
  puzzle: null,
  words: [],      // [{ tiles: [{ch, isVowel, slotIndex|null}] }]
  slots: [],      // [{answer, input, locked, el}]
  activeSlot: -1,
  checksUsed: 0,
  rows: [],       // share emoji rows
  finished: false,
  won: false,
};

const $ = (id) => document.getElementById(id);

function stateStorageKey() { return "bordm-game"; }

function saveGame() {
  localStorage.setItem(stateStorageKey(), JSON.stringify({
    key: game.puzzle.key,
    inputs: game.slots.map((s) => s.input),
    locked: game.slots.map((s) => s.locked),
    checksUsed: game.checksUsed,
    rows: game.rows,
    finished: game.finished,
    won: game.won,
  }));
}

function loadSavedGame() {
  try {
    const raw = localStorage.getItem(stateStorageKey());
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s.key === game.puzzle.key ? s : null;
  } catch { return null; }
}

function loadStats() {
  try { return JSON.parse(localStorage.getItem("bordm-stats")) || {}; }
  catch { return {}; }
}

function recordResult(won, checks) {
  const s = loadStats();
  s.played = (s.played || 0) + 1;
  s.wins = (s.wins || 0) + (won ? 1 : 0);
  const yesterday = dateKey((() => {
    const t = new Date(Date.now() - 86400000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  })());
  s.streak = won ? ((s.lastWinKey === yesterday ? s.streak : 0) || 0) + 1 : 0;
  if (won) s.lastWinKey = game.puzzle.key;
  s.dist = s.dist || {};
  const bucket = won ? String(checks) : "X";
  s.dist[bucket] = (s.dist[bucket] || 0) + 1;
  localStorage.setItem("bordm-stats", JSON.stringify(s));
}

/* ---------- rendering ---------- */

function buildBoard() {
  const board = $("board");
  board.innerHTML = "";
  game.words = [];
  game.slots = [];
  for (const wordText of game.puzzle.answer.split(" ")) {
    const wordEl = document.createElement("div");
    wordEl.className = "word";
    const tiles = [];
    for (const ch of wordText) {
      const tile = document.createElement("div");
      const isLetter = /[A-Z]/.test(ch);
      const isVowel = VOWELS.includes(ch);
      if (!isLetter) {
        tile.className = "tile punct";
        tile.textContent = ch;
      } else if (isVowel) {
        tile.className = "tile slot";
        const slotIndex = game.slots.length;
        tile.dataset.slot = slotIndex;
        game.slots.push({ answer: ch, input: "", locked: false, el: tile });
        tile.addEventListener("click", () => {
          if (!game.slots[slotIndex].locked && !game.finished) setActiveSlot(slotIndex);
        });
      } else {
        tile.className = "tile fixed";
        tile.textContent = ch;
      }
      wordEl.appendChild(tile);
      tiles.push({ ch, isVowel });
    }
    board.appendChild(wordEl);
    game.words.push({ text: wordText, tiles });
  }
}

function setActiveSlot(i) {
  game.activeSlot = i;
  game.slots.forEach((s, j) => s.el.classList.toggle("active", j === i));
}

function nextOpenSlot(from) {
  const n = game.slots.length;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    if (!game.slots[i].locked && !game.slots[i].input) return i;
  }
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    if (!game.slots[i].locked) return i;
  }
  return -1;
}

function renderSlots() {
  for (const s of game.slots) {
    s.el.textContent = s.locked ? s.answer : s.input;
    s.el.classList.toggle("locked", s.locked);
    s.el.classList.toggle("filled", !s.locked && !!s.input);
  }
  const allFilled = game.slots.every((s) => s.locked || s.input);
  $("check-btn").disabled = game.finished || !allFilled;
  $("checks-left").textContent = `(${MAX_CHECKS - game.checksUsed})`;
}

function renderRows() {
  $("rows").innerHTML = game.rows.map((r) => `<div>${r}</div>`).join("");
}

/* ---------- gameplay ---------- */

function handleKey(key) {
  if (game.finished || !game.puzzle) return;
  if (key === "Backspace") {
    let i = game.activeSlot;
    if (i < 0) return;
    if (!game.slots[i].input) {
      for (let step = 1; step <= game.slots.length; step++) {
        const j = (i - step + game.slots.length) % game.slots.length;
        if (!game.slots[j].locked && game.slots[j].input) { i = j; break; }
      }
    }
    if (!game.slots[i].locked) {
      game.slots[i].input = "";
      setActiveSlot(i);
      renderSlots();
      saveGame();
    }
    return;
  }
  if (key === "Enter") { check(); return; }
  const ch = key.toUpperCase();
  if (!VOWELS.includes(ch)) return;
  const i = game.activeSlot;
  if (i < 0 || game.slots[i].locked) return;
  game.slots[i].input = ch;
  const nxt = nextOpenSlot(i);
  if (nxt >= 0) setActiveSlot(nxt); else setActiveSlot(i);
  renderSlots();
  saveGame();
}

function wordStatus(word) {
  // word: entry of game.words; find its slots by walking tiles
  let slotCursor = 0;
  const statuses = [];
  for (const w of game.words) {
    let solved = true, anyLocked = false;
    for (const t of w.tiles) {
      if (t.isVowel) {
        const s = game.slots[slotCursor++];
        if (s.locked) anyLocked = true; else solved = false;
      }
    }
    if (!w.tiles.some((t) => t.isVowel)) solved = true;
    statuses.push(solved ? "🟩" : anyLocked ? "🟨" : "⬛");
  }
  return statuses;
}

function check() {
  if (game.finished) return;
  if (!game.slots.every((s) => s.locked || s.input)) return;
  game.checksUsed++;
  for (const s of game.slots) {
    if (s.locked) continue;
    if (s.input === s.answer) {
      s.locked = true;
    } else {
      s.el.classList.add("shake");
      setTimeout(() => s.el.classList.remove("shake"), 400);
      s.input = "";
    }
  }
  game.rows.push(wordStatus().join(""));
  renderRows();

  const solved = game.slots.every((s) => s.locked);
  if (solved) {
    finish(true);
  } else if (game.checksUsed >= MAX_CHECKS) {
    for (const s of game.slots) {
      if (!s.locked) { s.el.textContent = s.answer; s.el.classList.add("revealed"); }
    }
    finish(false);
  } else {
    const nxt = nextOpenSlot(-1);
    if (nxt >= 0) setActiveSlot(nxt);
  }
  renderSlots();
  saveGame();
}

function finish(won, restoring) {
  game.finished = true;
  game.won = won;
  setActiveSlot(-1);
  if (!restoring) recordResult(won, game.checksUsed);
  showModal();
}

/* ---------- share & modal ---------- */

function shareText() {
  const score = game.won ? game.checksUsed : "X";
  return `Bordm #${game.puzzle.num} ${score}/${MAX_CHECKS}\n${game.rows.join("\n")}\nbordm.com`;
}

function showModal() {
  $("result-title").textContent = game.won
    ? ["", "Genius! 1/4", "Great — 2/4", "Solid — 3/4", "Phew — 4/4"][game.checksUsed]
    : "Out of checks";
  $("result-answer").textContent = game.puzzle.answer;
  $("result-clue").textContent = `${game.puzzle.source}: ${game.puzzle.clue}`;
  $("share-preview").textContent = shareText();
  const s = loadStats();
  $("stats").innerHTML = [
    [s.played || 0, "Played"],
    [s.played ? Math.round((100 * (s.wins || 0)) / s.played) + "%" : "—", "Win rate"],
    [s.streak || 0, "Streak"],
  ].map(([n, l]) => `<div class="stat"><span class="n">${n}</span><span class="l">${l}</span></div>`).join("");
  $("modal").hidden = false;
  tickCountdown();
}

function tickCountdown() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const ms = next - now.getTime();
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000);
  const el = $("countdown");
  if (el) el.textContent = `${h}h ${m}m ${sec}s`;
  if (!$("modal").hidden) setTimeout(tickCountdown, 1000);
}

async function doShare() {
  const text = shareText();
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch { /* fall through to clipboard */ }
  try {
    await navigator.clipboard.writeText(text);
    $("share-btn").textContent = "Copied!";
    setTimeout(() => { $("share-btn").textContent = "Share"; }, 1500);
  } catch {
    prompt("Copy your result:", text);
  }
}

/* ---------- init ---------- */

async function init() {
  game.puzzle = await loadPuzzle();
  $("loading").hidden = true;
  $("meta").hidden = false;
  $("puzzle-num").textContent = `Bordm #${game.puzzle.num}`;
  $("clue-source").textContent = game.puzzle.source;
  $("clue").textContent = `“${game.puzzle.clue}”`;
  $("clue").hidden = false;

  buildBoard();

  const saved = loadSavedGame();
  if (saved) {
    game.checksUsed = saved.checksUsed;
    game.rows = saved.rows || [];
    saved.inputs.forEach((v, i) => { if (game.slots[i]) game.slots[i].input = v; });
    saved.locked.forEach((v, i) => { if (game.slots[i]) game.slots[i].locked = v; });
    renderRows();
    if (saved.finished) {
      for (const s of game.slots) {
        if (!s.locked) { s.el.textContent = s.answer; s.el.classList.add("revealed"); }
      }
      finish(saved.won, true);
    }
  }
  if (!game.finished) {
    const first = game.slots.findIndex((s) => !s.locked && !s.input);
    setActiveSlot(first >= 0 ? first : 0);
  }
  renderSlots();

  document.querySelectorAll(".key").forEach((k) =>
    k.addEventListener("click", () => handleKey(k.dataset.key)));
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Backspace" || e.key === "Enter" || /^[a-zA-Z]$/.test(e.key)) {
      handleKey(e.key.length === 1 ? e.key : e.key);
      if (e.key === "Backspace") e.preventDefault();
    }
  });
  $("modal-close").addEventListener("click", () => { $("modal").hidden = true; });
  $("modal").addEventListener("click", (e) => { if (e.target === $("modal")) $("modal").hidden = true; });
  $("share-btn").addEventListener("click", doShare);
}

init();
