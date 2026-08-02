"use strict";

/* Bordm — daily vowel-restoration puzzle.
 * Puzzle source: Wikimedia pageviews API (CORS-open, finalized daily).
 * The game day is the player's local calendar date (rolls over at their
 * midnight, like NYT games); the puzzle is a pure function of that date,
 * so everyone on a given date gets the same puzzle. */

const VOWELS = "AEIOU";
const MAX_CHECKS = 4;
const EPOCH_UTC = Date.UTC(2026, 7, 1); // game date 2026-08-01 = Bordm #1
/* Finalized daily pageview rankings — immutable once published, unlike the
 * featured-content feed, whose sections mutate during the day. We read the
 * date three days back: finalized data must exist the moment a date begins
 * in UTC+14, which is only ~26h after that source day ended. */
const TOP_URL = (y, m, d) =>
  `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
const SUMMARY_URL = (title) =>
  `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

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

function todayGameDate() {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
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

/* Wiki namespace pages and meta lists that should never be puzzles. */
const TITLE_BLACKLIST =
  /^(Main_Page$|Deaths_in|List_of|Special:|Wikipedia:|File:|Portal:|Help:|Template:|User:|Talk:|Category:|Draft:)|_talk:/i;

function candidatesFromTop(data) {
  const out = [];
  const articles = ((data.items && data.items[0] && data.items[0].articles) || []).slice(0, 60);
  for (const a of articles) {
    const raw = a.article;
    if (!raw || TITLE_BLACKLIST.test(raw)) continue;
    const cleaned = cleanTitle(raw.replace(/_/g, " "));
    if (cleaned) out.push({ raw, answer: cleaned.answer, hint: cleaned.hint });
  }
  return out;
}

function redactClue(clue, answer) {
  let c = clue;
  // Letter-runs, not space-separated words: "SPIDER-MAN" must redact both
  // parts — a surviving "-Man" would hand the player that slot's vowel.
  // Word boundaries keep short runs like IN from matching inside "Indian".
  for (const w of answer.split(/[^A-Z]+/)) {
    if (w.length >= 2) c = c.replace(new RegExp("\\b" + w + "\\b", "gi"), "…");
  }
  return c.replace(/…(\s*[-–]\s*…)+/g, "…").replace(/(…\s*)+…/g, "…");
}

function minusDays({ y, m, d }, n) {
  const t = new Date(Date.UTC(y, m - 1, d) - n * 86400000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function answerWords(answer) {
  return answer.split(/[^A-Z]+/).filter((w) => w.length > 3);
}

async function fetchCandidates(forDate) {
  const src = minusDays(forDate, 3);
  const res = await fetch(TOP_URL(src.y, src.m, src.d), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("pageviews " + res.status);
  return candidatesFromTop(await res.json());
}

function pickFor(key, cands) {
  const rand = xmur3("bordm-" + key);
  return cands[rand() % cands.length];
}

/* COMPATIBILITY CONTRACT: the puzzle number and answer both derive from the
 * calendar date, and players compare results by number. Any change to the
 * selection pipeline (filters, blacklist, variety rule, data offset, seed)
 * silently renames every date's puzzle. If the pipeline must change, gate the
 * new behavior on a cutover date (e.g. `if (key >= "2026-09-01")`) so dates
 * that have already been played keep their identity. */
async function loadPuzzle() {
  const today = todayGameDate();
  const key = dateKey(today);
  const num = puzzleNumber(today);

  /* Once a puzzle is derived for a date, it is pinned for this player —
   * no API behavior can swap the board out from under a game in progress. */
  try {
    const cached = JSON.parse(localStorage.getItem("bordm-puzzle"));
    if (cached && cached.key === key && cached.answer) return cached;
  } catch { /* ignore corrupt cache */ }

  let puzzle;
  try {
    let cands = await fetchCandidates(today);
    if (!cands.length) throw new Error("no candidates");
    /* Variety: a blockbuster can top the charts for days, so exclude
     * candidates sharing a significant word with yesterday's pick.
     * Yesterday's pick is recomputed here with the same seeded algorithm
     * (one level deep, unfiltered), keeping today fully deterministic. */
    try {
      const yKey = dateKey(minusDays(today, 1));
      const yCands = await fetchCandidates(minusDays(today, 1));
      if (yCands.length) {
        const avoid = new Set(answerWords(pickFor(yKey, yCands).answer));
        const varied = cands.filter((c) => !answerWords(c.answer).some((w) => avoid.has(w)));
        if (varied.length) cands = varied;
      }
    } catch { /* variety data unavailable — proceed unfiltered */ }
    const pick = pickFor(key, cands);
    let clue = pick.hint || "In the news";
    try {
      const s = await fetch(SUMMARY_URL(pick.raw), { headers: { Accept: "application/json" } });
      if (s.ok) {
        const sum = await s.json();
        if (sum.description) clue = sum.description;
        else if (sum.extract) clue = sum.extract.split(". ")[0];
      }
    } catch { /* keep hint-based clue */ }
    puzzle = {
      answer: pick.answer,
      clue: redactClue(clue, pick.answer),
      source: "Read by millions on Wikipedia",
      key, num, fallback: false,
    };
    try { localStorage.setItem("bordm-puzzle", JSON.stringify(puzzle)); } catch { /* private mode */ }
  } catch (err) {
    console.warn("Pageviews API unavailable, using fallback puzzle:", err);
    const [answer, clue] = FALLBACK_PUZZLES[xmur3("bordm-" + key)() % FALLBACK_PUZZLES.length];
    /* Deliberately not cached: next load retries the real source, and the
     * saved-game answer check below protects any game started on the fallback. */
    puzzle = { answer, clue, source: "Classic phrase", key, num, fallback: true };
  }
  return puzzle;
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
    answer: game.puzzle.answer,
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
    // Same date AND same board — a saved game from a different puzzle
    // (e.g. one started on the fallback) must not restore onto this one.
    return s.key === game.puzzle.key && s.answer === game.puzzle.answer ? s : null;
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
  const yesterday = dateKey(minusDays(todayGameDate(), 1));
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
  $("check-btn").disabled = game.finished ? false : !allFilled;
  const checksLeft = $("checks-left");
  if (checksLeft) checksLeft.textContent = `(${MAX_CHECKS - game.checksUsed})`;
}

function renderRows() {
  $("rows").innerHTML = game.rows.map((r) => `<div>${r}</div>`).join("");
}

/* ---------- gameplay ---------- */

function handleKey(key) {
  if (!game.puzzle) return;
  if (game.finished) {
    if (key === "Enter") showModal();
    return;
  }
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
  // The check button becomes the way back to the results/share modal.
  const btn = $("check-btn");
  btn.textContent = "Results";
  btn.disabled = false;
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
  const ms = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
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
