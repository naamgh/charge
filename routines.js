// Charge routines. Edit freely: this file is the whole programme.
// sets/reps = full (green) prescription. step = weight added when you earn progression.
// legs: true means the exercise is trimmed on amber days.
// perSide: reps are per leg/side. rest in seconds.

const EXERCISES = {
  hip_thrust:      { name: 'Hip Thrust',            sets: 3, reps: 10, step: 5,   rest: 120, legs: true },
  sl_rdl:          { name: 'Single Leg RDL',        sets: 3, reps: 8,  step: 2,   rest: 90,  legs: true, perSide: true },
  cossack:         { name: 'Cossack Squat',         sets: 3, reps: 6,  step: 2,   rest: 75,  legs: true, perSide: true },
  hip_flexor:      { name: 'Hip Flexor Raise',      sets: 2, reps: 10, step: 1,   rest: 60,  legs: false, perSide: true },
  sl_calf:         { name: 'Single Leg Calf Raise', sets: 3, reps: 12, step: 2,   rest: 60,  legs: false, perSide: true },
  hack_squat:      { name: 'Hack Squat',            sets: 3, reps: 8,  step: 5,   rest: 150, legs: true },
  bulgarian:       { name: 'Bulgarian Split Squat', sets: 3, reps: 8,  step: 2,   rest: 90,  legs: true, perSide: true },
  soleus:          { name: 'Soleus Raise (seated)', sets: 3, reps: 12, step: 5,   rest: 60,  legs: false },
  tib_raise:       { name: 'Tibialis Raise',        sets: 2, reps: 15, step: 1,   rest: 45,  legs: false },
  db_bench:        { name: 'DB Bench Press',        sets: 3, reps: 8,  step: 2,   rest: 90,  legs: false },
  cable_row:       { name: 'Seated Cable Row',      sets: 3, reps: 10, step: 2.5, rest: 90,  legs: false },
};

const ROUTINES = {
  A: {
    name: 'Hip Dominant',
    day: 2, // Tuesday (0 = Sunday)
    exercises: ['hip_thrust', 'sl_rdl', 'cossack', 'hip_flexor', 'sl_calf'],
  },
  B: {
    name: 'Knee Dominant + Upper',
    day: 3, // Wednesday
    exercises: ['hack_squat', 'bulgarian', 'soleus', 'tib_raise', 'db_bench', 'cable_row'],
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
  ],
};

// Your week. Used to warn when a key run is the day after a gym session.
// 0 = Sunday ... 6 = Saturday
const WEEK = {
  keyRunDays: [6], // Saturday long run
};
