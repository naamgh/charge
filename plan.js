// Training plan: Sub-2 Half, Sydney 2027. Monday 5 Oct 2026 is week 1.
// [week, tue km, thu km, thu session, sat km, kind]  kind: deload | gate | race
const PLAN_START = '2026-10-05';
const PLAN = [
  [1,5,5,"Easy with 4 strides",8,""],[2,5,6,"Easy with 6 strides",9,""],[3,6,6,"Easy with 6 strides",10,""],[4,5,5,"Easy with 4 strides",8,"deload"],
  [5,6,7,"Easy with 6 hill sprints",11,""],[6,7,7,"Easy with 8 hill sprints",12,""],[7,7,8,"3 x 8 min steady at 5:55",13,""],[8,6,6,"Easy with 4 strides",10,"deload"],
  [9,7,8,"4 x 4 min at 5:20",14,""],[10,6,13,"10k time trial",10,"gate"],[11,7,8,"20 min tempo at 5:35",15,""],[12,6,6,"Easy with 4 strides",10,"deload"],
  [13,7,8,"4 x 5 min at 5:30",14,""],[14,7,9,"3 x 8 min at 5:30",15,""],[15,7,10,"4 x 8 min at 5:30",16,""],[16,6,7,"Easy with 6 strides",12,"deload"],
  [17,8,10,"5 x 6 min at 5:25",17,""],[18,8,10,"3 x 2 km at 5:30",18,""],[19,8,10,"6 x 1 km at 5:20",18,""],[20,6,8,"20 min steady at 5:45",13,"deload"],
  [21,8,13,"10k tune-up or time trial",14,"gate"],[22,8,10,"2 x 3 km at 5:35",19,""],[23,8,13,"3 x 3 km at 5:35",20,""],[24,7,9,"6 km at 5:38 steady",14,"deload"],
  [25,8,11,"8 km at 5:38 controlled",18,"gate"],[26,8,13,"3 x 3 km at 5:38",20,""],[27,8,13,"10 km at 5:38 continuous",18,""],[28,7,10,"2 x 3 km at 5:38",14,""],
  [29,6,8,"4 x 1 km at 5:38",10,""],[30,5,5,"Easy with 4 strides at race pace",3,"race"],
  [31,6,6,"Easy only",8,"deload"],[32,8,10,"2 x 3 km at 5:35",16,""],[33,8,13,"3 x 3 km at 5:35",18,""],[34,8,13,"10 km at 5:38 continuous",18,""],
  [35,8,11,"8 km at 5:35",16,""],[36,6,8,"4 x 1 km at 5:38",10,""],[37,5,5,"Easy with 4 strides at race pace",3,"race"],
];

function planPhase(w) {
  return w <= 4 ? 'Reset' : w <= 13 ? 'Base' : w <= 23 ? 'Build' : w <= 28 ? 'Specific' : w <= 30 ? 'Taper' : w === 31 ? 'Recovery' : w <= 35 ? 'Second shot' : 'Taper';
}

// What the plan asks for on a given day. Returns null outside the plan (before 5 Oct 2026 or after week 37).
function planDay(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const s = new Date(PLAN_START + 'T00:00:00');
  const n = Math.round((d - s) / 864e5);
  if (n < 0 || n >= PLAN.length * 7) return null;
  const week = Math.floor(n / 7) + 1, dow = n % 7, r = PLAN[week - 1];
  const out = { week, total: PLAN.length, phase: planPhase(week), kind: r[5], run: null, key: false, other: null };
  if (dow === 1) out.run = { km: r[1], text: 'Easy run with strides, after gym' };
  else if (dow === 3) { out.run = { km: r[2], text: r[3] }; out.key = !/^easy/i.test(r[3]); }
  else if (dow === 5) { out.run = { km: r[4], text: 'Long run' }; out.key = true; }
  else if (dow === 6 && r[5] === 'race') { out.run = { km: 21.1, text: 'Race day' }; out.key = true; }
  else out.other = ['Rest', null, 'Gym + indoor bike', null, 'Tempo group ride', null, 'Long group ride'][dow];
  // Gym drops to maintenance on down weeks and from week 24 to the race, and again in the Parramatta taper.
  out.gymLight = r[5] === 'deload' || (week >= 24 && week <= 30) || week >= 36;
  return out;
}
