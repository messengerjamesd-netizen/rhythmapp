# Rhythm Trainer — Dev Notes

## Stack
Pure frontend: HTML + vanilla JS (ES modules) + Canvas 2D + Web Audio API. No build step.

## Active branch
`claude/rhythm-app-features-7jI3S`

## TODO: Global Leaderboard
The daily challenge currently uses a **local** leaderboard (localStorage only).
Next step: replace it with a **real global leaderboard** so scores are shared across all users.

Options to implement:
- **Supabase** (preferred) — free tier, REST API, CORS-friendly, no SDK needed. Store project URL + anon key in a config file.
- **Firebase Realtime Database** — free tier, REST API works without SDK.
- Schema: `{ date: "2026-05-11", name: "Alice", score: 95, rhythm: "Eighth + Sixteenths" }`
- Leaderboard is keyed by date (today's scores only shown, old data can be ignored).
- Write on score submit, read on page load + after each submission.

The local leaderboard code lives in `js/app.js` (`loadLeaderboard`, `saveScore`, `todayKey`).
`ui.js` has `renderLeaderboard` which just takes an array and renders — no changes needed there.
