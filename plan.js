// Sub-2 Half Plan, built into Charge.
// Source: the "Sub-2 Half Plan" page. Edit the weeks here if the plan changes.
// Charge uses it to show today's run, tick "Key run tomorrow" for you, and
// line the gym's lighter weeks up with the plan's.

const PLAN = {
  url: 'https://claude.ai/artifact/L2essSGeWwNszjr3uUuvep',
  start: '2026-10-05', // Monday of week 1
  sydney: { name: 'HOKA Runaway Sydney Half', date: '2027-05-02', week: 30 },
  parramatta: { name: 'Parramatta Half', date: '2027-06-20', week: 37, assumed: true },
  paces: [
    ['Easy and long', 'Heart rate under 161 bpm', '6:10 to 7:00'],
    ['Steady', 'Base-phase steady runs', '5:45 to 5:55'],
    ['Threshold', 'Short sentences only', '5:25 to 5:35'],
    ['Race pace', 'Specific phase and race day', '5:38 to 5:40'],
    ['Intervals', 'Short, hard, in control', '5:20 and quicker'],
  ],
  gates: [
    [10, '10k time trial', '55:00 or faster'],
    [21, '10k race or time trial', '54:00 or faster'],
    [25, '8 km at 5:38, or a 10k', 'Controlled, or 53:00'],
  ],
  // [week, tue km, thu km, thu session, sat km, note, type, long run finish]
  weeks: [
    [1, 5, 5, 'Easy with 4 strides', 8, 'Every run under 161 bpm.', '', ''],
    [2, 5, 6, 'Easy with 6 strides', 9, 'Book the asthma assessment this week.', '', ''],
    [3, 6, 6, 'Easy with 6 strides', 10, '', '', ''],
    [4, 5, 5, 'Easy with 4 strides', 8, 'Absorb the first month.', 'deload', ''],
    [5, 6, 7, 'Easy with 6 hill sprints, 20 s each', 11, 'Gel rehearsal starts on every long run.', '', ''],
    [6, 7, 7, 'Easy with 8 hill sprints, 30 s each', 12, '', '', ''],
    [7, 7, 8, '3 x 8 min steady at 5:55, 2 min jog', 13, '', '', ''],
    [8, 6, 6, 'Easy with 4 strides', 10, '', 'deload', ''],
    [9, 7, 8, '4 x 4 min at 5:20, 3 min jog', 14, 'First hard intervals. Warm up 15 min.', '', ''],
    [10, 6, 13, '10k time trial: 2 km warm-up, 10 km, 1 km cool-down', 10, 'Gate: 10k in 55:00 or faster.', 'gate', ''],
    [11, 7, 8, '20 min tempo at 5:35', 15, '', '', ''],
    [12, 6, 6, 'Easy with 4 strides', 10, 'Christmas week. Keep the runs, drop the extras.', 'deload', ''],
    [13, 7, 8, '4 x 5 min at 5:30, 2 min jog', 14, 'Asthma assessment done before the next block.', '', ''],
    [14, 7, 9, '3 x 8 min at 5:30, 2 min jog', 15, 'Threshold block begins.', '', ''],
    [15, 7, 10, '4 x 8 min at 5:30, 2 min jog', 16, '', '', ''],
    [16, 6, 7, 'Easy with 6 strides', 12, '', 'deload', ''],
    [17, 8, 10, '5 x 6 min at 5:25, 90 s jog', 17, '', '', ''],
    [18, 8, 10, '3 x 2 km at 5:30, 2 min jog', 18, '', '', ''],
    [19, 8, 10, '6 x 1 km at 5:20, 90 s jog', 18, '', '', 'Last 4 km at 5:50'],
    [20, 6, 8, '20 min steady at 5:45', 13, '', 'deload', ''],
    [21, 8, 13, '10k tune-up race or time trial', 14, 'Gate: 10k in 54:00 or faster.', 'gate', ''],
    [22, 8, 10, '2 x 3 km at 5:35, 3 min jog', 19, '', '', ''],
    [23, 8, 13, '3 x 3 km at 5:35, 2 min jog', 20, '', '', 'Last 5 km at 5:45'],
    [24, 7, 9, '6 km at 5:38 steady', 14, 'First race pace rehearsal. Gym drops to maintenance.', 'deload', ''],
    [25, 8, 11, '8 km at 5:38, controlled', 18, 'Gate: 8 km at 5:38 controlled, or a 10k in 53:00.', 'gate', ''],
    [26, 8, 13, '3 x 3 km at 5:38, 2 min jog', 20, 'Peak long run.', '', 'Last 6 km at 5:45'],
    [27, 8, 13, '10 km at 5:38 continuous', 18, 'Dress rehearsal: race shoes, race gels, race breakfast.', '', ''],
    [28, 7, 10, '2 x 3 km at 5:38, 2 min jog', 14, 'Last hard week. No heavy leg gym after this.', '', ''],
    [29, 6, 8, '4 x 1 km at 5:38, 2 min jog', 10, 'Taper. Cut ride time by about a third.', '', ''],
    [30, 5, 5, 'Easy with 4 strides at race pace, 20 s each', 3, 'Race week. Race on Sunday.', 'race', ''],
    [31, 6, 6, 'Easy only', 8, 'Recovery week after Sydney. No quality.', 'deload', ''],
    [32, 8, 10, '2 x 3 km at 5:35, 3 min jog', 16, '', '', ''],
    [33, 8, 13, '3 x 3 km at 5:35, 2 min jog', 18, '', '', ''],
    [34, 8, 13, '10 km at 5:38 continuous', 18, '', '', 'Last 4 km at 5:45'],
    [35, 8, 11, '8 km at 5:35', 16, '', '', ''],
    [36, 6, 8, '4 x 1 km at 5:38, 2 min jog', 10, 'Taper.', '', ''],
    [37, 5, 5, 'Easy with 4 strides at race pace, 20 s each', 3, 'Race week (assumed Sunday 20 June 2027).', 'race', ''],
  ],
  phases: [
    [1, 4, 'Reset', 'Easy running, rebuilding the habit.'],
    [5, 13, 'Base', 'Hills, steady running, first intervals.'],
    [14, 23, 'Build', 'Threshold work and longer long runs.'],
    [24, 28, 'Specific', 'Race pace becomes the main course.'],
    [29, 30, 'Taper', 'Cut volume, keep a little sharpness.'],
    [31, 37, 'Second shot', 'Recovery, three weeks of work, then a short taper.'],
  ],
};

