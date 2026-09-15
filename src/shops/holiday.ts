const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weekdayInTz(d: Date, tz = 'Asia/Kolkata') {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d);
  const i = DOW.indexOf(short);
  return i >= 0 ? i : d.getDay();
}

export function ymdInTz(d: Date, tz = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function isShopHoliday(d: Date, closedWeekdays: number[], tz = 'Asia/Kolkata') {
  return closedWeekdays.includes(weekdayInTz(d, tz));
}

/** Next calendar day that is not a weekly off (includes `from` if open). */
export function nextOpenDay(from: Date, closedWeekdays: number[], tz = 'Asia/Kolkata') {
  const d = new Date(from.getTime());
  for (let i = 0; i < 8; i++) {
    if (!isShopHoliday(d, closedWeekdays, tz)) return d;
    d.setTime(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return d;
}

/** 09:00 shop-local on the appointment's calendar day, then skip weekly offs. */
export function remindAtFor(
  startAt: Date,
  shop: { openHour: number; closedWeekdays: number[]; timezone?: string | null },
) {
  const tz = shop.timezone || 'Asia/Kolkata';
  const ymd = ymdInTz(startAt, tz);
  const hour = Math.min(Math.max(shop.openHour, 7), 10);
  const hh = String(hour).padStart(2, '0');
  const offset = tz === 'Asia/Kolkata' ? '+05:30' : '+05:30';
  let remind = new Date(`${ymd}T${hh}:00:00${offset}`);
  if (Number.isNaN(remind.getTime())) remind = new Date(startAt);
  return nextOpenDay(remind, shop.closedWeekdays ?? [], tz);
}
