// Charge engine: pure logic, no DOM. Load scoring, block weeks, session building, progression.

const LIGHTS = ['green', 'amber', 'red'];

const LOAD = {
  z2Ceiling: 161,     // bpm. Runs averaging above this count as hard.
  hardRunFactor: 1.4,
  longRunMetres: 16000,
  longRunFactor: 1.2,
  rideFactor: 0.3,    // cycling is far easier on legs than running
  hardRideHr: 150,
  hardRideFactor: 1.3,
  amberAt: 60,        // score at or above this = amber
  redAt: 140,         // score at or above this = red
  windowHours: 72,
};

const RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun'];
const RIDE_TYPES = ['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide'];

function decayFor(hoursAgo) {
  if (hoursAgo < 0) return 0;
  if (hoursAgo <= 24) return 1;
  if (hoursAgo <= 48) return 0.5;
  if (hoursAgo <= 72) return 0.2;
  return 0;
}

// Score one Strava activity. Returns null for activities that do not load the legs.
function scoreActivity(a, now) {
  const type = a.sport_type || a.type;
  const isRun = RUN_TYPES.includes(type);
  const isRide = RIDE_TYPES.includes(type);
  if (!isRun && !isRide) return null;

  const hoursAgo = (now - new Date(a.start_date).getTime()) / 3600000;
  const decay = decayFor(hoursAgo);
  if (decay === 0) return null;

  const mins = (a.moving_time || 0) / 60;
  const hr = a.average_heartrate || 0;
  let base;
  let tags = [];
  if (isRun) {
    base = mins;
    if (hr > LOAD.z2Ceiling) { base *= LOAD.hardRunFactor; tags.push('hard'); }
    if ((a.distance || 0) >= LOAD.longRunMetres) { base *= LOAD.longRunFactor; tags.push('long'); }
  } else {
    base = mins * LOAD.rideFactor;
    if (hr > LOAD.hardRideHr) { base *= LOAD.hardRideFactor; tags.push('hard'); }
  }
  return {
    name: a.name || type,
    kind: isRun ? 'run' : 'ride',
    km: (a.distance || 0) / 1000,
    mins: Math.round(mins),
    hr: hr ? Math.round(hr) : null,
    hoursAgo: Math.round(hoursAgo),
    decay,
    tags,
    points: Math.round(base * decay),
  };
}

function loadScore(activities, now) {
  const items = (activities || [])
    .map(a => scoreActivity(a, now))
    .filter(Boolean)
    .sort((x, y) => x.hoursAgo - y.hoursAgo);
  const score = items.reduce((s, i) => s + i.points, 0);
  const light = score >= LOAD.redAt ? 'red' : score >= LOAD.amberAt ? 'amber' : 'green';
  return { score, light, items };
}

// Combine Strava load with how the legs feel and what is coming tomorrow.
function finalLight({ strava, legs, keyRunTomorrow, override }) {
  if (override && LIGHTS.includes(override)) {
    return { light: override, reasons: ['Manual override'] };
  }
  let level = strava ? LIGHTS.indexOf(strava.light) : 0;
  const reasons = [];
  if (strava) reasons.push(`Strava load ${strava.score}`);
  if (legs <= 3) { level += 1; reasons.push(`Legs ${legs}/10`); }
  else if (legs === 4 && level === 0) { level = 1; reasons.push(`Legs ${legs}/10`); }
  if (keyRunTomorrow && level === 0) { level = 1; reasons.push('Key run tomorrow'); }
  level = Math.min(level, 2);
  return { light: LIGHTS[level], reasons };
}

// Blocks are 4 weeks: 3 build, 1 deload.
function blockWeek(blockStartISO, now) {
  const start = new Date(blockStartISO + 'T00:00:00');
  const days = Math.floor((now - start.getTime()) / 86400000);
  if (isNaN(days) || days < 0) return { block: 1, week: 1, deload: false };
  const weeks = Math.floor(days / 7);
  const week = (weeks % 4) + 1;
  return { block: Math.floor(weeks / 4) + 1, week, deload: week === 4 };
}

