export function calendarLocalParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
export function calendarZonedDate(date: string, time: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Invalid event time');
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 10) !== date) throw new Error("Invalid event time");
  let guess = target;
  for (let i=0; i<4; i++) {
    const local = calendarLocalParts(new Date(guess), timeZone);
    const offset = Date.parse(`${local.date}T${local.time}:00Z`) - target;
    if (offset === 0) return new Date(guess);
    guess -= offset;
  }
  throw new Error("This time does not exist due to daylight saving time. Choose another time.");
}
