export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Calendar day in server local time: YYYY-MM-DD */
export function dayKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function weekday(d: Date = new Date()) {
  return d.getDay();
}

export function normalizeOpenDays(days: number[]) {
  const unique = [...new Set(days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
  unique.sort((a, b) => a - b);
  return unique;
}

export function isGymOpen(openDays: number[], d: Date = new Date()) {
  return openDays.includes(weekday(d));
}

export function addDays(d: Date, n: number) {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return next;
}

export type StreakCellState = 'done' | 'missed' | 'rest' | 'today';

/** Oldest → newest, including today. Closed gym days are rest (do not break streak). */
export function streakCells(
  openDays: number[],
  doneKeys: Set<string>,
  today: Date,
  daysBack = 83,
): { date: string; state: StreakCellState }[] {
  const todayKey = dayKey(today);
  const cells: { date: string; state: StreakCellState }[] = [];
  for (let i = daysBack; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = dayKey(d);
    if (!isGymOpen(openDays, d)) cells.push({ date: key, state: 'rest' });
    else if (doneKeys.has(key)) cells.push({ date: key, state: 'done' });
    else if (key === todayKey) cells.push({ date: key, state: 'today' });
    else cells.push({ date: key, state: 'missed' });
  }
  return cells;
}

export function countStreaks(cells: { state: StreakCellState }[]) {
  let best = 0;
  let run = 0;
  for (const c of cells) {
    if (c.state === 'rest' || c.state === 'today') continue;
    if (c.state === 'done') {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  let current = 0;
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    if (c.state === 'rest' || c.state === 'today') continue;
    if (c.state === 'done') current += 1;
    else break;
  }
  return { current, best };
}

export function nextOpenDate(openDays: number[], from: Date = new Date()) {
  if (openDays.length === 0) return null;
  for (let i = 0; i < 14; i++) {
    const d = addDays(from, i);
    if (isGymOpen(openDays, d)) return d;
  }
  return null;
}

export function monthGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: { date: string; weekday: number; inMonth: boolean }[] = [];
  for (let i = 0; i < first.getDay(); i++) {
    cells.push({ date: '', weekday: i, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    cells.push({ date: dayKey(d), weekday: d.getDay(), inMonth: true });
  }
  return cells;
}
