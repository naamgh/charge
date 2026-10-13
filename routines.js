// Charge routines. Edit freely: this file is the whole programme.
//
// Built from the running-economy research: heavy lifting (5 reps or fewer, about 80%+ of max)
// and plyometrics improve running economy; moderate 8-20 rep work and isometrics on their own do not.
// So each session goes: tendon prep, plyos while fresh, one heavy main lift, then single-leg,
// calf and hip work. Heavy sets stop 2-3 reps short of failure (RPE 7-8).
//
// sets/reps = full (green) prescription. step = weight added when you earn progression.
// legs: true = trimmed by one set on amber days.
// impact: true = plyometric. Dropped completely on amber and red days.
// perSide: reps are per leg/side. rest in seconds.
// hold: true = isometric, reps are seconds held. Grows by holdStep up to holdMax, then adds weight.
// repStep/repMax: bodyweight moves that progress by adding reps (contacts) instead of weight.
// bw: true = starts at bodyweight (0 kg) instead of asking for a weight.
// upper: true = kept on red days.
// cue: one line shown under the exercise.
// fit: [category, exercise] from Garmin's FIT exercise list. Strava uses it for the muscle map.

const EXERCISES = {
  // Plyometrics
  pogo_hops:       { name: 'Pogo Hops',              sets: 3, reps: 20, step: 0,   rest: 60,  impact: true, bw: true, repStep: 5, repMax: 40,
                     cue: 'Stiff ankles, quick light contacts, knees nearly straight. Quality over height.', fit: ['cardio', 'jumpRope'] },
  drop_jump:       { name: 'Drop Jump',              sets: 3, reps: 5,  step: 0,   rest: 90,  impact: true, bw: true, repStep: 1, repMax: 8,
                     cue: 'Step off a 20-30 cm box, land and rebound straight up as fast as you can.', fit: ['plyo', 'depthJump'] },

  // Heavy main lifts
  deadlift:        { name: 'Deadlift',               sets: 4, reps: 5,  step: 5,   rest: 180, legs: true,
                     cue: 'Heavy. Stop with 2-3 good reps left. Never grind.', fit: ['deadlift', 'barbellDeadlift'] },
  hack_squat:      { name: 'Hack Squat',             sets: 4, reps: 5,  step: 5,   rest: 180, legs: true,
                     cue: 'Heavy. Controlled down, drive up. Stop with 2-3 reps left.', fit: ['squat', 'barbellHackSquat'] },

  // Secondary strength
  hip_thrust:      { name: 'Hip Thrust',             sets: 3, reps: 6,  step: 5,   rest: 120, legs: true, fit: ['hipRaise', 'barbellHipThrustWithBench'] },
  sl_rdl:          { name: 'Single Leg RDL',         sets: 3, reps: 6,  step: 2,   rest: 90,  legs: true, perSide: true,
                     cue: 'Hips square, slow lower. Balance is part of the job.', fit: ['deadlift', 'singleLegRomanianDeadliftWithDumbbell'] },
  bulgarian:       { name: 'Bulgarian Split Squat',  sets: 3, reps: 6,  step: 2,   rest: 90,  legs: true, perSide: true, fit: ['lunge', 'dumbbellBulgarianSplitSquat'] },

  // Calves and shins: the soleus takes the biggest load of any muscle when you run
  sl_calf:         { name: 'Single Leg Calf Raise',  sets: 3, reps: 8,  step: 2,   rest: 75,  perSide: true,
                     cue: 'Straight knee, full range, 2 s pause at the top. Load it up.', fit: ['calfRaise', 'singleLegStandingDumbbellCalfRaise'] },
  soleus:          { name: 'Seated Calf Raise',      sets: 3, reps: 8,  step: 5,   rest: 75,
                     cue: 'Bent knee targets the soleus. Go heavy, slow on the way down.', fit: ['calfRaise', 'weightedSeatedCalfRaise'] },
  tib_raise:       { name: 'Tibialis Raise',         sets: 2, reps: 15, step: 1,   rest: 45, fit: ['calfRaise', 'seatedDumbbellToeRaise'] },

  // Isometrics: tendon prep and joint stability, not the main driver of speed
  spanish_squat:   { name: 'Spanish Squat Hold',     sets: 3, reps: 45, step: 5,   rest: 60,  hold: true, holdStep: 5, holdMax: 60, bw: true,
                     cue: 'Warm-up for the knees before the heavy squat. Shins vertical, sit back into the band.', fit: ['squat', 'bodyWeightWallSquat'] },
  soleus_hold:     { name: 'Bent Knee Calf Hold',    sets: 2, reps: 45, step: 5,   rest: 45,  hold: true, holdStep: 5, holdMax: 60, bw: true, perSide: true, fit: ['calfRaise', 'singleLegBentKneeCalfRaise'] },
  sl_bridge_hold:  { name: 'Single Leg Bridge Hold', sets: 2, reps: 30, step: 2,   rest: 45,  hold: true, holdStep: 5, holdMax: 45, bw: true, perSide: true, fit: ['hipRaise', 'singleLegHipRaise'] },
  copenhagen:      { name: 'Copenhagen Plank',       sets: 2, reps: 20, step: 2,   rest: 45,  hold: true, holdStep: 5, holdMax: 40, bw: true, perSide: true,
                     cue: 'Start with the knee on the bench. Move to the foot once 40 s is easy.', fit: ['hipStability', 'slidingHipAdduction'] },

  // Mobility and small stuff
  hip_flexor:      { name: 'Hip Flexor Raise',       sets: 2, reps: 10, step: 1,   rest: 45,  perSide: true, fit: ['legRaise', 'lyingStraightLegRaise'] },
  cossack:         { name: 'Cossack Squat',          sets: 2, reps: 6,  step: 2,   rest: 45,  perSide: true, fit: ['lunge', 'weightedSideLunge'] },

  // Upper body: light maintenance, last in the session
  db_bench:        { name: 'DB Bench Press',         sets: 2, reps: 8,  step: 2,   rest: 75,  upper: true, fit: ['benchPress', 'dumbbellBenchPress'] },
  cable_row:       { name: 'Seated Cable Row',       sets: 2, reps: 10, step: 2.5, rest: 75,  upper: true, fit: ['row', 'seatedCableRow'] },

  // ---------- Alternatives (swap in on the day) ----------
  skipping:        { name: 'Skipping',               sets: 3, reps: 60, step: 0,   rest: 60,  impact: true, bw: true, repStep: 10, repMax: 120,
                     cue: 'Count single contacts. Bouncy and quiet on the balls of your feet.', fit: ['cardio', 'jumpRope'] },
  sl_pogo:         { name: 'Single Leg Pogo',        sets: 3, reps: 10, step: 0,   rest: 60,  impact: true, bw: true, perSide: true, repStep: 2, repMax: 20,
                     cue: 'Harder version of pogos. Stiff ankle, quick contacts.', fit: ['cardio', 'jumpRope'] },
  box_jump:        { name: 'Box Jump',               sets: 3, reps: 5,  step: 0,   rest: 90,  impact: true, bw: true, repStep: 1, repMax: 8,
                     cue: 'Jump up, step down. Land soft and quiet.', fit: ['plyo', 'boxJump'] },
  squat_jump:      { name: 'Squat Jump',             sets: 3, reps: 6,  step: 0,   rest: 90,  impact: true, bw: true, repStep: 1, repMax: 10,
                     cue: 'Quarter squat, explode up, reset between reps.', fit: ['plyo', 'bodyWeightJumpSquat'] },
  lateral_bound:   { name: 'Lateral Bound',          sets: 3, reps: 5,  step: 0,   rest: 75,  impact: true, bw: true, perSide: true, repStep: 1, repMax: 8,
                     cue: 'Push sideways off one leg, stick the landing on the other.', fit: ['plyo', 'lateralLeapAndHop'] },

  trap_bar_dl:     { name: 'Trap Bar Deadlift',      sets: 4, reps: 5,  step: 5,   rest: 180, legs: true,
                     cue: 'Heavy. Stop with 2-3 good reps left.', fit: ['deadlift', 'trapBarDeadlift'] },
  rdl:             { name: 'Romanian Deadlift',      sets: 4, reps: 6,  step: 5,   rest: 150, legs: true,
                     cue: 'Hips back, soft knees, bar close. Stop at mid-shin.', fit: ['deadlift', 'romanianDeadlift'] },

  v_squat:         { name: 'V-Squat',                sets: 4, reps: 5,  step: 5,   rest: 180, legs: true,
                     cue: 'Heavy. Stop with 2-3 good reps left.', fit: ['squat', 'backSquats'] },
  back_squat:      { name: 'Back Squat',             sets: 4, reps: 5,  step: 2.5, rest: 180, legs: true,
                     cue: 'Heavy. Brace hard, own the depth. Stop with 2-3 reps left.', fit: ['squat', 'barbellBackSquat'] },
  leg_press:       { name: 'Leg Press',              sets: 4, reps: 6,  step: 10,  rest: 150, legs: true,
                     cue: 'Heavy. Full range without the lower back peeling off the pad.', fit: ['squat', 'legPress'] },
  goblet_squat:    { name: 'Goblet Squat',           sets: 3, reps: 8,  step: 2,   rest: 90,  legs: true,
                     cue: 'Lighter fallback. Your arms will limit the load, so treat it as a lighter day.', fit: ['squat', 'gobletSquat'] },

  smith_hip_thrust:{ name: 'Smith Hip Thrust',       sets: 3, reps: 6,  step: 5,   rest: 120, legs: true, fit: ['hipRaise', 'barbellHipThrustWithBench'] },
  glute_bridge:    { name: 'Barbell Glute Bridge',   sets: 3, reps: 8,  step: 5,   rest: 90,  legs: true, fit: ['hipRaise', 'barbellHipThrustOnFloor'] },
  b_stance_rdl:    { name: 'B-Stance RDL',           sets: 3, reps: 8,  step: 2,   rest: 90,  legs: true, perSide: true,
                     cue: 'Back foot is a kickstand only. Most of the weight on the front leg.', fit: ['deadlift', 'romanianDeadlift'] },

  reverse_lunge:   { name: 'Reverse Lunge',          sets: 3, reps: 8,  step: 2,   rest: 90,  legs: true, perSide: true,
                     cue: 'Step back, drop the back knee, drive through the front heel.', fit: ['lunge', 'dumbbellReverseLunge'] },
  step_up:         { name: 'Step Up',                sets: 3, reps: 8,  step: 2,   rest: 90,  legs: true, perSide: true,
                     cue: 'Knee-height box. Drive up through the top leg, no push off the bottom one.', fit: ['squat', 'dumbbellStepUp'] },
  sl_leg_press:    { name: 'Single Leg Leg Press',   sets: 3, reps: 8,  step: 5,   rest: 90,  legs: true, perSide: true, fit: ['squat', 'legPress'] },

  standing_calf:   { name: 'Standing Calf Machine',  sets: 3, reps: 8,  step: 5,   rest: 75,
                     cue: 'Straight knee, full stretch at the bottom, 2 s pause at the top.', fit: ['calfRaise', 'weightedStandingCalfRaise'] },
  sl_bent_calf:    { name: 'Bent Knee Calf Raise',   sets: 3, reps: 10, step: 2,   rest: 60,  perSide: true,
                     cue: 'Dumbbell in hand, knee bent about 30 degrees the whole time.', fit: ['calfRaise', 'weightedSingleLegBentKneeCalfRaise'] },
  tib_wall:        { name: 'Wall Tib Raise',         sets: 2, reps: 20, step: 0,   rest: 45,  bw: true, repStep: 5, repMax: 30,
                     cue: 'Back on the wall, heels out, lift the toes. Further out = harder.', fit: ['calfRaise', 'seatedDumbbellToeRaise'] },

  wall_sit:        { name: 'Wall Sit',               sets: 3, reps: 45, step: 5,   rest: 60,  hold: true, holdStep: 5, holdMax: 60, bw: true, fit: ['squat', 'bodyWeightWallSquat'] },
  split_hold:      { name: 'Split Squat Hold',       sets: 2, reps: 30, step: 2,   rest: 45,  hold: true, holdStep: 5, holdMax: 45, bw: true, perSide: true,
                     cue: 'Bottom of a split squat, front knee over toes. Breathe.', fit: ['lunge', 'barbellSplitSquat'] },
  adductor_machine:{ name: 'Adductor Machine',       sets: 3, reps: 10, step: 5,   rest: 60, fit: ['hipStability', 'weightedStandingAdduction'] },
  sl_hip_thrust:   { name: 'Single Leg Hip Thrust',  sets: 2, reps: 8,  step: 2,   rest: 60,  perSide: true, fit: ['hipRaise', 'weightedSingleLegHipRaise'] },
  hanging_knee:    { name: 'Hanging Knee Raise',     sets: 2, reps: 10, step: 0,   rest: 45,  bw: true, repStep: 2, repMax: 15, fit: ['legRaise', 'hangingKneeRaise'] },

  bench_press:     { name: 'Barbell Bench Press',    sets: 2, reps: 6,  step: 2.5, rest: 90,  upper: true, fit: ['benchPress', 'barbellBenchPress'] },
  push_up:         { name: 'Push Up',                sets: 2, reps: 12, step: 0,   rest: 60,  upper: true, bw: true, repStep: 2, repMax: 25, fit: ['pushUp', 'pushUp'] },
  db_row:          { name: 'Dumbbell Row',           sets: 2, reps: 10, step: 2,   rest: 60,  upper: true, perSide: true, fit: ['row', 'dumbbellRow'] },
  lat_pulldown:    { name: 'Lat Pulldown',           sets: 2, reps: 10, step: 2.5, rest: 75,  upper: true, fit: ['pullUp', 'latPulldown'] },
  pull_up:         { name: 'Pull Up',                sets: 2, reps: 6,  step: 0,   rest: 90,  upper: true, bw: true, repStep: 1, repMax: 12, fit: ['pullUp', 'pullUp'] },
};

