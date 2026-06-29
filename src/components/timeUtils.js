export const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeValue(value) {
  return timePattern.test(String(value || ''));
}
