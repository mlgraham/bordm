# Bordm

**[bordm.com](https://www.bordm.com)** — a daily vowel-restoration puzzle. BORDM is BOREDOM with letters missing; each day the game does the same thing to a phrase, and you put the vowels back in 4 tries.

The phrase comes from what the world read on Wikipedia yesterday, with the article's description as your clue. Results share Wordle-style:

```
Bordm #2 3/4
🟨⬛🟩⬛
🟨⬛🟩🟨
🟩🟩🟩🟩
bordm.com
```

## How it works

- Static site, no build step, no server: `public/` is deployed as-is to Cloudflare Pages.
- The daily puzzle is derived **client-side** from the [Wikimedia featured-content feed](https://en.wikipedia.org/api/rest_v1/) (CORS-open, keyless, refreshed every UTC day): candidate titles are filtered for puzzle-worthiness, then one is picked with a PRNG seeded by the UTC date — so every player gets the same puzzle and the site needs no daily updates, ever.
- If the feed is unreachable, a bundled list of idioms (picked by the same date seed) keeps the game playable offline.
- Streaks and stats live in `localStorage`.

## Develop

Serve `public/` with any static file server, e.g.:

```
python3 -m http.server 8000 -d public
```

## Deploy

```
npx wrangler pages deploy public --project-name=bordm
```
