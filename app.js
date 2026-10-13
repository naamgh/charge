// Charge: UI, storage and Strava. Everything lives in this phone's localStorage.

const KEY = 'charge.';
const load = (k, d) => { try { const v = localStorage.getItem(KEY + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch {} };
const del = k => { try { localStorage.removeItem(KEY + k); } catch {} };

const STRAVA_API = 'https://www.strava.com/api/v3';
const STRAVA_TOKEN = 'https://www.strava.com/oauth/token';
const STRAVA_AUTH = 'https://www.strava.com/oauth/authorize';

function mondayISO(d = new Date()) {
  const m = new Date(d);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return localISO(m);
}

const S = {
  view: 'today',
  settings: Object.assign({ clientId: '', clientSecret: '', blockStart: mondayISO() }, load('settings', {})),
  strava: load('strava', null),
  acts: load('acts', null),
  history: load('history', []),
  session: load('session', null),
  today: load('today', null),
  loading: false,
  stravaError: null,
};

const $app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtKg = kg => (kg === '' || kg == null) ? '' : (Number(kg) % 1 === 0 ? String(Number(kg)) : String(Number(kg)));
const ICON_CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4F23F" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10"/></svg>';

function toast(msg, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function fmtDuration(mins) {
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
}
function fmtAgo(h) {
  if (h < 1) return 'just now';
  if (h < 36) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/* ---------- Today state ---------- */

function defaultRoutine(day) {
  const hit = Object.keys(ROUTINES).find(k => ROUTINES[k].day === day);
  return { key: hit || 'A', planned: !!hit };
}

function todayState() {
  const now = new Date();
  const iso = localISO(now);
  if (!S.today || S.today.date !== iso) {
    const tomorrow = (now.getDay() + 1) % 7;
    S.today = {
      date: iso,
      legs: 7,
      keyRun: WEEK.keyRunDays.includes(tomorrow),
      override: 'auto',
      routine: defaultRoutine(now.getDay()).key,
    };
    save('today', S.today);
  }
  return S.today;
}

function stravaConnected() { return !!(S.strava && S.strava.refresh_token); }

function currentLight() {
  const t = todayState();
  const strava = stravaConnected() && S.acts ? loadScore(S.acts.list, Date.now()) : null;
  const fin = finalLight({ strava, legs: Number(t.legs), keyRunTomorrow: t.keyRun, override: t.override === 'auto' ? null : t.override });
  return { strava, ...fin };
}

const LIGHT_COPY = {
  green: { title: 'Green', sub: 'Full session', text: 'Legs are charged. Full session, earn the weight.' },
  amber: { title: 'Amber', sub: 'Trimmed session', text: 'Legs are carrying load. One less set on big leg lifts, weight held, cap effort at RPE 7.' },
  red:   { title: 'Red', sub: 'Reset session', text: 'Legs are flat. Ankles, hips and upper only. Protect the next run.' },
};

/* ---------- Strava ---------- */

function redirectUri() { return location.origin + location.pathname; }

function connectStrava() {
  const { clientId, clientSecret } = S.settings;
  if (!clientId || !clientSecret) { toast('Add your Client ID and Secret first.'); return; }
  const p = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  });
  location.href = `${STRAVA_AUTH}?${p}`;
}

async function tokenRequest(body) {
  const res = await fetch(STRAVA_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`Strava token error ${res.status}`);
  return res.json();
}

async function handleOAuthReturn() {
  const p = new URLSearchParams(location.search);
  if (!p.has('code') && !p.has('error')) return;
  history.replaceState(null, '', location.pathname);
  if (p.get('error')) { toast('Strava connection cancelled.'); return; }
  const scope = p.get('scope') || '';
  if (!scope.includes('activity:read')) { toast('Activity access was not granted. Connect again and tick activity access.', 4000); return; }
  try {
    const data = await tokenRequest({
      client_id: S.settings.clientId,
      client_secret: S.settings.clientSecret,
      code: p.get('code'),
      grant_type: 'authorization_code',
    });
    S.strava = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete: data.athlete ? `${data.athlete.firstname || ''} ${data.athlete.lastname || ''}`.trim() : '',
    };
    save('strava', S.strava);
    toast('Strava connected.');
    await refreshActs(true);
  } catch (e) {
    S.stravaError = 'Could not finish connecting. Check the Client Secret and try again.';
    toast(S.stravaError, 4000);
  }
}

async function accessToken() {
  if (!stravaConnected()) return null;
  if ((S.strava.expires_at || 0) * 1000 - 60000 > Date.now()) return S.strava.access_token;
  const data = await tokenRequest({
    client_id: S.settings.clientId,
    client_secret: S.settings.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: S.strava.refresh_token,
  });
  Object.assign(S.strava, { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at });
  save('strava', S.strava);
  return S.strava.access_token;
}

async function refreshActs(force = false) {
  if (!stravaConnected() || S.loading) return;
  if (!force && S.acts && Date.now() - S.acts.fetchedAt < 15 * 60000) return;
  S.loading = true; S.stravaError = null; render();
  try {
    const token = await accessToken();
    const after = Math.floor(Date.now() / 1000) - 4 * 86400;
    const res = await fetch(`${STRAVA_API}/athlete/activities?after=${after}&per_page=50`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { S.strava = null; del('strava'); throw new Error('Strava access expired. Connect again in Settings.'); }
    if (!res.ok) throw new Error(`Strava error ${res.status}`);
    const list = await res.json();
    S.acts = {
      fetchedAt: Date.now(),
      list: list.map(a => ({
        name: a.name, type: a.type, sport_type: a.sport_type, start_date: a.start_date,
        moving_time: a.moving_time, distance: a.distance, average_heartrate: a.average_heartrate,
      })),
    };
    save('acts', S.acts);
  } catch (e) {
    S.stravaError = e.message || 'Could not reach Strava.';
  } finally {
    S.loading = false; render();
  }
}

/* ---------- Views ---------- */

function viewToday() {
  const t = todayState();
  const now = new Date();
  const bw = blockWeek(S.settings.blockStart, now.getTime());
  const plannedKey = defaultRoutine(now.getDay());
  const L = currentLight();
  const copy = LIGHT_COPY[L.light];
  const preview = buildSession(t.routine, L.light, S.history, bw, now.getTime());

  let acts = '';
  if (!stravaConnected()) {
    acts = `<p>Strava not connected, so the light comes from how your legs feel. <button class="link" data-action="go" data-v="settings">Connect Strava</button></p>`;
  } else if (L.strava) {
    const items = L.strava.items;
    acts = `<ul class="acts" aria-label="Activities in the last 72 hours">
      ${items.length ? items.map(i => `<li>
          <div style="min-width:0">
            <div class="name">${esc(i.name)}</div>
            <div class="meta">${i.km.toFixed(1)} km · ${fmtDuration(i.mins)}${i.hr ? ` · ${i.hr} bpm` : ''} · ${fmtAgo(i.hoursAgo)}${i.tags.length ? ` · ${i.tags.join(', ')}` : ''}</div>
          </div>
          <div class="pts">+${i.points}</div>
        </li>`).join('') : '<li><span class="muted">No runs or rides in the last 72 hours.</span></li>'}
      <li><span class="muted">Strava load${S.acts ? `, updated ${fmtAgo(Math.round((Date.now() - S.acts.fetchedAt) / 3600000))}` : ''}</span><span class="pts">${L.strava.score}</span></li>
    </ul>`;
  } else {
    acts = `<p>${S.loading ? 'Pulling your last 72 hours from Strava...' : 'No Strava data yet.'}</p>`;
  }

  const session = S.session;
  return `
  <div class="stack">
    <div class="head">
      <div>
        <div class="eyebrow">${now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
        <h1>${esc(ROUTINES[t.routine].name)}</h1>
      </div>
      <div class="mono soft" style="font-size:13px;text-align:right">Block ${bw.block}<br>${bw.deload ? 'Deload week' : `Week ${bw.week} of 3`}</div>
    </div>

    <div class="seg" role="group" aria-label="Routine">
      ${Object.keys(ROUTINES).map(k => `<button data-action="routine" data-v="${k}" aria-pressed="${t.routine === k}">${k} · ${esc(ROUTINES[k].name.split(' ')[0])}</button>`).join('')}
    </div>
    ${!plannedKey.planned ? '<p class="muted" style="font-size:13px">No gym planned today. Pick a routine if you are going anyway.</p>' : ''}

    <section class="light ${L.light}" aria-label="Today's light">
      <div class="row between">
        <div class="light-label"><span class="dot ${L.light}"></span>${copy.title} · ${copy.sub}</div>
        ${stravaConnected() ? `<button class="btn btn-sm btn-ghost" data-action="refresh" aria-label="Refresh Strava">${S.loading ? '...' : 'Refresh'}</button>` : ''}
      </div>
      <p>${copy.text}</p>
      ${L.reasons.length ? `<p class="mono" style="font-size:12px">${esc(L.reasons.join(' · '))}</p>` : ''}
      ${S.stravaError ? `<p style="color:#FF9C92">${esc(S.stravaError)}</p>` : ''}
      ${acts}
    </section>

    <div class="card stack">
      <label class="field" for="legs">
        <span class="row between"><span>How do your legs feel?</span><span class="mono" id="legsVal" style="color:var(--text);font-size:15px">${t.legs}/10</span></span>
        <input id="legs" type="range" min="1" max="10" step="1" value="${t.legs}" data-today="legs">
      </label>
      <label class="toggle"><span>Key run tomorrow</span><input type="checkbox" data-today="keyRun" ${t.keyRun ? 'checked' : ''}></label>
      <div>
        <div class="eyebrow" style="margin-bottom:8px">Override</div>
        <div class="seg" role="group" aria-label="Override light">
          ${['auto', 'green', 'amber', 'red'].map(o => `<button data-action="override" data-v="${o}" aria-pressed="${t.override === o}">${o[0].toUpperCase() + o.slice(1)}</button>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="row between" style="margin-bottom:4px"><h2>${esc(preview.name)}</h2><span class="mono muted" style="font-size:12px">${preview.exercises.length} moves</span></div>
      <ul class="plan">
        ${preview.exercises.map(e => `<li><span>${esc(e.name)}</span><span class="rx">${e.target.sets}×${e.target.reps}${e.perSide ? '/side' : ''} · ${e.target.kg === null ? 'set kg' : e.target.kg === 0 ? 'BW' : fmtKg(e.target.kg) + ' kg'}</span></li>`).join('')}
      </ul>
    </div>

    ${session
      ? `<button class="btn btn-primary btn-big btn-block" data-action="resume">Resume ${esc(session.name)}</button>`
      : `<button class="btn btn-primary btn-big btn-block" data-action="start">Start session</button>`}
  </div>`;
}

function exComplete(e) { return e.sets.every(x => x.done) && e.rpe != null; }

function viewSession() {
  const s = S.session;
  const copy = LIGHT_COPY[s.light];
  return `
  <div class="stack">
    <div class="s-head">
      <div>
        <div class="eyebrow">${esc(s.name)} · B${s.block} W${s.week}${s.deload ? ' deload' : ''}</div>
        <div class="clock" id="clock">${fmtClock((Date.now() - s.startedAt) / 1000)}</div>
      </div>
      <div class="row">
        <button class="btn btn-sm btn-ghost" data-action="minimise" aria-label="Back to Today">Back</button>
        <button class="btn btn-sm" data-action="finish">Finish</button>
      </div>
    </div>
    <div class="row" style="font-size:13px"><span class="dot ${s.light}"></span><span class="soft">${copy.title}: ${esc(copy.text)}</span></div>
    ${s.exercises.map((e, i) => viewExercise(e, i, i === s.current)).join('')}
  </div>`;
}

function viewExercise(e, i, open) {
  const doneSets = e.sets.filter(x => x.done).length;
  const complete = exComplete(e);
  const rx = `${e.target.sets}×${e.target.reps}${e.perSide ? '/side' : ''}${e.target.kg ? ` · ${fmtKg(e.target.kg)} kg` : e.target.kg === 0 ? ' · BW' : ''}`;
  const top = `<button class="ex-top" data-action="open-ex" data-ex="${i}" aria-expanded="${open}">
      <h2>${esc(e.name)}</h2>
      <span class="row mono soft" style="font-size:12px;flex:none">${complete ? ICON_CHECK : `${doneSets}/${e.sets.length}`}${open ? '' : ` · ${rx}`}</span>
    </button>`;
  if (!open) return `<article class="ex ${complete ? 'done-ex' : ''}">${top}</article>`;

  const nextIdx = e.sets.findIndex(x => !x.done);
  const rows = e.sets.map((x, j) => {
    const last = e.last[j];
    return `
      <div class="setno ${j === nextIdx ? 'now' : ''}">${j + 1}</div>
      <div class="muted">${last ? `${fmtKg(last.kg) || 'BW'}×${last.reps}` : '-'}</div>
      <div class="${x.done ? 'done' : ''}"><input inputmode="decimal" aria-label="Set ${j + 1} kg" data-ex="${i}" data-set="${j}" data-field="kg" value="${esc(fmtKg(x.kg))}" placeholder="kg"></div>
      <div class="${x.done ? 'done' : ''}"><input inputmode="numeric" aria-label="Set ${j + 1} reps" data-ex="${i}" data-set="${j}" data-field="reps" value="${esc(x.reps)}"></div>
      <button class="chk ${x.done ? 'on' : j === nextIdx ? 'next' : ''}" data-action="toggle-set" data-ex="${i}" data-set="${j}" aria-label="${x.done ? 'Undo' : 'Log'} set ${j + 1}" aria-pressed="${x.done}">${x.done ? ICON_CHECK : ''}</button>`;
  }).join('');

  const needRpe = nextIdx === -1;
  return `<article class="ex open">
    ${top}
    <div class="ex-body">
      <div class="grid">
        <div class="h">SET</div><div class="h">LAST</div><div class="h">KG</div><div class="h">REPS</div><div class="h" style="text-align:center">DONE</div>
        ${rows}
      </div>
      ${needRpe ? `<div class="rpe">
        <div class="eyebrow">How hard was the last set? (RPE)</div>
        <div class="seg" role="group" aria-label="Effort of last set">
          ${[6, 7, 8, 9, 10].map(v => `<button data-action="rpe" data-ex="${i}" data-v="${v}" aria-pressed="${e.rpe === v}">${v}</button>`).join('')}
        </div>
        <p class="muted" style="font-size:12px">8 = two reps left in the tank. 10 = nothing left.</p>
      </div>` : ''}
      <div class="note">${esc(e.note)}</div>
      ${!complete ? `<div><button class="link" data-action="skip-ex" data-ex="${i}">Skip exercise</button></div>` : ''}
    </div>
  </article>`;
}

function sessionFooter() {
  const s = S.session;
  const e = s.exercises[s.current];
  let btn;
  const nextSet = e ? e.sets.findIndex(x => !x.done) : -1;
  if (e && nextSet !== -1) {
    const x = e.sets[nextSet];
    const kgTxt = x.kg === '' || x.kg == null ? 'enter kg' : Number(x.kg) === 0 ? 'bodyweight' : `${fmtKg(x.kg)} kg`;
    btn = `<button class="btn btn-primary btn-big btn-block go" data-action="log"><span>Log set ${nextSet + 1}</span><small>${kgTxt} × ${esc(x.reps)}${e.perSide ? ' each side' : ''}</small></button>`;
  } else if (e && e.rpe == null) {
    btn = `<button class="btn btn-big btn-block" disabled>Rate the last set above</button>`;
  } else {
    const nextEx = s.exercises.findIndex(x => !exComplete(x) && !x.skipped);
    btn = nextEx === -1
      ? `<button class="btn btn-primary btn-big btn-block" data-action="finish">Finish session</button>`
      : `<button class="btn btn-primary btn-big btn-block" data-action="open-ex" data-ex="${nextEx}">Next: ${esc(s.exercises[nextEx].name)}</button>`;
  }
  const rest = s.rest ? `<div class="rest" id="rest">
      <span class="eyebrow">Rest</span>
      <div class="bar"><div id="restBar" style="width:100%"></div></div>
      <span class="t" id="restT"></span>
      <button class="btn btn-sm btn-ghost mono" data-action="rest-add" aria-label="Add 30 seconds">+30</button>
      <button class="btn btn-sm btn-ghost" data-action="rest-clear" aria-label="Stop rest timer">✕</button>
    </div>` : '';
  return `<div class="s-foot"><div class="inner">${rest}${btn}</div></div>`;
}

function viewHistory() {
  const h = [...S.history].reverse();
  if (!h.length) return `<div class="stack"><div class="head"><div><div class="eyebrow">History</div><h1>Sessions</h1></div></div><div class="empty">Nothing logged yet. Go lift.</div></div>`;
  return `<div class="stack">
    <div class="head"><div><div class="eyebrow">History</div><h1>Sessions</h1></div><span class="mono muted" style="font-size:13px">${h.length} total</span></div>
    ${h.map(s => `<details class="hist">
      <summary>
        <div>
          <div class="row" style="gap:8px"><span class="dot ${s.light}"></span><strong>${esc(s.name)}</strong></div>
          <div class="mono muted" style="font-size:12px;margin-top:4px">${new Date(s.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} · B${s.block} W${s.week} · ${fmtDuration(Math.max(1, Math.round(((s.endedAt || s.startedAt) - s.startedAt) / 60000)))}</div>
        </div>
        <span class="mono soft" style="font-size:13px">${Math.round(sessionVolume(s)).toLocaleString('en-AU')} kg</span>
      </summary>
      <div class="hist-body">
        ${s.exercises.map(e => `<div class="hist-ex"><span>${esc(e.name)}${e.rpe ? ` <span class="muted mono" style="font-size:12px">RPE ${e.rpe}</span>` : ''}</span><span class="mono">${e.sets.filter(x => x.done).map(x => `${fmtKg(x.kg) || 'BW'}×${x.reps}`).join('  ') || 'skipped'}</span></div>`).join('')}
        <div><button class="btn btn-sm btn-danger" data-action="del-session" data-id="${esc(s.id)}">Delete session</button></div>
      </div>
    </details>`).join('')}
  </div>`;
}

function viewSettings() {
  const st = S.settings;
  const bw = blockWeek(st.blockStart, Date.now());
  const connected = stravaConnected();
  return `<div class="stack">
    <div class="head"><div><div class="eyebrow">Settings</div><h1>Setup</h1></div></div>

    <section class="card stack" aria-label="Strava">
      <div class="row between"><h2>Strava</h2><span class="row mono" style="font-size:12px"><span class="dot ${connected ? 'green' : 'red'}"></span>${connected ? 'Connected' : 'Not connected'}</span></div>
      ${connected ? `
        <p class="soft">${S.strava.athlete ? `Connected as ${esc(S.strava.athlete)}. ` : ''}Charge reads your last 72 hours of runs and rides before each session.</p>
        <div class="row">
          <button class="btn btn-sm" data-action="refresh">Refresh now</button>
          <button class="btn btn-sm btn-danger" data-action="disconnect">Disconnect</button>
        </div>` : `
        <p class="soft">One-time setup, about 3 minutes:</p>
        <ol class="soft" style="margin:0;padding-left:20px;line-height:1.6;font-size:14px">
          <li>Open <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener">strava.com/settings/api</a> and create an app (any name, any website).</li>
          <li>Set Authorization Callback Domain to <code>${esc(location.hostname)}</code></li>
          <li>Paste the Client ID and Client Secret below, then Connect.</li>
        </ol>
        <label class="field">Client ID<input class="input" inputmode="numeric" data-setting="clientId" value="${esc(st.clientId)}" autocomplete="off"></label>
        <label class="field">Client Secret<input class="input" type="password" data-setting="clientSecret" value="${esc(st.clientSecret)}" autocomplete="off"></label>
        <p class="muted" style="font-size:12px">Stored only on this phone. Never put it in your GitHub repo.</p>
        <button class="btn btn-primary" data-action="connect">Connect Strava</button>`}
      ${S.stravaError ? `<p style="color:#FF9C92;font-size:14px">${esc(S.stravaError)}</p>` : ''}
    </section>

    <section class="card stack" aria-label="Training block">
      <h2>Training block</h2>
      <p class="soft">Blocks run 4 weeks: 3 build weeks, then a deload. Set the Monday your current block started.</p>
      <label class="field">Block start<input class="input" type="date" data-setting="blockStart" value="${esc(st.blockStart)}"></label>
      <p class="mono soft" style="font-size:13px">Now: Block ${bw.block}, ${bw.deload ? 'deload week' : `week ${bw.week}`}</p>
    </section>

    <section class="card stack" aria-label="Data">
      <h2>Your data</h2>
      <p class="soft">Everything lives on this phone. Export a backup now and then.</p>
      <div class="row" style="flex-wrap:wrap">
        <button class="btn btn-sm" data-action="export">Export backup</button>
        <label class="btn btn-sm row" style="display:inline-flex">Import backup<input type="file" accept="application/json" data-action-change="import" class="hidden"></label>
      </div>
      <button class="btn btn-sm btn-danger" data-action="wipe">Erase everything</button>
    </section>
  </div>`;
}

/* ---------- Render ---------- */

function render() {
  const inSession = S.view === 'session' && S.session;
  document.body.classList.toggle('in-session', !!inSession);
  let html;
  if (inSession) html = viewSession() + sessionFooter();
  else if (S.view === 'history') html = viewHistory();
  else if (S.view === 'settings') html = viewSettings();
  else html = viewToday();
  $app.innerHTML = html;
  document.querySelectorAll('.nav-btn').forEach(b => b.setAttribute('aria-current', b.dataset.go === S.view ? 'page' : 'false'));
  tick();
}

function go(view) {
  S.view = view;
  if (view === 'today') refreshActs();
  render();
  window.scrollTo(0, 0);
}

/* ---------- Session actions ---------- */

function saveSession() { save('session', S.session); }

function startRest(sec) {
  S.session.rest = { start: Date.now(), dur: sec, buzzed: false };
}

function logSet(ei, si) {
  const e = S.session.exercises[ei];
  const x = e.sets[si];
  if (x.kg === '' || x.kg == null) {
    toast('Enter the weight first. Use 0 for bodyweight.');
    const inp = $app.querySelector(`input[data-ex="${ei}"][data-set="${si}"][data-field="kg"]`);
    if (inp) inp.focus();
    return false;
  }
  x.done = true;
  // carry an edited weight forward to the remaining sets
  e.sets.slice(si + 1).forEach(y => { if (!y.done) y.kg = x.kg; });
  if (e.sets.some(y => !y.done)) startRest(e.rest);
  else startRest(Math.min(e.rest, 90));
  return true;
}

function advance() {
  const s = S.session;
  const next = s.exercises.findIndex((x, i) => i > s.current && !exComplete(x) && !x.skipped);
  const any = s.exercises.findIndex(x => !exComplete(x) && !x.skipped);
  s.current = next !== -1 ? next : any !== -1 ? any : s.current;
}

function finishSession() {
  const s = S.session;
  const anyDone = s.exercises.some(e => e.sets.some(x => x.done));
  if (!anyDone) {
    if (confirm('Nothing logged. Discard this session?')) { S.session = null; del('session'); go('today'); }
    return;
  }
  const open = s.exercises.some(e => e.sets.some(x => !x.done) && !e.skipped);
  if (open && !confirm('Some sets are not logged. Finish anyway?')) return;
  const rec = { ...s, endedAt: Date.now() };
  delete rec.rest; delete rec.current;
  S.history.push(rec);
  save('history', S.history);
  S.session = null; del('session');
  toast(`Saved. ${Math.round(sessionVolume(rec)).toLocaleString('en-AU')} kg moved.`);
  go('history');
}

/* ---------- Events ---------- */

document.addEventListener('click', e => {
  const nav = e.target.closest('[data-go]');
  if (nav) { go(nav.dataset.go); return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const t = S.today;
  const s = S.session;
  const ei = el.dataset.ex != null ? Number(el.dataset.ex) : null;

  switch (a) {
    case 'go': go(el.dataset.v); break;
    case 'routine': t.routine = el.dataset.v; save('today', t); render(); break;
    case 'override': t.override = el.dataset.v; save('today', t); render(); break;
    case 'refresh': refreshActs(true); break;
    case 'start': {
      const L = currentLight();
      const now = Date.now();
      S.session = buildSession(t.routine, L.light, S.history, blockWeek(S.settings.blockStart, now), now);
      saveSession(); go('session'); keepAwake(); break;
    }
    case 'resume': go('session'); break;
    case 'minimise': go('today'); break;
    case 'open-ex':
      s.current = ei; saveSession(); render();
      setTimeout(() => {
        const card = $app.querySelectorAll('.ex')[ei];
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 30);
      break;
    case 'toggle-set': {
      const si = Number(el.dataset.set);
      const x = s.exercises[ei].sets[si];
      if (x.done) { x.done = false; s.exercises[ei].rpe = null; }
      else if (!logSet(ei, si)) break;
      s.current = ei; saveSession(); render(); break;
    }
    case 'log': {
      const e2 = s.exercises[s.current];
      const si = e2.sets.findIndex(x => !x.done);
      if (si !== -1 && logSet(s.current, si)) { saveSession(); render(); }
      break;
    }
    case 'rpe': s.exercises[ei].rpe = Number(el.dataset.v); advance(); saveSession(); render(); break;
    case 'skip-ex': s.exercises[ei].skipped = true; advance(); saveSession(); render(); break;
    case 'rest-add': if (s.rest) { s.rest.dur += 30; s.rest.buzzed = false; saveSession(); tick(); } break;
    case 'rest-clear': s.rest = null; saveSession(); render(); break;
    case 'finish': finishSession(); break;
    case 'del-session':
      if (confirm('Delete this session? This also changes future progression.')) {
        S.history = S.history.filter(x => x.id !== el.dataset.id); save('history', S.history); render();
      }
      break;
    case 'connect': connectStrava(); break;
    case 'disconnect':
      if (confirm('Disconnect Strava on this phone?')) { S.strava = null; S.acts = null; del('strava'); del('acts'); render(); }
      break;
    case 'export': {
      const data = { app: 'charge', version: 1, exportedAt: new Date().toISOString(), history: S.history, blockStart: S.settings.blockStart };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `charge-backup-${localISO(new Date())}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      break;
    }
    case 'wipe':
      if (confirm('Erase all sessions, settings and the Strava connection from this phone?')) {
        Object.keys(localStorage).filter(k => k.startsWith(KEY)).forEach(k => localStorage.removeItem(k));
        location.reload();
      }
      break;
  }
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.field && S.session) {
    const x = S.session.exercises[Number(el.dataset.ex)].sets[Number(el.dataset.set)];
    x[el.dataset.field] = el.value.replace(',', '.');
    saveSession();
    const foot = $app.querySelector('.s-foot');
    if (foot) { foot.outerHTML = sessionFooter(); tick(); }
  } else if (el.dataset.today === 'legs') {
    const v = document.getElementById('legsVal'); if (v) v.textContent = `${el.value}/10`;
  } else if (el.dataset.setting) {
    S.settings[el.dataset.setting] = el.value.trim();
    save('settings', S.settings);
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.today) {
    S.today[el.dataset.today] = el.type === 'checkbox' ? el.checked : Number(el.value);
    save('today', S.today); render();
  } else if (el.dataset.setting === 'blockStart') {
    render();
  } else if (el.dataset.actionChange === 'import' && el.files[0]) {
    el.files[0].text().then(txt => {
      const data = JSON.parse(txt);
      if (data.app !== 'charge' || !Array.isArray(data.history)) throw new Error();
      if (!confirm(`Replace your history with ${data.history.length} sessions from this backup?`)) return;
      S.history = data.history; save('history', S.history);
      if (data.blockStart) { S.settings.blockStart = data.blockStart; save('settings', S.settings); }
      toast('Backup restored.'); render();
    }).catch(() => toast('That file is not a Charge backup.'));
  }
});

/* ---------- Timers ---------- */

function tick() {
  const s = S.session;
  if (!s || S.view !== 'session') return;
  const clock = document.getElementById('clock');
  if (clock) clock.textContent = fmtClock((Date.now() - s.startedAt) / 1000);
  if (s.rest) {
    const left = s.rest.dur - (Date.now() - s.rest.start) / 1000;
    const bar = document.getElementById('restBar');
    const t = document.getElementById('restT');
    const box = document.getElementById('rest');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, (left / s.rest.dur) * 100))}%`;
    if (t) t.textContent = left > 0 ? fmtClock(left) : `+${fmtClock(-left)}`;
    if (box) box.classList.toggle('over', left <= 0);
    if (left <= 0 && !s.rest.buzzed) {
      s.rest.buzzed = true; saveSession();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  }
}
setInterval(tick, 500);

let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && S.session && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { keepAwake(); if (S.view === 'today') refreshActs(); }
});

/* ---------- Boot ---------- */

(async function boot() {
  if (S.session) S.view = 'session';
  render();
  await handleOAuthReturn();
  refreshActs();
  keepAwake();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
