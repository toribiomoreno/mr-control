export const calendarActivitySource = 'memoria de sesion del frontend';

export const initialCalendarActivities = [];

export const preventiveTurnDurations = {
  E: 1,
  A: 2,
  AB: 3,
  ABC: 6,
};

export const recurrenceLabels = {
  unica: 'Unica vez',
  semanal: 'Semanal',
  cada_2_semanas: 'Cada 2 semanas',
  cada_3_semanas: 'Cada 3 semanas',
  mensual: 'Mensual',
  cada_3_meses: 'Cada 3 meses',
  cada_6_meses: 'Cada 6 meses',
};

const recurrenceSteps = {
  semanal: { days: 7 },
  cada_2_semanas: { days: 14 },
  cada_3_semanas: { days: 21 },
  mensual: { months: 1 },
  cada_3_meses: { months: 3 },
  cada_6_meses: { months: 6 },
};

function asDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addInterval(value, recurrence) {
  const step = recurrenceSteps[recurrence];
  if (!step) return value;

  const next = asDate(value);
  if (step.days) next.setDate(next.getDate() + step.days);
  if (step.months) next.setMonth(next.getMonth() + step.months);
  return formatDate(next);
}

export function normalizeDate(value) {
  return String(value || '').slice(0, 10);
}

export function monthBounds(month) {
  const start = `${month}-01`;
  const endDate = asDate(start);
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(endDate.getDate() - 1);
  return { start, end: formatDate(endDate) };
}

export function yearBounds(year) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function rangesOverlap(startA, endA, startB, endB) {
  return startA <= endB && endA >= startB;
}

export function buildCampaignOccurrences(activity, rangeStart, rangeEnd) {
  const recurrence = activity.recurrence || 'unica';
  if (recurrence === 'unica') {
    return rangesOverlap(activity.startDate, activity.startDate, rangeStart, rangeEnd)
      ? [{ ...activity, date: activity.startDate, occurrenceId: `${activity.id}-${activity.startDate}`, occurrenceStart: activity.startDate, occurrenceEnd: activity.startDate }]
      : [];
  }

  const occurrences = [];
  let date = activity.startDate;
  let guard = 0;

  while (date && date <= rangeEnd && guard < 160) {
    if (date >= rangeStart) {
      occurrences.push({ ...activity, date, occurrenceId: `${activity.id}-${date}`, occurrenceStart: date, occurrenceEnd: date });
    }
    const next = addInterval(date, recurrence);
    if (next === date) break;
    date = next;
    guard += 1;
  }

  return occurrences;
}

export function buildActivityOccurrences(activity, rangeStart, rangeEnd) {
  if (activity.type === 'campana') {
    return buildCampaignOccurrences(activity, rangeStart, rangeEnd);
  }

  const start = normalizeDate(activity.startDate);
  const end = normalizeDate(activity.endDate || (activity.type === 'correctivo' ? rangeEnd : activity.startDate));
  if (!start || !rangesOverlap(start, end, rangeStart, rangeEnd)) return [];

  const visibleStart = start > rangeStart ? start : rangeStart;
  const visibleEnd = end < rangeEnd ? end : rangeEnd;

  if (activity.type === 'preventivo') {
    return [{ ...activity, date: start, occurrenceId: `${activity.id}-${start}`, occurrenceStart: start, occurrenceEnd: start }];
  }

  const occurrences = [];
  const cursor = asDate(visibleStart);
  const last = asDate(visibleEnd);

  while (cursor <= last) {
    const date = formatDate(cursor);
    occurrences.push({ ...activity, date, occurrenceId: `${activity.id}-${date}`, occurrenceStart: visibleStart, occurrenceEnd: visibleEnd });
    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences;
}

export function buildOccurrences(activities, rangeStart, rangeEnd) {
  return activities
    .flatMap((activity) => buildActivityOccurrences(activity, rangeStart, rangeEnd))
    .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.unit.localeCompare(b.unit));
}
