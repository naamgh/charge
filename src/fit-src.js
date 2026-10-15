// Builds a FIT strength-training activity from a Charge session.
// Bundled with Garmin's FIT SDK into fit.bundle.js (see README > Rebuilding the FIT bundle).
// Strava reads the set messages (exercise, reps, weight) and draws the muscle map from them.

import { Encoder, Profile } from '@garmin/fitsdk';

const T = Profile.types;

// Turn ['hipRaise', 'barbellHipThrustWithBench'] into FIT numbers.
function lookup(pair) {
  if (!pair) return null;
  const [catName, subName] = pair;
  const cat = Object.entries(T.exerciseCategory).find(([, v]) => v === catName);
  if (!cat) return null;
  const subTable = T[catName + 'ExerciseName'];
  const sub = subTable ? Object.entries(subTable).find(([, v]) => v === subName) : null;
  return { category: Number(cat[0]), subtype: sub ? Number(sub[0]) : null };
}

// Seconds per rep, used to estimate how long a set lasted.
const SEC_PER_REP = 3;

export function buildFit(session, exerciseDefs) {
  const start = new Date(session.startedAt);
  const end = new Date(session.endedAt || Date.now());
  const elapsed = Math.max(60, (end - start) / 1000);

  // Collect logged sets in time order. Older sessions without timestamps get spread evenly.
  const logged = [];
  session.exercises.forEach(ex => {
    ex.sets.forEach(s => { if (s.done) logged.push({ ex, s }); });
  });
  const untimed = logged.filter(l => !l.s.at);
  untimed.forEach((l, i) => {
    l.s = { ...l.s, at: start.getTime() + ((i + 1) / (untimed.length + 1)) * elapsed * 1000 };
  });
  logged.sort((a, b) => a.s.at - b.s.at);

  const enc = new Encoder();
  enc.onMesg(Profile.MesgNum.FILE_ID, {
    type: 'activity', manufacturer: 'development', product: 1, serialNumber: 1, timeCreated: start,
  });
  enc.onMesg(Profile.MesgNum.EVENT, { timestamp: start, event: 'timer', eventType: 'start' });

  let idx = 0;
  let cursor = start.getTime();
  let totalReps = 0;
  logged.forEach(({ ex, s }) => {
    const def = exerciseDefs[ex.id] || {};
    const reps = Number(s.reps) || 0;
    const kg = Number(s.kg) || 0;
    // Isometric holds: reps are seconds held. Logged as a timed set with no rep count.
    const dur = def.hold
      ? Math.max(5, reps * (def.perSide ? 2 : 1) + (def.perSide ? 5 : 0))
      : Math.max(10, reps * SEC_PER_REP * (def.perSide ? 2 : 1));
    const setEnd = Math.max(cursor + dur * 1000, s.at);
    const setStart = setEnd - dur * 1000;
    if (setStart > cursor + 1000) {
      enc.onMesg(Profile.MesgNum.SET, {
        timestamp: new Date(setStart), startTime: new Date(cursor),
        duration: (setStart - cursor) / 1000, setType: 'rest', messageIndex: idx++,
      });
    }
    const fit = lookup(def.fit);
    const mesg = {
      timestamp: new Date(setEnd), startTime: new Date(setStart), duration: dur,
      setType: 'active', repetitions: def.hold ? undefined : reps, weight: kg, weightDisplayUnit: 'kilogram', messageIndex: idx++,
    };
    if (fit) {
      mesg.category = [fit.category];
      if (fit.subtype != null) mesg.categorySubtype = [fit.subtype];
    }
    enc.onMesg(Profile.MesgNum.SET, mesg);
    if (!def.hold) totalReps += reps;
    cursor = setEnd;
  });

  const endMs = Math.max(end.getTime(), cursor);
  const total = (endMs - start.getTime()) / 1000;
  enc.onMesg(Profile.MesgNum.EVENT, { timestamp: new Date(endMs), event: 'timer', eventType: 'stopAll' });
  enc.onMesg(Profile.MesgNum.LAP, {
    messageIndex: 0, timestamp: new Date(endMs), startTime: start,
    totalElapsedTime: total, totalTimerTime: total, sport: 'training', subSport: 'strengthTraining',
  });
  enc.onMesg(Profile.MesgNum.SESSION, {
    messageIndex: 0, timestamp: new Date(endMs), startTime: start,
    totalElapsedTime: total, totalTimerTime: total, sport: 'training', subSport: 'strengthTraining',
    firstLapIndex: 0, numLaps: 1, totalCycles: totalReps,
  });
  enc.onMesg(Profile.MesgNum.ACTIVITY, {
    timestamp: new Date(endMs), numSessions: 1, totalTimerTime: total, type: 'manual',
    event: 'activity', eventType: 'stop',
    localTimestamp: Math.round((endMs - start.getTimezoneOffset() * 60000 - Date.UTC(1989, 11, 31)) / 1000),
  });
  return enc.close();
}

export { lookup };