function localISO(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function roundTo(x, step) {
  const s = step >= 2.5 ? 2.5 : step >= 2 ? 1 : 0.5;
  return Math.round(x / s) * s;
}

// Find the most useful past performance of an exercise.
// Progression is judged only from full (green, non-deload) sessions.
function lastPerformance(exId, history) {
  let anyRecord = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const s = history[i];
    const ex = (s.exercises || []).find(e => e.id === exId);
    if (!ex) continue;
    const done = ex.sets.filter(x => x.done);
    if (!done.length) continue;
    const kg = Math.max(...done.map(x => Number(x.kg) || 0));
    const allHit = done.length >= ex.target.sets && done.every(x => Number(x.reps) >= ex.target.reps);
    const rec = { kg, allHit, rpe: ex.rpe, date: s.date, light: s.light, deload: s.deload, sets: ex.sets };
    if (!anyRecord) anyRecord = rec;
    if (s.light === 'green' && !s.deload && !s.reset) return { progress: rec, recent: anyRecord };
  }
  return { progress: anyRecord, recent: anyRecord };
}

function targetFor(exId, base, history, light, deload) {
  const def = EXERCISES[exId];
  const { progress, recent } = lastPerformance(exId, history);
  let sets = base.sets ?? def.sets;
  let reps = base.reps ?? def.reps;
  let kg = null;
  let note;

  if (base.bodyweight) {
    return { sets, reps, kg: 0, note: 'Bodyweight only today.' };
  }
  if (!recent) {
    return { sets, reps, kg: null, note: 'First time. Enter the weight you use, the app takes it from here.' };
  }

  if (light === 'green' && !deload) {
    kg = progress.kg;
    if (progress.allHit && progress.rpe != null && progress.rpe <= 8) {
      kg = progress.kg + def.step;
      note = `Up ${def.step} kg. You hit every rep at RPE ${progress.rpe} last full session.`;
    } else if (!progress.allHit) {
      note = 'Same weight. Missed reps last time, own every rep before adding load.';
    } else if (progress.rpe == null) {
      note = 'Same weight. No effort rating last time, rate the last set today.';
    } else {
      note = `Same weight. Last full session was RPE ${progress.rpe}, get it to 8 or easier first.`;
    }
  } else {
    kg = recent.kg;
    note = light === 'red' ? 'Reset day. Light and controlled.' : 'Held weight. Amber day, no progression.';
  }

  if (light === 'amber' && def.legs && base.sets == null) {
    sets = Math.max(1, sets - 1);
    note += ' One set trimmed, cap effort at RPE 7.';
  }
  if (deload && light !== 'red') {
    sets = Math.max(1, sets - 1);
    if (kg != null) kg = roundTo(kg * 0.9, def.step);
    note = 'Deload week. Lighter and one set fewer, let the block land.';
  }
  return { sets, reps, kg: kg == null ? null : roundTo(kg, def.step), note };
}

function buildSession(routineKey, light, history, bw, now) {
  const routine = ROUTINES[routineKey];
  let list;
  if (light === 'red') {
    list = RESET.exercises.map(e => ({ ...e }));
    routine.exercises
      .filter(id => !EXERCISES[id].legs && !list.find(e => e.id === id))
      .filter(id => !['hip_flexor', 'sl_calf', 'soleus', 'tib_raise'].includes(id))
      .forEach(id => list.push({ id }));
  } else {
    list = routine.exercises.map(id => ({ id }));
  }

  const exercises = list.map(base => {
    const t = targetFor(base.id, base, history, light, bw.deload);
    const last = lastPerformance(base.id, history).recent;
    return {
      id: base.id,
      name: EXERCISES[base.id].name,
      perSide: !!EXERCISES[base.id].perSide,
      rest: EXERCISES[base.id].rest,
      target: { sets: t.sets, reps: t.reps, kg: t.kg },
      note: t.note,
      last: last ? last.sets.filter(x => x.done).map(x => ({ kg: x.kg, reps: x.reps })) : [],
      sets: Array.from({ length: t.sets }, () => ({ kg: t.kg ?? '', reps: t.reps, done: false })),
      rpe: null,
    };
  });

  return {
    id: 's' + now,
    startedAt: now,
    date: localISO(new Date(now)),
    routine: routineKey,
    name: light === 'red' ? `${RESET.name} (${routine.name})` : routine.name,
    light,
    reset: light === 'red',
    deload: bw.deload,
    block: bw.block,
    week: bw.week,
    exercises,
    current: 0,
  };
}

function sessionVolume(s) {
  return s.exercises.reduce((v, e) =>
    v + e.sets.filter(x => x.done).reduce((a, x) => a + (Number(x.kg) || 0) * (Number(x.reps) || 0), 0), 0);
}

if (typeof module !== 'undefined') {
  module.exports = { localISO, loadScore, finalLight, blockWeek, targetFor, buildSession, lastPerformance, sessionVolume, LOAD };
}
