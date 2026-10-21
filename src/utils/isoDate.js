const { z } = require("zod");

/**
 * True when a "YYYY-MM-DD" string names a day that exists on the calendar.
 * Date.UTC silently rolls invalid days forward (2026-02-31 → 2026-03-03),
 * so round-tripping the parts and comparing catches impossible dates.
 */
function isCalendarDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Zod schema for a "YYYY-MM-DD" date string that must also be a real date.
 * The format check aborts on failure so a malformed value reports one
 * error, not a format error plus a calendar error.
 *
 * @param {string} label  Field name used in error messages, e.g. "Date", "from"
 */
function isoDate(label) {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: `${label} must be in YYYY-MM-DD format`, abort: true })
    .refine(isCalendarDate, { message: `${label} must be a real calendar date` });
}

module.exports = { isoDate };
