import { isShopHoliday, nextOpenDay, weekdayInTz } from './holiday';

describe('holiday', () => {
  it('skips closed weekdays', () => {
    // 2026-09-13 is Sunday UTC morning; IST is still Sunday
    const sun = new Date('2026-09-13T03:30:00+05:30');
    expect(weekdayInTz(sun)).toBe(0);
    expect(isShopHoliday(sun, [0])).toBe(true);
    const next = nextOpenDay(sun, [0]);
    expect(isShopHoliday(next, [0])).toBe(false);
  });
});
