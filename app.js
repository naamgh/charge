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
const ICON_CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10"/></svg>';

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

/* ---------- Plan link ---------- */

function followPlan() { return S.settings.followPlan !== false && typeof planGymMode === 'function'; }

// Which week of training this is. The Sub-2 plan drives it while it runs, otherwise 4-week blocks.
function trainingWeek(now) {
  const bw = blockWeek(S.settings.blockStart, now);
  const pm = followPlan() ? planGymMode(new Date(now)) : null;
  if (!pm) return bw;
  return { ...bw, deload: pm.deload, maintain: pm.maintain, noHeavyLegs: pm.noHeavyLegs, planWeek: pm.w, phaseName: pm.phaseName };
}

function weekLabel(s) {
  if (s.planWeek) return `Plan W${s.planWeek}${s.deload ? ' lighter' : ''}`;
  return `B${s.block} W${s.week}${s.deload ? ' deload' : ''}`;
}

/* ---------- Today state ---------- */

function defaultRoutine(day) {
  const hit = Object.keys(ROUTINES).find(k => ROUTINES[k].day === day);
  return { key: hit || 'A', planned: !!hit };
}

function todayState() {
  const now = new Date();
  const iso = localISO(now);
  if (!S.today || S.today.date !== iso || !ROUTINES[S.today.routine]) {
    const tomorrow = (now.getDay() + 1) % 7;
    S.today = {
      date: iso,
      legs: 7,
      keyRun: (followPlan() && planKeyRun(now)) || WEEK.keyRunDays.includes(tomorrow),
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
    scope: 'activity:read_all,activity:write',
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
      scope,
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

function canPost() { return stravaConnected() && (S.strava.scope || '').includes('activity:write'); }

let fitLoading = null;
function loadFit() {
  if (window.ChargeFit) return Promise.resolve();
  if (!fitLoading) fitLoading = new Promise((ok, bad) => {
    const sc = document.createElement('script');
    sc.src = 'fit.bundle.js?v=8'; sc.onload = ok; sc.onerror = () => { fitLoading = null; bad(new Error('Could not load the FIT builder.')); };
    document.head.appendChild(sc);
  });
  return fitLoading;
}

function stravaDescription(rec) {
  const blocks = [];
  rec.exercises.forEach(e => {
    const done = e.sets.filter(x => x.done);
    if (!done.length) return;
    const lines = done.map(x => `${Number(x.kg) ? `${fmtKg(x.kg)} kg` : 'BW'} × ${x.reps}${e.hold ? ' s' : ''}`);
    blocks.push([e.name, ...lines].join('\n'));
  });
  return blocks.join('\n\n');
}

function setPostState(id, state) {
  const rec = S.history.find(h => h.id === id);
  if (!rec) return;
  rec.strava = state;
  save('history', S.history);
  if (S.view === 'history') render();
}

async function postSession(id) {
  const rec = S.history.find(h => h.id === id);
  if (!rec || !canPost()) return;
  setPostState(id, { status: 'posting' });
  try {
    await loadFit();
    const bytes = window.ChargeFit.buildFit(rec, EXERCISES);
    const token = await accessToken();
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'application/octet-stream' }), `charge-${rec.id}.fit`);
    form.append('data_type', 'fit');
    form.append('name', rec.name);
    form.append('description', stravaDescription(rec));
    form.append('external_id', `charge-${rec.id}.fit`);
    const res = await fetch(`${STRAVA_API}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    if (res.status === 401) throw new Error('Strava refused the upload. Reconnect Strava in Settings.');
    let up = await res.json();
    if (!res.ok) throw new Error(up.message || `Upload failed (${res.status})`);
    for (let i = 0; i < 25 && !up.activity_id && !up.error; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const poll = await fetch(`${STRAVA_API}/uploads/${up.id}`, { headers: { Authorization: `Bearer ${token}` } });
      up = await poll.json();
    }
    if (up.error) throw new Error(/duplicate/i.test(up.error) ? 'Strava says this session is already there.' : up.error);
    if (!up.activity_id) throw new Error('Strava is still processing. Check Strava in a minute.');
    setPostState(id, { status: 'posted', activityId: up.activity_id });
    toast('Posted to Strava.');
  } catch (e) {
    setPostState(id, { status: 'error', error: e.message || 'Upload failed.' });
    toast(e.message || 'Upload failed.', 4000);
  }
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
  const bw = trainingWeek(now.getTime());
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
      <div class="mono soft" style="font-size:16px;text-align:right">${bw.planWeek
        ? `Plan week ${bw.planWeek}<br>${bw.deload ? 'Lighter week' : esc(bw.phaseName)}`
        : `Block ${bw.block}<br>${bw.deload ? 'Deload week' : `Week ${bw.week} of 3`}`}</div>
    </div>

    <div class="seg" role="group" aria-label="Routine">
      ${Object.keys(ROUTINES).map(k => `<button data-action="routine" data-v="${k}" aria-pressed="${t.routine === k}">${k} · ${esc(ROUTINES[k].name.split(' ')[0])}</button>`).join('')}
    </div>
    ${!plannedKey.planned ? '<p class="muted" style="font-size:13px">No gym planned today. Pick a routine if you are going anyway.</p>' : ''}

    ${runCard(now)}

    <section class="light ${L.light}" aria-label="Today's light">
      <div class="row between">
        <div class="light-label"><span class="dot ${L.light}"></span>${copy.title} · ${copy.sub}</div>
        ${stravaConnected() ? `<button class="btn btn-sm btn-ghost" data-action="refresh" aria-label="Refresh Strava">${S.loading ? '...' : 'Refresh'}</button>` : ''}
      </div>
      <p>${copy.text}</p>
      ${L.reasons.length ? `<p class="mono" style="font-size:12px">${esc(L.reasons.join(' · '))}</p>` : ''}
      ${S.stravaError ? `<p style="color:var(--red-ink)">${esc(S.stravaError)}</p>` : ''}
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
        ${preview.exercises.map(e => `<li><span>${esc(e.name)}</span><span class="rx">${e.target.sets}×${e.target.reps}${e.hold ? 's' : ''}${e.perSide ? '/side' : ''} · ${e.target.kg === null ? 'set kg' : e.target.kg === 0 ? 'BW' : fmtKg(e.target.kg) + ' kg'}</span></li>`).join('')}
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
        <div class="eyebrow">${esc(s.name)} · ${weekLabel(s)}</div>
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
  const rx = `${e.target.sets}×${e.target.reps}${e.hold ? 's' : ''}${e.perSide ? '/side' : ''}${e.target.kg ? ` · ${fmtKg(e.target.kg)} kg` : e.target.kg === 0 ? ' · BW' : ''}`;
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
      <div class="muted">${last ? `${Number(last.kg) ? fmtKg(last.kg) : 'BW'}×${last.reps}${e.hold ? 's' : ''}` : '-'}</div>
      <div class="${x.done ? 'done' : ''}"><input inputmode="decimal" aria-label="Set ${j + 1} kg" data-ex="${i}" data-set="${j}" data-field="kg" value="${esc(fmtKg(x.kg))}" placeholder="kg"></div>
      <div class="${x.done ? 'done' : ''}"><input inputmode="numeric" aria-label="Set ${j + 1} ${e.hold ? 'seconds' : 'reps'}" data-ex="${i}" data-set="${j}" data-field="reps" value="${esc(x.reps)}"></div>
      <button class="chk ${x.done ? 'on' : j === nextIdx ? 'next' : ''}" data-action="toggle-set" data-ex="${i}" data-set="${j}" aria-label="${x.done ? 'Undo' : 'Log'} set ${j + 1}" aria-pressed="${x.done}">${x.done ? ICON_CHECK : ''}</button>`;
  }).join('');

  const needRpe = nextIdx === -1;
  return `<article class="ex open">
    ${top}
    <div class="ex-body">
      <div class="grid">
        <div class="h">SET</div><div class="h">LAST</div><div class="h">KG</div><div class="h">${e.hold ? 'SEC' : 'REPS'}</div><div class="h" style="text-align:center">DONE</div>
        ${rows}
      </div>
      ${needRpe ? `<div class="rpe">
        <div class="eyebrow">How hard was the last set? (RPE)</div>
        <div class="seg" role="group" aria-label="Effort of last set">
          ${[6, 7, 8, 9, 10].map(v => `<button data-action="rpe" data-ex="${i}" data-v="${v}" aria-pressed="${e.rpe === v}">${v}</button>`).join('')}
        </div>
        <p class="muted" style="font-size:12px">8 = two reps left in the tank. 10 = nothing left.</p>
      </div>` : ''}
      <div class="note">${e.cue ? `<strong style="color:var(--text);font-weight:500">${esc(e.cue)}</strong><br>` : ''}${esc(e.note)}</div>
      ${!complete ? `<div class="row" style="gap:20px">
        ${altsFor(e.id).length ? `<button class="link" data-action="swap-open" data-ex="${i}" aria-expanded="${S.swapOpen === i}">${S.swapOpen === i ? 'Close swap' : 'Swap exercise'}</button>` : ''}
        <button class="link" data-action="skip-ex" data-ex="${i}">Skip exercise</button>
      </div>` : ''}
      ${S.swapOpen === i ? viewSwapList(e, i) : ''}
    </div>
  </article>`;
}

