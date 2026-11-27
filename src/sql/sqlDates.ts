/**
 * @internal
 * Dates for toSqlWhere: a date of the filter read in the user's time zone, and the start and end of
 * its day or second as the database parameters.
 *
 * Two kinds of milliseconds are used, both whole seconds:
 * - an *instant*: a point in time, as `Date.getTime()`
 * - a *wall clock*: what a clock in the time zone shows, kept as the milliseconds `Date.UTC()` gives for
 *   it - so days and seconds can be added without a time zone getting in the way
 *
 * The grid compares the wall clock of the user's browser (`getFullYear()` ... `getSeconds()`), these
 * functions read the same wall clock in an IANA time zone with `Intl.DateTimeFormat`.
 */

import { show } from './show';

const SECOND = 1000;
const DAY = 86_400_000;

/** the years a date of a filter can be in, so the day after it still has a four digit year */
const FIRST_YEAR = 1000;
const LAST_YEAR = 9998;

/**
 * @internal
 * reads instants as the wall clock of one time zone, and back
 */
export interface TimeZoneClock {
    /** the wall clock of the instant, to the second (the milliseconds are dropped) */
    wallOf(instant: number): number;
    /**
     * The instant the clock shows the wall clock at, as JavaScript's `new Date(y, m, d, h, mi, s)` does in
     * that time zone: when the clocks go back and it is shown twice, the earlier; when they go forward and
     * it is not shown at all, it is read with the offset before (02:30 is 03:30 summer time)
     */
    instantOf(wall: number): number;
}

/**
 * @internal
 * the clock of an IANA time zone
 * @throws a `TypeError` for a name that is no time zone
 */
export function timeZoneClock(timeZone: string): TimeZoneClock {
    let format: Intl.DateTimeFormat;
    try {
        format = new Intl.DateTimeFormat('en-US', {
            timeZone,
            // h23: midnight is 00, never 24
            hourCycle: 'h23',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        });
    } catch {
        throw new TypeError(`toSqlWhere: options.timeZone ${show(timeZone)} is no IANA time zone, e.g. 'Europe/Oslo' or 'UTC'`);
    }

    const wallOf = (instant: number): number => {
        const part: Record<string, number> = {};
        for (const { type, value } of format.formatToParts(floorToSecond(instant))) {
            part[type] = Number(value);
        }
        return wallClock(part.year, part.month, part.day, part.hour, part.minute, part.second);
    };
    // what the clock is ahead of UTC at an instant (a whole second)
    const offsetAt = (instant: number) => wallOf(instant) - instant;

    const instantOf = (wall: number): number => {
        // a day before and after: the offsets on either side of a change of the clock near the wall clock
        const before = wall - offsetAt(wall - DAY);
        const after = wall - offsetAt(wall + DAY);
        const candidates = before <= after ? [before, after] : [after, before];
        const shown = candidates.find((instant) => wallOf(instant) === wall);
        return shown ?? before;
    };

    return { wallOf, instantOf };
}

/**
 * @internal
 * a wall clock from its parts, month 1-12. setUTCFullYear: Date.UTC() takes the years 0-99 as 1900-1999
 */
export function wallClock(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, 0);
    return date.getTime();
}

/** @internal the start of the day of a wall clock */
export function startOfDay(wall: number): number {
    return Math.floor(wall / DAY) * DAY;
}

/** @internal the start of the next day of a wall clock */
export function startOfNextDay(wall: number): number {
    return startOfDay(wall) + DAY;
}

/** @internal the second after */
export function nextSecond(milliseconds: number): number {
    return milliseconds + SECOND;
}

function floorToSecond(milliseconds: number): number {
    return Math.floor(milliseconds / SECOND) * SECOND;
}

