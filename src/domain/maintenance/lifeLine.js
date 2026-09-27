import { shiftDay, today } from './types.js';
import { maintenanceBars, operatingSegments } from './view.js';

export function buildLifeLine(events, endDate = today()) {
  const days = Array.from({ length: 14 }, (_, index) => shiftDay(endDate, index - 13));
  const from = days[0];
  const maintenance = maintenanceBars(events, from, endDate, endDate);
  const operation = operatingSegments(events, from, endDate).map(item => ({ ...item, column: days.indexOf(item.start) + 1, span: days.indexOf(item.end) - days.indexOf(item.start) + 1 }));
  return { days, maintenance, operation, hasUnconfirmedDays: maintenance.some(item => item.unconfirmed) || days.some(day =>
    !maintenance.some(item => item.start <= day && item.end >= day)
    && !operation.some(item => item.start <= day && item.end >= day)) };
}