function viewSwapList(e, i) {
  const s = S.session;
  const opts = altsFor(e.id).map(id => {
    const def = EXERCISES[id];
    const t = targetFor(id, {}, S.history, s.light, s.deload);
    const kg = t.kg === null ? 'set kg' : t.kg === 0 ? 'BW' : `${fmtKg(t.kg)} kg`;
    return `<button class="swap-opt" data-action="swap-to" data-ex="${i}" data-to="${id}">
      <span>${esc(def.name)}${id === e.planned ? ' <span class="muted">(planned)</span>' : ''}</span>
      <span class="mono soft" style="font-size:12px;flex:none">${t.sets}×${t.reps}${def.hold ? 's' : ''}${def.perSide ? '/side' : ''} · ${kg}</span>
    </button>`;
  }).join('');
  return `<div class="swap-list" role="group" aria-label="Swap ${esc(e.name)} for">${opts}</div>`;
}

function rpeSheet() {
  const i = S.rpePrompt;
  const e = i != null && S.session && S.session.exercises[i];
  if (!e || e.rpe != null) return '';
  return `<div class="sheet-back" data-action="rpe-later"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rpeTitle">
    <div class="eyebrow">${esc(e.name)} done</div>
    <h2 id="rpeTitle">How hard was the last set?</h2>
    <div class="rpe-grid">
      ${[[6, 'Easy', '4+ left'], [7, 'Solid', '3 left'], [8, 'Hard', '2 left'], [9, 'Very hard', '1 left'], [10, 'Max', '0 left']].map(([v, l, d]) =>
        `<button data-action="rpe" data-ex="${i}" data-v="${v}"><span class="mono">${v}</span><span>${l}</span><small>${d}</small></button>`).join('')}
    </div>
    <button class="link" data-action="rpe-later" style="align-self:center">Later</button>
  </div>`;
}

