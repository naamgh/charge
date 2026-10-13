// Charge routines. Edit freely: this file is the whole programme.
// sets/reps = full (green) prescription. step = weight added when you earn progression.
// legs: true means the exercise is trimmed on amber days.
// perSide: reps are per leg/side. rest in seconds.
// hold: true means an isometric. reps = seconds held. Progresses by holdStep seconds up to holdMax, then adds weight.
// bw: true means it starts at bodyweight (0 kg) instead of asking for a weight.
// fit: [category, exercise] from Garmin's FIT exercise list. Strava uses it to draw the muscle map.

const EXERCISES = {
  hip_thrust:      { name: 'Hip Thrust',            sets: 3, reps: 10, step: 5,   rest: 120, legs: true, fit: ['hipRaise', 'barbellHipThrustWithBench'] },
  sl_rdl:          { name: 'Single Leg RDL',        sets: 3, reps: 8,  step: 2,   rest: 90,  legs: true, perSide: true, fit: ['deadlift', 'singleLegRomanianDeadliftWithDumbbell'] },
  cossack:         { name: 'Cossack Squat',         sets: 3, reps: 6,  step: 2,   rest: 75,  legs: true, perSide: true, fit: ['lunge', 'weightedSideLunge'] },
  hip_flexor:      { name: 'Hip Flexor Raise',      sets: 2, reps: 10, step: 1,   rest: 60,  legs: false, perSide: true, fit: ['legRaise', 'lyingStraightLegRaise'] },
  sl_calf:         { name: 'Single Leg Calf Raise', sets: 3, reps: 12, step: 2,   rest: 60,  legs: false, perSide: true, fit: ['calfRaise', 'singleLegStandingDumbbellCalfRaise'] },
  hack_squat:      { name: 'Hack Squat',            sets: 3, reps: 8,  step: 5,   rest: 150, legs: true, fit: ['squat', 'barbellHackSquat'] },
  bulgarian:       { name: 'Bulgarian Split Squat', sets: 3, reps: 8,  step: 2,   rest: 90,  legs: true, perSide: true, fit: ['lunge', 'dumbbellBulgarianSplitSquat'] },
  soleus:          { name: 'Soleus Raise (seated)', sets: 3, reps: 12, step: 5,   rest: 60,  legs: false, fit: ['calfRaise', 'weightedSeatedCalfRaise'] },
  tib_raise:       { name: 'Tibialis Raise',        sets: 2, reps: 15, step: 1,   rest: 45,  legs: false, fit: ['calfRaise', 'seatedDumbbellToeRaise'] },
  db_bench:        { name: 'DB Bench Press',        sets: 3, reps: 8,  step: 2,   rest: 90,  legs: false, upper: true, fit: ['benchPress', 'dumbbellBenchPress'] },
  // Run-specific isometrics
  spanish_squat:   { name: 'Spanish Squat Hold',    sets: 4, reps: 45, step: 5,   rest: 75,  legs: false, hold: true, holdStep: 5, holdMax: 60, bw: true, fit: ['squat', 'bodyWeightWallSquat'] },
  soleus_hold:     { name: 'Bent Knee Calf Hold',   sets: 3, reps: 45, step: 5,   rest: 45,  legs: false, hold: true, holdStep: 5, holdMax: 60, bw: true, perSide: true, fit: ['calfRaise', 'singleLegBentKneeCalfRaise'] },
  sl_bridge_hold:  { name: 'Single Leg Bridge Hold', sets: 3, reps: 30, step: 2,  rest: 45,  legs: false, hold: true, holdStep: 5, holdMax: 45, bw: true, perSide: true, fit: ['hipRaise', 'singleLegHipRaise'] },
  copenhagen:      { name: 'Copenhagen Plank',      sets: 2, reps: 20, step: 2,   rest: 45,  legs: false, hold: true, holdStep: 5, holdMax: 40, bw: true, perSide: true, fit: ['hipStability', 'slidingHipAdduction'] },
  cable_row:       { name: 'Seated Cable Row',      sets: 3, reps: 10, step: 2.5, rest: 90,  legs: false, upper: true, fit: ['row', 'seatedCableRow'] },
};

const ROUTINES = {
  A: {
    name: 'Hip Dominant',
    day: 2, // Tuesday (0 = Sunday)
    exercises: ['hip_thrust', 'sl_rdl', 'cossack', 'sl_bridge_hold', 'copenhagen', 'hip_flexor', 'sl_calf'],
  },
  B: {
    name: 'Knee Dominant + Upper',
    day: 3, // Wednesday
    exercises: ['spanish_squat', 'hack_squat', 'bulgarian', 'soleus', 'soleus_hold', 'tib_raise', 'db_bench', 'cable_row'],
  },
};

// Red day: legs are flat. Keep the habit, protect the next run.
// Low load, ankle and hip work only. Upper moves from the routine are kept.
const RESET = {
  name: 'Reset',
  exercises: [
    { id: 'sl_calf',    sets: 2, reps: 12 },
    { id: 'soleus',     sets: 2, reps: 15 },
    { id: 'tib_raise',  sets: 2, reps: 15 },
    { id: 'hip_flexor', sets: 2, reps: 10 },
    { id: 'cossack',    sets: 2, reps: 6, bodyweight: true },
    { id: 'soleus_hold',    sets: 2, reps: 30, bodyweight: true },
    { id: 'sl_bridge_hold', sets: 2, reps: 30, bodyweight: true },
  ],
};

// Your week. Used to warn when a key run is the day after a gym session.
// 0 = Sunday ... 6 = Saturday
const WEEK = {
  keyRunDays: [6], // Saturday long run
};
