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

## Changing the programme

Everything is in `routines.js`:

- `EXERCISES`: sets, reps, weight step, rest time, and whether amber days trim it (`legs: true`).
- `ROUTINES`: which exercises go on which day. A is Tuesday, B is Wednesday.
- `RESET`: the red-day session.
- `WEEK.keyRunDays`: days with a key run (Saturday long run by default), used to tick "Key run tomorrow" automatically.

Blocks are 4 weeks: 3 build weeks then a deload (one set fewer, 10% lighter). Set the block start date in Settings.

## Updating

After you push changes, open the app twice: the first open fetches the new files, the second uses them.

## Files

| File | What it does |
|---|---|
| `index.html` | App shell |
| `routines.js` | Your programme |
| `engine.js` | Load scoring, progression, block weeks |
| `app.js` | Screens, logging, Strava connection |
| `styles.css` | Look and feel |
| `sw.js` | Offline support |