function sessionFooter() {
  const s = S.session;
  const e = s.exercises[s.current];
  let btn;
  const nextSet = e ? e.sets.findIndex(x => !x.done) : -1;
  if (s.holdT) {
    btn = `<button class="btn btn-big btn-block" data-action="hold-stop">Stop hold</button>`;
  } else if (e && nextSet !== -1 && e.hold) {
    const x = e.sets[nextSet];
    const kgTxt = Number(x.kg) ? `${fmtKg(x.kg)} kg` : 'bodyweight';
    btn = `<button class="btn btn-primary btn-big btn-block go" data-action="hold-start"><span>Start hold, set ${nextSet + 1}</span><small>${esc(x.reps)} s${e.perSide ? ' each side' : ''} · ${kgTxt}</small></button>`;
  } else if (e && nextSet !== -1) {
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
  const hold = s.holdT ? `<div class="rest hold" id="hold">
      <span class="eyebrow" id="holdLabel" style="min-width:72px">Get set</span>
      <div class="bar"><div id="holdBar" style="width:0%"></div></div>
      <span class="t" id="holdT" style="font-size:22px"></span>
    </div>` : '';
  const rest = !s.holdT && s.rest ? `<div class="rest" id="rest">
      <span class="eyebrow">Rest</span>
      <div class="bar"><div id="restBar" style="width:100%"></div></div>
      <span class="t" id="restT"></span>
      <button class="btn btn-sm btn-ghost mono" data-action="rest-add" aria-label="Add 30 seconds">+30</button>
      <button class="btn btn-sm btn-ghost" data-action="rest-clear" aria-label="Stop rest timer">✕</button>
    </div>` : '';
  return `<div class="s-foot"><div class="inner">${hold}${rest}${btn}</div></div>`;
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
          <div class="mono muted" style="font-size:12px;margin-top:4px">${new Date(s.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} · ${weekLabel(s)} · ${fmtDuration(Math.max(1, Math.round(((s.endedAt || s.startedAt) - s.startedAt) / 60000)))}</div>
        </div>
        <span class="mono soft" style="font-size:13px">${Math.round(sessionVolume(s)).toLocaleString('en-AU')} kg</span>
      </summary>
      <div class="hist-body">
        ${s.exercises.map(e => `<div class="hist-ex"><span>${esc(e.name)}${e.rpe ? ` <span class="muted mono" style="font-size:12px">RPE ${e.rpe}</span>` : ''}</span><span class="mono">${e.sets.filter(x => x.done).map(x => `${Number(x.kg) ? fmtKg(x.kg) : 'BW'}×${x.reps}${e.hold ? 's' : ''}`).join('  ') || 'skipped'}</span></div>`).join('')}
        ${stravaRow(s)}
        <div><button class="btn btn-sm" data-action="export-fit" data-id="${esc(s.id)}">Download .fit file</button></div>
        <div><button class="btn btn-sm btn-danger" data-action="del-session" data-id="${esc(s.id)}">Delete session</button></div>
      </div>
    </details>`).join('')}
  </div>`;
}

function stravaRow(s) {
  const st = s.strava;
  if (st && st.status === 'posted') return `<div class="row" style="gap:8px"><span class="dot green"></span><a href="https://www.strava.com/activities/${encodeURIComponent(st.activityId)}" target="_blank" rel="noopener">View on Strava</a></div>`;
  if (st && st.status === 'posting') return `<p class="muted">Posting to Strava...</p>`;
  const err = st && st.status === 'error' ? `<p style="color:var(--red-ink);font-size:13px">${esc(st.error)}</p>` : '';
  if (!canPost()) return err + `<p class="muted" style="font-size:13px">Not on Strava. ${stravaConnected() ? 'Reconnect Strava in Settings to allow posting.' : 'Connect Strava in Settings to post sessions.'}</p>`;
  return err + `<div><button class="btn btn-sm" data-action="post" data-id="${esc(s.id)}">${st ? 'Retry post to Strava' : 'Post to Strava'}</button></div>`;
}

function viewSettings() {
  const st = S.settings;
  const bw = trainingWeek(Date.now());
  const connected = stravaConnected();
  return `<div class="stack">
    <div class="head"><div><div class="eyebrow">Settings</div><h1>Setup</h1></div></div>

    <section class="card stack" aria-label="Strava">
      <div class="row between"><h2>Strava</h2><span class="row mono" style="font-size:12px"><span class="dot ${connected ? 'green' : 'red'}"></span>${connected ? 'Connected' : 'Not connected'}</span></div>
      ${connected ? `
        <p class="soft">${S.strava.athlete ? `Connected as ${esc(S.strava.athlete)}. ` : ''}Charge reads your last 72 hours of runs and rides before each session.</p>
        ${canPost() ? `<label class="toggle"><span>Post sessions to Strava when I finish</span><input type="checkbox" data-setting-check="autoPost" ${st.autoPost !== false ? 'checked' : ''}></label>
          <p class="muted" style="font-size:12px">Posts as Weight Training with every set attached, so Strava can draw the muscle map. If you also record gym sessions on your watch, turn that off to avoid doubles.</p>`
        : `<p style="color:var(--amber-ink);font-size:14px">Posting to Strava needs one more permission.</p><button class="btn btn-sm btn-primary" data-action="connect">Reconnect to allow posting</button>`}
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
      ${S.stravaError ? `<p style="color:var(--red-ink);font-size:14px">${esc(S.stravaError)}</p>` : ''}
    </section>

    <section class="card stack" aria-label="Training block">
      <h2>Training weeks</h2>
      <label class="toggle"><span>Follow the Sub-2 Half Plan</span><input type="checkbox" data-setting-check="followPlan" ${followPlan() ? 'checked' : ''}></label>
      ${followPlan()
        ? `<p class="soft">The gym follows the plan: its lighter weeks, the maintenance phase from week 24, and no heavy legs after week 28. "Key run tomorrow" ticks itself before quality and long runs.</p>
           <p class="mono soft" style="font-size:16px">${bw.planWeek ? `Now: plan week ${bw.planWeek}, ${esc(bw.phaseName)}${bw.deload ? ', lighter week' : ''}` : 'The plan is not running this week, so 4-week blocks are used.'}</p>`
        : `<p class="soft">Blocks run 4 weeks: 3 build weeks, then a deload. Set the Monday your current block started.</p>
           <label class="field">Block start<input class="input" type="date" data-setting="blockStart" value="${esc(st.blockStart)}"></label>
           <p class="mono soft" style="font-size:16px">Now: Block ${bw.block}, ${bw.deload ? 'deload week' : `week ${bw.week}`}</p>`}
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

/* ---------- Safety net ---------- */

// Never a blank screen: show what broke and a one-tap fix. Your sessions are never touched.
function viewCrash(err) {
  const msg = (err && (err.stack || err.message)) || String(err);
  return `<div class="stack">
    <div class="head"><div><div class="eyebrow">Something broke</div><h1>Charge hit a snag</h1></div></div>
    <div class="card stack">
      <p>Your sessions and settings are safe. Tap below to load a fresh copy of the app.</p>
      <button class="btn btn-primary btn-big btn-block" data-action="fresh">Reload fresh copy</button>
      <p class="muted" style="font-size:13px">If it keeps happening, screenshot this and send it to Claude:</p>
      <pre class="crash">${esc(String(msg).slice(0, 800))}</pre>
    </div>
  </div>`;
}

async function reloadFresh() {
  del('today'); // only the legs slider and override; sessions and settings stay
  try {
    if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch {}
  location.replace(location.pathname + '?fresh=' + Date.now());
}

/* ---------- Plan ---------- */

const RUN_KIND = { rest: 'Rest', easy: 'Easy', quality: 'Quality', gate: 'Gate', long: 'Long run', bike: 'Bike', race: 'Race' };

function runCard(now) {
  if (typeof planDay !== 'function') return '';
  const td = planDay(now), tm = planDay(planAddDays(now, 1));
  if (!td && !tm) return '';
  const row = (lab, d) => d ? `<div class="run-row">
      <div class="eyebrow">${lab}</div>
      <div><strong>${esc(d.title)}</strong><p class="soft" style="font-size:14px;margin-top:2px">${esc(d.detail)}</p></div>
    </div>` : '';
  return `<section class="card run-card" aria-label="Run plan">
    <div class="row between"><h2>Run plan</h2><button class="link" data-action="go" data-v="plan">Open plan</button></div>
    ${row('Today', td)}${row('Tomorrow', tm)}
  </section>`;
}

function planDayRows(w, now) {
  const ws = planWeekStart(w);
  return PLAN_DN.map((dn, i) => {
    const d = planAddDays(ws, i);
    const p = planDay(d);
    const isToday = d.getTime() === planMidnight(now).getTime();
    return `<div class="pday${isToday ? ' today' : ''}${['quality', 'gate', 'long', 'race'].includes(p.kind) ? ' key' : ''}">
      <div class="pday-d mono">${dn}<small>${planFmt(d)}</small></div>
      <div style="min-width:0"><strong>${esc(p.title)}</strong>${isToday ? ' <span class="tag">Today</span>' : ''}<p>${esc(p.detail)}</p></div>
    </div>`;
  }).join('');
}

function viewPlan() {
  const now = new Date();
  const cw = planWeekOf(now);
  const toSyd = planDaysTo(PLAN.sydney.date, now);
  const cur = planWeek(cw);
  const pct = cw >= 1 && cw <= 30 ? Math.min(100, ((cw - 1) * 7 + Math.round((planMidnight(now) - planWeekStart(cw)) / PLAN_DAY_MS) + 1) / 210 * 100) : cw > 30 ? 100 : 0;
  const tag = r => r.type === 'gate' ? '<span class="tag gate">Gate</span>' : r.type === 'race' ? '<span class="tag race">Race</span>' : r.type === 'deload' ? '<span class="tag">Lighter</span>' : '';

  const thisWeek = cur ? `<section class="card stack" aria-label="This week">
      <div class="row between" style="align-items:flex-end">
        <div><div class="eyebrow">This week · ${planRange(cw)}</div><h2 style="font-size:28px">Week ${cw} · ${esc(planPhaseName(cw))}</h2></div>
        <div class="mono" style="font-size:28px;font-weight:700;text-align:right">${planTotal(cur)}<small class="muted" style="display:block;font-size:14px;font-weight:600">km run</small></div>
      </div>
      ${cw <= 30 ? `<div class="bar" role="img" aria-label="Progress to Sydney"><div style="width:${pct.toFixed(1)}%"></div></div>` : ''}
      ${cur.note ? `<p class="soft">${esc(cur.note)}</p>` : ''}
      <div class="pdays">${planDayRows(cw, now)}</div>
    </section>` : `<section class="card"><p>${cw === 0 ? `The plan starts ${planFmt(planDate(PLAN.start))}.` : 'Plan complete. Time for the 70.3 build.'}</p></section>`;

  const weeks = PLAN.phases.map(([a, b, name, desc]) => `
    <div class="phase">
      <div class="eyebrow" style="margin:6px 2px">${esc(name)} · ${planFmt(planWeekStart(a))} to ${planFmt(planAddDays(planWeekStart(b), 6))}</div>
      ${PLAN.weeks.filter(r => r[0] >= a && r[0] <= b).map(row => {
        const r = planWeek(row[0]);
        return `<details class="pweek${r.w === cw ? ' now' : ''}"${r.w === cw ? ' open' : ''}>
          <summary>
            <div style="min-width:0"><strong>Week ${r.w}</strong> ${r.w === cw ? '<span class="tag now">This week</span>' : ''}${tag(r)}
              <div class="muted" style="font-size:14px">${planRange(r.w)} · Thu: ${esc(r.thuText)}</div></div>
            <div class="mono" style="font-size:22px;font-weight:700;flex:none">${planTotal(r)}<small class="muted" style="font-size:13px"> km</small></div>
          </summary>
          <div class="pdays">${planDayRows(r.w, now)}</div>
        </details>`;
      }).join('')}
    </div>`).join('');

  return `<div class="stack">
    <div class="head">
      <div><div class="eyebrow">${esc(PLAN.sydney.name)} · 2 May 2027</div><h1>Sub-2 Half Plan</h1></div>
      <div class="mono" style="text-align:right;font-size:34px;font-weight:700;line-height:1">${toSyd > 0 ? toSyd : toSyd === 0 ? 'Today' : 'Done'}<small style="display:block;font-size:13px;color:#A3A3A3;letter-spacing:0.08em">DAYS TO GO</small></div>
    </div>
    <div class="tiles">
      <div class="tile"><span>Goal</span><b class="mono">1:59:28</b></div>
      <div class="tile"><span>Race pace</span><b class="mono">5:38/km</b></div>
      <div class="tile"><span>Easy</span><b class="mono">6:10-7:00</b></div>
    </div>
    ${thisWeek}
    <section class="card stack" aria-label="Gates">
      <h2>The three gates</h2>
      ${PLAN.gates.map(([w, what, target]) => `<div class="row between" style="align-items:flex-start;border-top:1px solid var(--line);padding-top:10px">
        <div><strong>${esc(what)}</strong><div class="muted" style="font-size:14px">Week ${w}, ${planFmt(planWeekStart(w))}${w < cw ? ' · done' : ''}</div></div>
        <div class="mono" style="font-size:18px;font-weight:700;text-align:right">${esc(target)}</div></div>`).join('')}
      <p class="muted" style="font-size:13px">Miss two in a row and Sydney becomes a 2:03 race, with sub-2 moving to Parramatta.</p>
    </section>
    <section class="card stack" aria-label="Pace guide">
      <h2>Pace guide</h2>
      ${PLAN.paces.map(([n, s, p]) => `<div class="row between" style="border-top:1px solid var(--line);padding-top:10px">
        <div><strong>${esc(n)}</strong><div class="muted" style="font-size:14px">${esc(s)}</div></div>
        <div class="mono" style="font-size:18px;font-weight:700">${esc(p)}</div></div>`).join('')}
    </section>
    <h2 style="margin-top:6px">Week by week</h2>
    ${weeks}
    <a class="btn btn-block" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${PLAN.url}" target="_blank" rel="noopener">Open the full plan page</a>
    <p class="muted" style="font-size:13px">The full page has the session guides, race plan and rules. It opens in Claude.</p>
  </div>`;
}

/* ---------- Render ---------- */

function render() {
  const inSession = S.view === 'session' && S.session;
  document.body.classList.toggle('in-session', !!inSession);
  let html;
  try {
    if (inSession) html = viewSession() + sessionFooter() + rpeSheet();
    else if (S.view === 'history') html = viewHistory();
    else if (S.view === 'settings') html = viewSettings();
    else if (S.view === 'plan') html = viewPlan();
    else html = viewToday();
  } catch (err) {
    document.body.classList.remove('in-session');
    html = viewCrash(err);
  }
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
  x.at = Date.now();
  // carry an edited weight forward to the remaining sets
  e.sets.slice(si + 1).forEach(y => { if (!y.done) y.kg = x.kg; });
  if (e.sets.some(y => !y.done)) startRest(e.rest);
  else {
    startRest(Math.min(e.rest, 90));
    if (e.rpe == null) S.rpePrompt = ei;   // last set done: ask straight away
  }
  return true;
}

function advance() {
  const s = S.session;
  const next = s.exercises.findIndex((x, i) => i > s.current && !exComplete(x) && !x.skipped);
  const any = s.exercises.findIndex(x => !exComplete(x) && !x.skipped);
  s.current = next !== -1 ? next : any !== -1 ? any : s.current;
}

function holdPhases(e, sec) {
  const p = [{ label: 'Get set', sec: 3, hold: false }];
  if (e.perSide) p.push({ label: 'Left', sec, hold: true }, { label: 'Switch', sec: 5, hold: false }, { label: 'Right', sec, hold: true });
  else p.push({ label: 'Hold', sec, hold: true });
  return p;
}

// Where are we in the hold? Returns the phase, seconds into it, and whether it's over.
function holdState(h) {
  let t = (Date.now() - h.start) / 1000;
  for (let i = 0; i < h.phases.length; i++) {
    const ph = h.phases[i];
    if (t < ph.sec) return { i, ph, into: t, done: false };
    t -= ph.sec;
  }
  return { i: h.phases.length - 1, ph: h.phases[h.phases.length - 1], into: 0, done: true };
}

function startHold() {
  const s = S.session;
  const e = s.exercises[s.current];
  const si = e.sets.findIndex(x => !x.done);
  if (si === -1) return;
  const sec = Number(e.sets[si].reps) || e.target.reps;
  s.rest = null;
  s.holdT = { ei: s.current, si, start: Date.now(), phases: holdPhases(e, sec), lastPhase: 0 };
  saveSession(); render();
}

function endHold(early) {
  const s = S.session;
  const h = s.holdT;
  if (!h) return;
  const st = holdState(h);
  const target = h.phases.find(p => p.hold).sec;
  let held = target;
  if (early) {
    if (st.ph.hold) held = Math.round(st.into);
    else if (st.i === 0) held = 0;          // stopped before starting
  }
  s.holdT = null;
  if (held > 0) {
    s.exercises[h.ei].sets[h.si].reps = held;
    logSet(h.ei, h.si);
  }
  saveSession(); render();
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
  if (canPost() && S.settings.autoPost !== false) postSession(rec.id);
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
    case 'fresh': reloadFresh(); break;
    case 'routine': t.routine = el.dataset.v; save('today', t); render(); break;
    case 'override': t.override = el.dataset.v; save('today', t); render(); break;
    case 'refresh': refreshActs(true); break;
    case 'start': {
      const L = currentLight();
      const now = Date.now();
      S.session = buildSession(t.routine, L.light, S.history, trainingWeek(now), now);
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
    case 'rpe': s.exercises[ei].rpe = Number(el.dataset.v); S.rpePrompt = null; advance(); saveSession(); render(); break;
    case 'rpe-later': S.rpePrompt = null; render(); break;
    case 'swap-open': S.swapOpen = S.swapOpen === ei ? null : ei; render(); break;
    case 'swap-to': {
      if (s.holdT) { toast('Finish or stop the hold first.'); break; }
      const cur = s.exercises[ei];
      if (cur.sets.some(x => x.done) && !confirm(`You've logged sets of ${cur.name}. Swap anyway? Those sets will be dropped.`)) break;
      const next = swapExercise(s, ei, el.dataset.to, S.history);
      S.swapOpen = null; s.current = ei; s.rest = null;
      saveSession(); render(); toast(`Swapped to ${next.name}.`);
      break;
    }
    case 'skip-ex': s.exercises[ei].skipped = true; advance(); saveSession(); render(); break;
    case 'hold-start': startHold(); break;
    case 'hold-stop': endHold(true); break;
    case 'export-fit': {
      const rec = S.history.find(h => h.id === el.dataset.id);
      if (!rec) break;
      loadFit().then(() => {
        const bytes = window.ChargeFit.buildFit(rec, EXERCISES);
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
        const link = document.createElement('a');
        link.href = url; link.download = `charge-${rec.date}-${rec.routine}.fit`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }).catch(err => toast(err.message));
      break;
    }
    case 'rest-add': if (s.rest) { s.rest.dur += 30; s.rest.buzzed = false; saveSession(); tick(); } break;
    case 'rest-clear': s.rest = null; saveSession(); render(); break;
    case 'finish': finishSession(); break;
    case 'del-session':
      if (confirm('Delete this session? This also changes future progression.')) {
        S.history = S.history.filter(x => x.id !== el.dataset.id); save('history', S.history); render();
      }
      break;
    case 'connect': connectStrava(); break;
    case 'post': postSession(el.dataset.id); break;
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
  if (el.dataset.settingCheck) {
    S.settings[el.dataset.settingCheck] = el.checked; save('settings', S.settings);
    if (el.dataset.settingCheck === 'followPlan') { S.today = null; del('today'); render(); }
  } else if (el.dataset.today) {
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
  if (s.holdT) {
    const h = s.holdT;
    const st = holdState(h);
    if (st.done) { if (navigator.vibrate) navigator.vibrate([300, 100, 300]); endHold(false); return; }
    if (st.i !== h.lastPhase) { h.lastPhase = st.i; saveSession(); if (navigator.vibrate) navigator.vibrate(200); }
    const lab = document.getElementById('holdLabel');
    const bar = document.getElementById('holdBar');
    const t = document.getElementById('holdT');
    if (lab) lab.textContent = st.ph.label;
    if (bar) { bar.style.width = `${Math.min(100, (st.into / st.ph.sec) * 100)}%`; bar.style.background = st.ph.hold ? 'var(--accent)' : 'var(--muted)'; }
    if (t) t.textContent = Math.ceil(st.ph.sec - st.into);
  }
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
  if (location.search.includes('fresh=')) history.replaceState(null, '', location.pathname);
  if (S.session) S.view = 'session';
  S.history.forEach(h => { if (h.strava && h.strava.status === 'posting') h.strava = { status: 'error', error: 'Upload was interrupted.' }; });
  render();
  await handleOAuthReturn();
  refreshActs();
  keepAwake();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
