# Charge

A personal, run-aware strength app. Before each gym session it reads your last 72 hours of runs and rides from Strava, gives the day a traffic light, and adjusts the session to match.

- **Green:** full session. Weight goes up when you hit every rep at RPE 8 or easier.
- **Amber:** one set trimmed on big leg lifts, weight held, effort capped at RPE 7.
- **Red:** reset session. Calves, soleus, tibs, hip flexors, bodyweight Cossacks, plus any upper work.

No server, no account. Everything is stored on your phone.

## Put it on GitHub Pages

1. Create a new repo on GitHub, for example `charge`.
2. Copy every file in this folder into the repo and push:
   ```
   git add .
   git commit -m "Charge v1"
   git push
   ```
3. On GitHub: **Settings > Pages > Build and deployment**. Source: *Deploy from a branch*, branch `main`, folder `/ (root)`. Save.
4. After a minute it is live at `https://<your-username>.github.io/charge/`.
5. Open that link on your phone, then **Share > Add to Home Screen**. It now opens like an app and works offline.

## Connect Strava (once)

1. Go to <https://www.strava.com/settings/api> and create an app. Name and website can be anything.
2. Set **Authorization Callback Domain** to `<your-username>.github.io` (no `https://`, no path).
3. In Charge, open **Settings**, paste the Client ID and Client Secret, tap **Connect Strava** and approve.

The secret is saved only in your phone's browser storage. Never commit it to the repo.

If connecting fails with a network error, Strava is blocking the browser from swapping the code for a token. The fix is a tiny proxy on your existing Cloudflare Worker that forwards `POST /oauth/token` to Strava; point `STRAVA_TOKEN` in `app.js` at it.

## Posting to Strava (with muscle map)

When you finish a session, Charge uploads it to Strava as a Weight Training activity with every set attached (exercise, reps, weight). Strava uses those sets to draw its muscle map. The description also lists your sets in plain text, in case the map doesn't show.

- Turn it off under **Settings > Post sessions to Strava when I finish**.
- Any session can be posted (or retried) from **History**.
- If you connected before posting existed, Settings shows **Reconnect to allow posting**. Tap it once.
- If you also record gym sessions on your watch, stop doing that or you'll get two activities.

Each exercise in `routines.js` has a `fit` pair, like `['squat', 'barbellHackSquat']`. That is the name Strava sees. If a move lands on Strava as "Unknown" or lights the wrong muscles, swap the pair for a closer one from Garmin's FIT exercise list. Set durations are estimated at 3 seconds a rep, with rests filled in between.

## How the load score works

Each activity in the last 72 hours scores points, then fades with time.

| | Points |
|---|---|
| Run | 1 per minute |
| Run averaging above 161 bpm | x 1.4 |
| Run of 16 km or more | x 1.2 |
| Ride | 0.3 per minute (x 1.3 above 150 bpm) |

Fade: last 24h counts fully, 24 to 48h half, 48 to 72h a fifth.

**Under 60 = green, 60 to 139 = amber, 140+ = red.**

Then two checks can push it one step harsher: legs feeling 3/10 or lower (4/10 turns green into amber), and a key run tomorrow (turns green into amber). You can always override.

All thresholds live at the top of `engine.js` in `LOAD`.

## Why the programme looks like this

Research on distance runners shows heavy lifting (5 reps or fewer, about 80%+ of max) and plyometrics both improve running economy, and combining them looks best. Moderate 8 to 20 rep work and isometrics on their own don't. So each session runs: tendon prep, plyos while fresh, one heavy main lift (deadlift or hack squat), then single-leg, calf and hip work. Calves are trained heavy, straight and bent knee, because the soleus carries more load than any other muscle when you run. Plyos are dropped on amber and red days.

## Changing the programme

Everything is in `routines.js`:

- `EXERCISES`: sets, reps, weight step, rest time, and whether amber days trim it (`legs: true`).
- `ROUTINES`: which exercises go on which day. A is Tuesday, B is Wednesday.
- `RESET`: the red-day session.
- `WEEK.keyRunDays`: days with a key run (Saturday long run by default), used to tick "Key run tomorrow" automatically.

Isometric holds (`hold: true`) count seconds instead of reps. Tap **Start hold** and the app runs a 3 second lead-in, the hold, and for single-leg holds a 5 second switch to the other side, buzzing at each change. Holds grow by 5 seconds when you own them at RPE 8 or easier, then add weight once they reach their max.

**Swapping on the day:** open any exercise in a session and tap **Swap exercise** to pick a stand-in, for when equipment is taken or you want to mix it up. The swap only affects that session. Each exercise keeps its own history, so a swapped-in move progresses on its own numbers. The groups of interchangeable exercises live in `SWAPS` at the bottom of the exercise list; add an exercise to `EXERCISES` and to a group to make it swappable.

Blocks are 4 weeks: 3 build weeks then a deload (one set fewer, 10% lighter). Set the block start date in Settings.

## Sub-2 Half Plan

`plan.js` holds the Sub-2 Half Plan (37 weeks from 5 Oct 2026, Sydney Half on 2 May 2027, Parramatta after). Charge uses it to:

- show today's and tomorrow's run on the Today screen, and the whole plan on the **Plan** tab
- tick **Key run tomorrow** by itself before quality runs, gate runs, long runs and race day
- line the gym up with the plan: its lighter weeks become deload weeks, weeks 24 to 28 are maintenance (weights held, one set fewer on big leg lifts), and after week 28 there are no heavy legs

Turn it off under **Settings > Follow the Sub-2 Half Plan** to go back to plain 4-week blocks.

## Updating

Every release bumps the `?v=` number on the files in `index.html` and the `CACHE` name and `SHELL` list in `sw.js`. That stops a phone from mixing old and new files.

After you push, open the app, close it fully, and open it again (up to three times on the first update after v7). If it ever shows **Reload fresh copy**, tap it: it clears the app's cached files only, never your sessions.

## Rebuilding the FIT bundle

`fit.bundle.js` is `src/fit-src.js` packaged with Garmin's FIT SDK. You only need to rebuild it if you change `src/fit-src.js`:

```
npm i @garmin/fitsdk esbuild
npx esbuild src/fit-src.js --bundle --format=iife --global-name=ChargeFit --minify --outfile=fit.bundle.js
```

The FIT SDK is Garmin's, under `FIT-SDK-LICENSE.txt`.

## Files

| File | What it does |
|---|---|
| `index.html` | App shell |
| `routines.js` | Your programme |
| `plan.js` | The Sub-2 Half Plan |
| `engine.js` | Load scoring, progression, block weeks |
| `app.js` | Screens, logging, Strava connection |
| `styles.css` | Look and feel |
| `sw.js` | Offline support |
| `fit.bundle.js` | Builds the FIT file Strava reads (loaded only when posting) |
| `src/fit-src.js` | Source for the bundle |
