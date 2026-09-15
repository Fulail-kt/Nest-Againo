import {
  addDays,
  countStreaks,
  dayKey,
  isGymOpen,
  monthGrid,
  nextOpenDate,
  normalizeOpenDays,
  streakCells,
  weekday,
} from './day';

describe('day helpers', () => {
  const monday = new Date(2026, 8, 7); // Mon Sep 7 2026
  const sunday = new Date(2026, 8, 6);

  it('dayKey uses local calendar date', () => {
    expect(dayKey(monday)).toBe('2026-09-07');
  });

  it('weekday matches JS Date', () => {
    expect(weekday(sunday)).toBe(0);
    expect(weekday(monday)).toBe(1);
  });

  it('normalizeOpenDays unique sorted valid 0-6', () => {
    expect(normalizeOpenDays([6, 1, 1, 9, -1, 0])).toEqual([0, 1, 6]);
  });

  it('isGymOpen respects openDays', () => {
    expect(isGymOpen([1, 2, 3, 4, 5, 6], sunday)).toBe(false);
    expect(isGymOpen([1, 2, 3, 4, 5, 6], monday)).toBe(true);
    expect(isGymOpen([0], sunday)).toBe(true);
  });

  it('nextOpenDate skips closed days', () => {
    const next = nextOpenDate([1, 2, 3, 4, 5], sunday);
    expect(next && dayKey(next)).toBe('2026-09-07');
  });

  it('nextOpenDate returns null if gym never open', () => {
    expect(nextOpenDate([], monday)).toBeNull();
  });

  it('addDays stays date-only', () => {
    expect(dayKey(addDays(monday, 1))).toBe('2026-09-08');
  });

  it('monthGrid pads Sunday start', () => {
    const cells = monthGrid(2026, 9);
    expect(cells[0]).toEqual({ date: '', weekday: 0, inMonth: false });
    expect(cells.find((c) => c.date === '2026-09-01')?.weekday).toBe(2);
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30);
  });

  it('closed days do not break streak; missed open day does', () => {
    const today = new Date(2026, 8, 8); // Tue
    const open = [1, 2, 3, 4, 5];
    const done = new Set(['2026-09-07']); // Mon trained, Sun rest, Tue not yet
    const cells = streakCells(open, done, today, 3);
    expect(cells.map((c) => c.state)).toEqual(['rest', 'rest', 'done', 'today']);
    expect(countStreaks(cells)).toEqual({ current: 1, best: 1 });
  });

  it('missed open day resets current streak', () => {
    const today = new Date(2026, 8, 8);
    const cells = streakCells(
      [1, 2, 3, 4, 5],
      new Set(['2026-09-04']),
      today,
      4,
    );
    expect(countStreaks(cells).current).toBe(0);
    expect(countStreaks(cells).best).toBe(1);
  });
});
