import { describe, expect, it } from 'vitest';
import { getWeekNumbers } from '../utils/getWeekNumber';

/**
 * The week numbers of the date picker: the same as the grid's week formats (isoWeek / usWeek of
 * columnFormat.ts). The old count gave 0 for the first days of a year in the last ISO week of the
 * year before, and its US weeks were not Excel's WEEKNUM
 */
describe('getWeekNumbers', () => {
    it('expect ISO weeks across New Year: the last week of the year before, or week 1 of the next', () => {
        // 2027-01-01 is a Friday: ISO 2026-W53 (it was 0)
        expect(getWeekNumbers(new Date(2027, 0, 1), true)).toBe(53);
        expect(getWeekNumbers(new Date(2021, 0, 3), true)).toBe(53);
        // 2024-12-30 is a Monday of 2025-W01
        expect(getWeekNumbers(new Date(2024, 11, 30), true)).toBe(1);
        expect(getWeekNumbers(new Date(2026, 10, 23), true)).toBe(48);
    });

    it('expect US weeks as Excel WEEKNUM, every day of a week the same number', () => {
        // Sunday 2026-11-22 ... Saturday 2026-11-28: WEEKNUM 48
        for (let day = 22; day <= 28; day++) {
            expect(getWeekNumbers(new Date(2026, 10, day), false)).toBe(48);
        }
        expect(getWeekNumbers(new Date(2026, 0, 1), false)).toBe(1);
        expect(getWeekNumbers(new Date(2026, 0, 4), false)).toBe(2);
    });

    it('expect the US week across New Year to be week 1, also its days in December', () => {
        // Sunday 2026-12-27 to Saturday 2027-01-02
        expect(getWeekNumbers(new Date(2026, 11, 27), false)).toBe(1);
        expect(getWeekNumbers(new Date(2027, 0, 2), false)).toBe(1);
        // the week before is 52 of 2026
        expect(getWeekNumbers(new Date(2026, 11, 26), false)).toBe(52);
    });
});