const PLAN_DAY_MS = 864e5;
const PLAN_DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PLAN_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function planDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function planMidnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function planAddDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function planFmt(d) { return `${d.getDate()} ${PLAN_MON[d.getMonth()]}`; }
function planWeekStart(w) { return planAddDays(planDate(PLAN.start), 7 * (w - 1)); }
function planRange(w) {
  const a = planWeekStart(w), b = planAddDays(a, 6);
  return a.getMonth() === b.getMonth() ? `${a.getDate()} to ${planFmt(b)}` : `${planFmt(a)} to ${planFmt(b)}`;
}

function planWeek(w) {
  const r = PLAN.weeks[w - 1];
  if (!r) return null;
  return { w: r[0], tue: r[1], thu: r[2], thuText: r[3], sat: r[4], note: r[5], type: r[6], finish: r[7] };
}

// Week number for a date: 0 before the plan, 38 after it.
function planWeekOf(date) {
  const diff = Math.round((planMidnight(date) - planDate(PLAN.start)) / PLAN_DAY_MS);
  if (diff < 0) return 0;
  return Math.min(38, Math.floor(diff / 7) + 1);
}

function planPhase(w) {
  if (w === 30 || w === 37) return 'race';
  if (w === 29 || w === 36) return 'taper';
  if (w === 31) return 'recovery';
  if (w <= 4) return 'reset';
  if (w <= 13) return 'base';
  if (w <= 23) return 'build';
  return 'specific';
}
function planPhaseName(w) { const p = PLAN.phases.find(x => w >= x[0] && w <= x[1]); return p ? p[2] : ''; }
function planTotal(r) { return r.tue + r.thu + r.sat; }