// Exercises that can stand in for each other. Tap "Swap" on any exercise in a session
// to pick another from its group. Each one keeps its own history and progression.
const SWAPS = [
  ['pogo_hops', 'skipping', 'sl_pogo'],
  ['drop_jump', 'box_jump', 'squat_jump', 'lateral_bound'],
  ['deadlift', 'trap_bar_dl', 'rdl'],
  ['hack_squat', 'v_squat', 'back_squat', 'leg_press', 'goblet_squat'],
  ['hip_thrust', 'smith_hip_thrust', 'glute_bridge'],
  ['sl_rdl', 'b_stance_rdl'],
  ['bulgarian', 'reverse_lunge', 'step_up', 'sl_leg_press'],
  ['sl_calf', 'standing_calf'],
  ['soleus', 'sl_bent_calf'],
  ['tib_raise', 'tib_wall'],
  ['spanish_squat', 'wall_sit', 'split_hold'],
  ['soleus_hold', 'sl_bent_calf'],
  ['copenhagen', 'adductor_machine'],
  ['sl_bridge_hold', 'sl_hip_thrust'],
  ['hip_flexor', 'hanging_knee'],
  ['db_bench', 'bench_press', 'push_up'],
  ['cable_row', 'db_row', 'lat_pulldown', 'pull_up'],
];

