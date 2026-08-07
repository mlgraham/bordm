# Bordm

**[bordm.com](https://www.bordm.com)** — a daily vowel-restoration puzzle. BORDM is BOREDOM with letters missing; each day the game does the same thing to a phrase, and you put the vowels back in 4 tries.

The phrase comes from what the world has been reading on Wikipedia, with the article's description as your clue. Results share in Bordm's own moon-phase language — one row per check, each word lighting up as you restore it:

```
Bordm #2 3/4
🌗🌑🌕🌑
🌗🌑🌕🌗
🌕🌕🌕🌕
bordm.com
```

## How it works

- Static site, no build step, no server: `public/` is deployed as-is to Cloudflare Pages.
- The daily puzzle is derived **client-side** from the [Wikimedia pageviews API](https://wikimedia.org/api/rest_v1/) (CORS-open, keyless, finalized daily): the top-read articles from a few days back (walking back up to five if a dataset is missing) are filtered for puzzle-worthiness, then one is picked by rendezvous hashing on the date — stable against dataset republications — with a five-day memory that prevents repeat answers. Everyone on a given calendar date gets the same puzzle and the site needs no daily updates, ever. The puzzle rolls over at each player's local midnight, like the NYT games. The clue is the article's description from the page-summary endpoint, and the derived puzzle is pinned in `localStorage` so a board never changes mid-game.
- If the API is unreachable, a bundled list of idioms (picked by the same date seed) keeps the game playable offline.
- Streaks and stats live in `localStorage`.

## Contributing note

The puzzle number and answer both derive deterministically from the calendar date, and players compare results by number. **Changing any part of the selection pipeline (filters, variety rule, data offset, seed) renames every date's puzzle.** If you change the pipeline, gate the new behavior on a cutover date so already-played dates keep their identity.

## Develop

Serve `public/` with any static file server, e.g.:

```
python3 -m http.server 8000 -d public
```

## Deploy

```
npx wrangler pages deploy public --project-name=bordm
```
