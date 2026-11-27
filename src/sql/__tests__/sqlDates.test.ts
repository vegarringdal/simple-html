// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';
import { isoText, readFilterDate, startOfDay, startOfNextDay, timeZoneClock, wallClock } from '../sqlDates';

/**
 * The wall clock of a time zone, read with Intl.DateTimeFormat, against JavaScript's own Date in that
 * time zone (process.env.TZ): the grid reads the wall clock of the browser with getFullYear() ...
 * getSeconds() and makes a day with new Date(y, m, d), the SQL has to land on the same instants.
 */

const originalTimeZone = process.env.TZ;
afterAll(() => {
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});

const ZONES = [
    'Europe/Oslo',
    'America/New_York',
    // the clocks change at midnight: midnight is skipped, or shown twice
    'America/Santiago',
    'America/Sao_Paulo',
    'America/Havana',
    // half an hour of summer time, offsets of 30 and 45 minutes
    'Australia/Lord_Howe',
    'Asia/Kolkata',
    'Pacific/Chatham',
    'America/St_Johns',
    // skipped 30 December 2011
    'Pacific/Apia',
    // summer time "negative" in the data: winter is the offset that differs
    'Europe/Dublin',
    'Africa/Casablanca',
    'UTC'
];

function random(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** the instants of the changes of the clock in a zone in a year, found by the offsets of each hour */
function changes(year: number): number[] {
    const found: number[] = [];
    let previous = new Date(year, 0, 1).getTimezoneOffset();
    for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += 3600_000) {
        const offset = new Date(t).getTimezoneOffset();
        if (offset !== previous) {
            found.push(t);
            previous = offset;
        }
    }
    return found;
}

describe('timeZoneClock', () => {
    for (const zone of ZONES) {
        it(`expect the wall clock and the instant of a wall clock to be JavaScript's in ${zone}`, () => {
            process.env.TZ = zone;
            const clock = timeZoneClock(zone);
            const next = random(zone.length * 7919);
            const walls: number[] = [];
            // around every change of the clock, minute by minute, and at random over the years
            for (const year of [1970, 2011, 2018, 2026]) {
                for (const change of changes(year)) {
                    for (let minutes = -150; minutes <= 150; minutes += 15) {
                        const date = new Date(change + minutes * 60_000);
                        walls.push(
                            wallClock(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes())
                        );
                        // a wall clock the clock may skip: the same, an hour on
                        walls.push(wallClock(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours() + 1, 30));
                    }
                }
            }
            for (let index = 0; index < 400; index++) {
                walls.push(
                    Math.floor((Date.UTC(1900, 0, 1) + next() * (Date.UTC(2100, 0, 1) - Date.UTC(1900, 0, 1))) / 1000) * 1000
                );
            }

            for (const wall of walls) {
                const w = new Date(wall);
                const expected = new Date(
                    w.getUTCFullYear(),
                    w.getUTCMonth(),
                    w.getUTCDate(),
                    w.getUTCHours(),
                    w.getUTCMinutes(),
                    w.getUTCSeconds()
                ).getTime();
                expect([isoText(wall, 'T'), clock.instantOf(wall)]).toEqual([isoText(wall, 'T'), expected]);

                const local = new Date(expected);
                const shown = wallClock(
                    local.getFullYear(),
                    local.getMonth() + 1,
                    local.getDate(),
                    local.getHours(),
                    local.getMinutes(),
                    local.getSeconds()
                );
                expect(clock.wallOf(expected)).toBe(shown);
            }
        });
    }

    it('expect a day to start at the instant of new Date(y, m, d) - also where midnight is skipped', () => {
        // Sao Paulo, 4 Nov 2018: the clock went from 00:00 to 01:00, the day started at 01:00
        process.env.TZ = 'America/Sao_Paulo';
        const clock = timeZoneClock('America/Sao_Paulo');
        const day = wallClock(2018, 11, 4);
        expect(clock.instantOf(day)).toBe(new Date(2018, 10, 4).getTime());
        expect(new Date(clock.instantOf(day)).getHours()).toBe(1);
        // the day was 23 hours long
        expect(clock.instantOf(startOfNextDay(day)) - clock.instantOf(day)).toBe(23 * 3600_000);
    });

    it('expect the days the clocks change to be 23 and 25 hours long in Oslo', () => {
        const clock = timeZoneClock('Europe/Oslo');
        const length = (wall: number) => clock.instantOf(startOfNextDay(wall)) - clock.instantOf(startOfDay(wall));
        expect(length(wallClock(2026, 3, 29, 12))).toBe(23 * 3600_000);
        expect(length(wallClock(2026, 10, 25, 12))).toBe(25 * 3600_000);
        expect(length(wallClock(2026, 11, 22, 12))).toBe(24 * 3600_000);
    });

    it('expect 02:30 on the day the clocks go forward in Oslo to be 03:30 summer time, as JavaScript reads it', () => {
        const clock = timeZoneClock('Europe/Oslo');
        expect(new Date(clock.instantOf(wallClock(2026, 3, 29, 2, 30))).toISOString()).toBe('2026-03-29T01:30:00.000Z');
    });

    it('expect 02:30 on the day the clocks go back in Oslo to be the first of the two', () => {
        const clock = timeZoneClock('Europe/Oslo');
        expect(new Date(clock.instantOf(wallClock(2026, 10, 25, 2, 30))).toISOString()).toBe('2026-10-25T00:30:00.000Z');
        // both are 02:30 on the wall clock
        expect(clock.wallOf(Date.parse('2026-10-25T00:30:00Z'))).toBe(wallClock(2026, 10, 25, 2, 30));
        expect(clock.wallOf(Date.parse('2026-10-25T01:30:00Z'))).toBe(wallClock(2026, 10, 25, 2, 30));
    });

    it('expect the day Samoa skipped to be read as JavaScript reads it', () => {
        process.env.TZ = 'Pacific/Apia';
        const clock = timeZoneClock('Pacific/Apia');
        const skipped = wallClock(2011, 12, 30, 12);
        expect(clock.instantOf(skipped)).toBe(new Date(2011, 11, 30, 12).getTime());
    });

    it('expect a name that is no time zone to throw a TypeError', () => {
        expect(() => timeZoneClock('Europe/Nowhere')).toThrow(TypeError);
        expect(() => timeZoneClock('')).toThrow(TypeError);
        expect(() => timeZoneClock("'; DROP TABLE t; --")).toThrow(/no IANA time zone/);
    });

    it('expect the milliseconds to be left out of the wall clock', () => {
        const clock = timeZoneClock('UTC');
        expect(clock.wallOf(Date.parse('2026-11-22T10:00:00.999Z'))).toBe(Date.parse('2026-11-22T10:00:00Z'));
        // before 1970 too: the second it is in
        expect(clock.wallOf(Date.parse('1969-12-31T23:59:59.500Z'))).toBe(Date.parse('1969-12-31T23:59:59Z'));
    });
});