const ROUTINES = {
  A: {
    name: 'Hip Dominant',
    day: 2, // Tuesday (0 = Sunday)
    exercises: ['pogo_hops', 'deadlift', 'hip_thrust', 'sl_rdl', 'sl_calf', 'copenhagen', 'sl_bridge_hold', 'hip_flexor'],
  },
  B: {
    name: 'Knee Dominant',
    day: 3, // Wednesday
    exercises: ['spanish_squat', 'drop_jump', 'hack_squat', 'bulgarian', 'soleus', 'soleus_hold', 'tib_raise', 'db_bench', 'cable_row'],
  },
};

// Red day: legs are flat. Keep the habit, protect the next run.
// No impact, no heavy lifting. Ankle, calf and hip work plus any upper moves from the routine.
const RESET = {
  name: 'Reset',
  exercises: [
    { id: 'sl_calf',        sets: 2, reps: 12, bodyweight: true },
    { id: 'tib_raise',      sets: 2, reps: 15 },
    { id: 'hip_flexor',     sets: 2, reps: 10 },
    { id: 'cossack',        sets: 2, reps: 6,  bodyweight: true },
    { id: 'soleus_hold',    sets: 2, reps: 30, bodyweight: true },
    { id: 'sl_bridge_hold', sets: 2, reps: 30, bodyweight: true },
  ],
};

// Your week. Used to tick "Key run tomorrow" automatically.
// 0 = Sunday ... 6 = Saturday
const WEEK = {
  keyRunDays: [6], // Saturday long run
};