// YYYY-MM-DD, then THH:mm, THH:mm:ss or THH:mm:ss.sss (any number of digits), then Z or +HH:mm / -HH:mm
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * @internal
 * How a date-only text (`'2026-11-22'`) is read:
 * - `'utc'`: as JavaScript's `new Date('2026-11-22')` reads it, midnight UTC - what the grid does with
 *   it in a comparison (EQUAL, LESS_THAN ...)
 * - `'local'`: the day in the time zone - what the grid's IN / NOT_IN compares, the text its formatter
 *   shows
 */
export type DateOnlyText = 'utc' | 'local';

/**
 * @internal
 * The wall clock (to the second) of a date of a filter, in the user's time zone. A `Date` is its
 * instant. A text is ISO 8601, read as JavaScript reads it: with `Z` or an offset an instant, without
 * one the wall clock in the time zone, a date-only text see DateOnlyText. A wall clock the clock skips is
 * moved on, as `new Date()` does.
 * @param where where the value is in the filter, for the message
 * @throws a `TypeError` for anything else, a date that is no date (2026-02-30), a year before 1000 or after
 * 9998
 */
export function readFilterDate(value: unknown, clock: TimeZoneClock, dateOnly: DateOnlyText, where: string): number {
    let instant: number;
    if (value instanceof Date) {
        instant = value.getTime();
    } else if (typeof value === 'string') {
        instant = readIsoText(value, clock, dateOnly, where);
    } else {
        throw new TypeError(`toSqlWhere: ${where} is a Date or ISO 8601 text ('2026-11-22T10:30:00.000Z'), not ${show(value)}`);
    }
    // an invalid Date is blank and left out before it gets here, NaN is no year either
    const wall = Number.isFinite(instant) ? clock.wallOf(instant) : Number.NaN;
    const year = new Date(wall).getUTCFullYear();
    if (!(year >= FIRST_YEAR && year <= LAST_YEAR)) {
        throw new TypeError(`toSqlWhere: ${where} is a date from the year ${FIRST_YEAR} to ${LAST_YEAR}, not ${show(value)}`);
    }
    return wall;
}

function readIsoText(text: string, clock: TimeZoneClock, dateOnly: DateOnlyText, where: string): number {
    const match = ISO_DATE.exec(text);
    const invalid = () => new TypeError(`toSqlWhere: ${where} is no date: ${show(text)}, ISO 8601 is '2026-11-22T10:30:00.000Z'`);
    if (!match) {
        throw invalid();
    }
    const [, year, month, day, hour, minute, second, offset] = match;
    const wall = wallClock(Number(year), Number(month), Number(day), Number(hour ?? 0), Number(minute ?? 0), Number(second ?? 0));
    // a part out of range rolls over (2026-02-30 is 2 March): read the parts back to catch it
    const date = new Date(wall);
    if (
        date.getUTCFullYear() !== Number(year) ||
        date.getUTCMonth() + 1 !== Number(month) ||
        date.getUTCDate() !== Number(day) ||
        date.getUTCHours() !== Number(hour ?? 0) ||
        date.getUTCMinutes() !== Number(minute ?? 0) ||
        date.getUTCSeconds() !== Number(second ?? 0)
    ) {
        throw invalid();
    }

    if (hour === undefined) {
        return dateOnly === 'utc' ? wall : clock.instantOf(wall);
    }
    if (offset === undefined) {
        return clock.instantOf(wall);
    }
    if (offset === 'Z') {
        return wall;
    }
    const [hours, minutes] = offset.slice(1).split(':').map(Number);
    if (hours > 23 || minutes > 59) {
        throw invalid();
    }
    const sign = offset.startsWith('-') ? -1 : 1;
    return wall - sign * (hours * 60 + minutes) * 60 * SECOND;
}

/**
 * @internal
 * milliseconds (an instant, or a wall clock) as `YYYY-MM-DD HH:MM:SS`, `T` between the date and the
 * time when `separator` is 'T'
 */
export function isoText(milliseconds: number, separator: ' ' | 'T'): string {
    const date = new Date(milliseconds);
    const pad = (value: number, length = 2) => String(value).padStart(length, '0');
    return (
        `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
        `${separator}${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
    );
}