describe('readFilterDate', () => {
    const oslo = timeZoneClock('Europe/Oslo');
    const read = (value: unknown, dateOnly: 'utc' | 'local' = 'utc') =>
        isoText(readFilterDate(value, oslo, dateOnly, 'value'), 'T');

    it('expect a Date and ISO text with Z or an offset to be the wall clock in the time zone', () => {
        expect(read(new Date('2026-11-21T23:00:00.000Z'))).toBe('2026-11-22T00:00:00');
        expect(read('2026-11-21T23:00:00.000Z')).toBe('2026-11-22T00:00:00');
        expect(read('2026-11-21T23:00Z')).toBe('2026-11-22T00:00:00');
        expect(read('2026-11-22T05:00:00-05:00')).toBe('2026-11-22T11:00:00');
        expect(read('2026-11-22T12:00:00.123456+01:00')).toBe('2026-11-22T12:00:00');
    });

    it('expect a text without an offset to be the wall clock, as JavaScript reads it', () => {
        expect(read('2026-11-22T10:30')).toBe('2026-11-22T10:30:00');
        expect(read('2026-11-22T10:30:15')).toBe('2026-11-22T10:30:15');
        // not on the clock: read on, as new Date('2026-03-29T02:30') does
        expect(read('2026-03-29T02:30:00')).toBe('2026-03-29T03:30:00');
    });

    it("expect a date-only text in a comparison to be UTC midnight - JavaScript's new Date('2026-11-22')", () => {
        expect(read('2026-11-22')).toBe('2026-11-22T01:00:00');
        const newYork = timeZoneClock('America/New_York');
        // the day before, west of UTC: what the grid does with it
        expect(isoText(readFilterDate('2026-11-22', newYork, 'utc', 'value'), 'T')).toBe('2026-11-21T19:00:00');
    });

    it('expect a date-only text in an IN list to be that day in the time zone, as the formatter shows it', () => {
        expect(read('2026-11-22', 'local')).toBe('2026-11-22T00:00:00');
        const newYork = timeZoneClock('America/New_York');
        expect(isoText(readFilterDate('2026-11-22', newYork, 'local', 'value'), 'T')).toBe('2026-11-22T00:00:00');
    });

    it('expect anything that is no ISO date to throw a TypeError', () => {
        for (const value of [
            '22.11.2026',
            '2026-11-22 10:30:00',
            '2026-11-22t10:30',
            '2026-02-30',
            '2026-13-01',
            '2026-11-22T24:00:00',
            '2026-11-22T10:60',
            '2026-11-22T10:30:00+25:00',
            '2026-11-22T10:30:00+01:60',
            '2026-11-22Z',
            '+002026-11-22',
            ' 2026-11-22',
            '2026-11-22\n',
            '',
            'now',
            1795302000000,
            true,
            {},
            [],
            null
        ]) {
            expect(() => readFilterDate(value, oslo, 'utc', 'value'), JSON.stringify(value)).toThrow(TypeError);
        }
    });

    it('expect a year before 1000 or after 9998 to throw a TypeError', () => {
        expect(() => read('0999-12-31T12:00:00')).toThrow(/from the year 1000 to 9998/);
        expect(() => read('9999-01-01')).toThrow(/from the year 1000 to 9998/);
        expect(() => read(new Date(8.64e15))).toThrow(TypeError);
        expect(read('1000-01-01T00:00:00')).toBe('1000-01-01T00:00:00');
        expect(read('9998-12-31T23:59:59')).toBe('9998-12-31T23:59:59');
    });
});

describe('isoText', () => {
    it('expect four digits of year and two of everything else', () => {
        expect(isoText(wallClock(1000, 1, 2, 3, 4, 5), ' ')).toBe('1000-01-02 03:04:05');
        expect(isoText(wallClock(999, 12, 31, 23, 0, 0), 'T')).toBe('0999-12-31T23:00:00');
        // the years 0-99 are not 1900-1999
        expect(isoText(wallClock(50, 6, 1), ' ')).toBe('0050-06-01 00:00:00');
    });
});
