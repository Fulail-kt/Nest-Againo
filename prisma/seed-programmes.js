require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MOVES = [
  ['Barbell Bench Press', 'Chest', 4, 8, 90],
  ['Incline Dumbbell Press', 'Chest', 3, 10, 75],
  ['Overhead Press', 'Shoulders', 3, 8, 90],
  ['Lateral Raise', 'Shoulders', 3, 12, 45],
  ['Tricep Pushdown', 'Triceps', 3, 12, 45],
  ['Lat Pulldown', 'Back', 4, 10, 75],
  ['Barbell Row', 'Back', 4, 8, 90],
  ['Face Pull', 'Back', 3, 15, 45],
  ['Barbell Curl', 'Biceps', 3, 10, 45],
  ['Back Squat', 'Legs', 4, 8, 120],
  ['Romanian Deadlift', 'Legs', 3, 10, 90],
  ['Leg Press', 'Legs', 3, 12, 75],
  ['Walking Lunge', 'Legs', 3, 10, 60],
  ['Calf Raise', 'Calves', 3, 15, 45],
  ['Plank', 'Core', 3, 30, 30],
  ['Deadlift', 'Back', 4, 5, 150],
  ['Goblet Squat', 'Legs', 3, 12, 60],
  ['Push-up', 'Chest', 3, 12, 45],
];

const PROGRAMMES = [
  {
    name: 'Push Pull Legs',
    mode: 'REPEAT',
    days: [
      ['Push', ['Barbell Bench Press', 'Incline Dumbbell Press', 'Overhead Press', 'Lateral Raise', 'Tricep Pushdown']],
      ['Pull', ['Deadlift', 'Lat Pulldown', 'Barbell Row', 'Face Pull', 'Barbell Curl']],
      ['Legs', ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Walking Lunge', 'Calf Raise']],
    ],
  },
  {
    name: 'Full Body Starter',
    mode: 'REPEAT',
    days: [
      ['Day A', ['Goblet Squat', 'Push-up', 'Lat Pulldown', 'Plank']],
      ['Day B', ['Romanian Deadlift', 'Overhead Press', 'Barbell Row', 'Calf Raise']],
      ['Day C', ['Back Squat', 'Barbell Bench Press', 'Face Pull', 'Barbell Curl']],
    ],
  },
  {
    name: '4-Week Strength Block',
    mode: 'FIXED',
    days: [
      ['Week 1 — Squat focus', ['Back Squat', 'Romanian Deadlift', 'Walking Lunge', 'Plank']],
      ['Week 2 — Press focus', ['Barbell Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Tricep Pushdown']],
      ['Week 3 — Pull focus', ['Deadlift', 'Barbell Row', 'Lat Pulldown', 'Face Pull']],
      ['Week 4 — Mixed', ['Back Squat', 'Barbell Bench Press', 'Barbell Row', 'Plank']],
    ],
  },
];

const spec = Object.fromEntries(MOVES.map((m) => [m[0], m]));

async function exerciseId(client, gymId, name) {
  const [n, muscle, sets, reps, rest] = spec[name];
  const found = await client.query(
    'SELECT id FROM "Exercise" WHERE "gymId" = $1 AND name = $2',
    [gymId, n],
  );
  if (found.rows[0]) return found.rows[0].id;
  const created = await client.query(
    `INSERT INTO "Exercise" ("gymId", name, "muscleGroup", "defaultSets", "defaultReps", "defaultRestSeconds", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
    [gymId, n, muscle, sets, reps, rest],
  );
  return created.rows[0].id;
}

async function main() {
  const gyms = (await pool.query('SELECT id, name FROM "Gym"')).rows;
  if (!gyms.length) {
    console.log('No gyms. Register admin first, then re-run.');
    return;
  }

  for (const gym of gyms) {
    for (const move of MOVES) await exerciseId(pool, gym.id, move[0]);

    for (const prog of PROGRAMMES) {
      const exists = await pool.query(
        'SELECT id FROM "Programme" WHERE "gymId" = $1 AND name = $2',
        [gym.id, prog.name],
      );
      if (exists.rows[0]) {
        console.log('skip', gym.name, '/', prog.name);
        continue;
      }

      const p = await pool.query(
        `INSERT INTO "Programme" ("gymId", name, mode, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`,
        [gym.id, prog.name, prog.mode],
      );
      const programmeId = p.rows[0].id;

      for (let i = 0; i < prog.days.length; i++) {
        const [dayName, moves] = prog.days[i];
        const d = await pool.query(
          `INSERT INTO "ProgrammeDay" ("programmeId", name, "order")
           VALUES ($1, $2, $3) RETURNING id`,
          [programmeId, dayName, i],
        );
        for (let j = 0; j < moves.length; j++) {
          const exId = await exerciseId(pool, gym.id, moves[j]);
          const [, , sets, reps, rest] = spec[moves[j]];
          await pool.query(
            `INSERT INTO "ProgrammeExercise" ("dayId", "exerciseId", "order", sets, reps, "restSeconds")
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [d.rows[0].id, exId, j, sets, reps, rest],
          );
        }
      }
      console.log('added', gym.name, '/', prog.name);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