// What the plan says for one day. kind: rest | easy | quality | gate | long | bike | race
function planDay(date) {
  const w = planWeekOf(date);
  const r = planWeek(w);
  if (!r) return null;
  const i = Math.round((planMidnight(date) - planWeekStart(w)) / PLAN_DAY_MS);
  const k = planPhase(w);
  const light = r.type === 'deload';
  const race = k === 'race';
  const base = { w, i, phase: k, week: r };
  switch (i) {
    case 0: return { ...base, kind: 'rest', title: 'Rest', detail: 'Full rest. Ten minutes of hip and ankle mobility is fine.' };
    case 1: return { ...base, kind: 'easy', km: r.tue, title: `Gym AM, easy run PM (${r.tue} km)`,
      detail: `${r.tue} km easy at 6:10 to 7:00, heart rate under 161, then 4 to 6 strides.` };
    case 2: {
      if (race) return { ...base, kind: 'bike', title: 'Easy spin or rest', detail: '20 to 30 min under 119 W, or rest.' };
      const mins = ['reset', 'recovery', 'taper'].includes(k) ? 35 : 50;
      return { ...base, kind: 'bike', title: 'Gym AM, indoor bike PM', detail: `${mins} min Zone 2 at 119 to 161 W, 85 to 95 rpm. No intervals.` };
    }
    case 3: {
      const easy = /^Easy/.test(r.thuText);
      return { ...base, kind: r.type === 'gate' ? 'gate' : easy ? 'easy' : 'quality', km: r.thu,
        title: `${easy ? 'Easy run' : r.type === 'gate' ? 'Gate run' : 'Quality run'} (${r.thu} km)`,
        detail: easy ? `${r.thuText}. Heart rate under 161 on the easy parts.`
          : `10 to 15 min warm-up and 4 strides, then ${r.thuText}, then 10 min easy. Reliever in your pocket.` };
    }
    case 4: {
      if (race) return { ...base, kind: 'rest', title: 'Rest or easy spin', detail: 'Rest, or 20 min easy under 119 W.' };
      if (k === 'taper') return { ...base, kind: 'bike', title: 'Easy spin', detail: '45 to 60 min, 119 to 161 W. No tempo this week.' };
      if (light || k === 'recovery') return { ...base, kind: 'bike', title: 'Endurance ride', detail: 'Zone 2 only, up to 75 min. Skip the tempo.' };
      return { ...base, kind: 'bike', title: 'Tempo group ride', detail: `Group tempo ${k === 'reset' ? 'up to 50' : 'up to 65'} min, capped at 194 W. Sit up when the group goes.` };
    }
    case 5: {
      if (race) return { ...base, kind: 'easy', km: 3, title: 'Shakeout (3 km)', detail: '3 km easy with 4 strides at 5:38. Lay out kit and gels tonight.' };
      const gel = w >= 5 && w <= 29 ? ' Gel at about 45 min with water, small sips.' : '';
      return { ...base, kind: 'long', km: r.sat, title: `Long run (${r.sat} km)`,
        detail: `${r.sat} km easy, heart rate under 161${r.finish ? `, ${r.finish.toLowerCase()}` : ''}.${gel}` };
    }
    default: {
      if (race) {
        const name = w === 30 ? PLAN.sydney.name : PLAN.parramatta.name;
        return { ...base, kind: 'race', title: `Race day: ${name}`, detail: 'Km 1 to 3 at 5:50, then 5:38. Gel at km 8 and km 14. Reliever in your pocket.' };
      }
      const len = k === 'taper' ? 'up to 90 min' : k === 'recovery' ? '60 to 90 min' : light ? 'up to 2 h' : k === 'reset' ? 'up to 2.5 h' : '2 to 3 h';
      return { ...base, kind: 'bike', title: 'Long group ride', detail: `Zone 2, 119 to 161 W, ${len}. Climbs at tempo only. Eat and drink every 30 min.` };
    }
  }
}

// Does the plan have a run tomorrow that the gym should protect?
function planKeyRun(date) {
  const d = planDay(planAddDays(date, 1));
  return !!d && ['quality', 'gate', 'long', 'race'].includes(d.kind);
}

// How the plan wants the gym to behave this week.
//   deload: lighter week (one set fewer, 10% lighter)
//   maintain: specific phase (weights held, one set fewer on big leg lifts)
//   noHeavyLegs: after week 28 (calves, ankles, hips and upper only)
function planGymMode(date) {
  const w = planWeekOf(date);
  const r = planWeek(w);
  if (!r) return null;
  const k = planPhase(w);
  return {
    w, phase: k, phaseName: planPhaseName(w),
    deload: r.type === 'deload' || ['taper', 'race', 'recovery'].includes(k),
    maintain: k === 'specific' && r.type !== 'deload',
    noHeavyLegs: w > 28 && w <= 31,
  };
}

function planDaysTo(iso, now) { return Math.round((planDate(iso) - planMidnight(now)) / PLAN_DAY_MS); }
