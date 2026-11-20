import { describe, expect, it } from 'vitest';
import { DateFormatterYYYYMMDD } from '../DateFormatterYYYYMMDD';

describe('DateFormatterYYYYMMDD.format', () => {
    it('expect null to be empty string', () => {
        expect(DateFormatterYYYYMMDD.format(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(DateFormatterYYYYMMDD.format(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(DateFormatterYYYYMMDD.format('')).toEqual('');
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterYYYYMMDD.format('this is not a date')).toEqual('');
    });

    it('expect local date to be formated as YYYY-MM-DD', () => {
        expect(DateFormatterYYYYMMDD.format(new Date(2019, 10, 25, 13, 45, 12))).toEqual('2019-11-25');
    });

    it('expect single digit month and day to be zero padded', () => {
        expect(DateFormatterYYYYMMDD.format(new Date(2019, 0, 5, 0, 0, 0))).toEqual('2019-01-05');
    });

    it('expect last day of year to be formated correctly', () => {
        expect(DateFormatterYYYYMMDD.format(new Date(2020, 11, 31, 23, 59, 59))).toEqual('2020-12-31');
    });

    it('expect leap day to be formated correctly', () => {
        expect(DateFormatterYYYYMMDD.format(new Date(2020, 1, 29))).toEqual('2020-02-29');
    });
});

describe('DateFormatterYYYYMMDD.parse', () => {
    it('expect null to be null', () => {
        expect(DateFormatterYYYYMMDD.parse(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormatterYYYYMMDD.parse(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormatterYYYYMMDD.parse('')).toEqual(null);
    });

    it('expect number 0 to be null', () => {
        expect(DateFormatterYYYYMMDD.parse(0)).toEqual(null);
    });

    it('expect a Date to pass through, time of day kept (v5 gave null)', () => {
        const date = new Date(2019, 0, 1, 13, 45);
        expect(DateFormatterYYYYMMDD.parse(date)).toBe(date);
    });

    it('expect a date before 1970 to pass through, not be read as a number below 1', () => {
        const date = new Date(1960, 5, 1);
        expect(DateFormatterYYYYMMDD.parse(date)).toBe(date);
    });

    it('expect full date string to be a local date', () => {
        const result = DateFormatterYYYYMMDD.parse('2019-11-25') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
    });

    it('expect missing day to fall back to current day', () => {
        const now = new Date();
        const result = DateFormatterYYYYMMDD.parse('2019-11') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(now.getDate());
    });

    it('expect missing month and day to fall back to current month and day', () => {
        const now = new Date();
        const result = DateFormatterYYYYMMDD.parse('2019') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(now.getMonth());
        expect(result.getDate()).toEqual(now.getDate());
    });

    it('expect time part to be taken from current time', () => {
        const before = new Date();
        const result = DateFormatterYYYYMMDD.parse('2019-11-25') as Date;
        const after = new Date();
        expect(result.getHours()).toBeGreaterThanOrEqual(Math.min(before.getHours(), after.getHours()));
        expect(result.getHours()).toBeLessThanOrEqual(Math.max(before.getHours(), after.getHours()));
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterYYYYMMDD.parse('abc-de-fg')).toEqual('');
    });

    it('expect round trip parse then format to keep the date', () => {
        expect(DateFormatterYYYYMMDD.format(DateFormatterYYYYMMDD.parse('2019-11-25'))).toEqual('2019-11-25');
    });

    it('expect round trip with single digit month and day to keep the date', () => {
        expect(DateFormatterYYYYMMDD.format(DateFormatterYYYYMMDD.parse('2019-01-05'))).toEqual('2019-01-05');
    });
});

describe('DateFormatterYYYYMMDD.parseFilter', () => {
    it('expect null to be null', () => {
        expect(DateFormatterYYYYMMDD.parseFilter(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormatterYYYYMMDD.parseFilter(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormatterYYYYMMDD.parseFilter('')).toEqual(null);
    });

    it('expect a Date to be moved to the start of its day (v5 gave null)', () => {
        expect(DateFormatterYYYYMMDD.parseFilter(new Date(2019, 0, 1, 13, 45, 12, 500))).toEqual(
            new Date(2019, 0, 1, 0, 0, 0, 0)
        );
    });

    it('expect full date string to be local midnight', () => {
        expect(DateFormatterYYYYMMDD.parseFilter('2019-11-25')).toEqual(new Date(2019, 10, 25, 0, 0, 0, 0));
    });

    it('expect missing month and day to fall back to current month and day at midnight', () => {
        const now = new Date();
        expect(DateFormatterYYYYMMDD.parseFilter('2019')).toEqual(new Date(2019, now.getMonth(), now.getDate(), 0, 0, 0, 0));
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterYYYYMMDD.parseFilter('abc-de-fg')).toEqual('');
    });
});

describe('DateFormatterYYYYMMDD misc', () => {
    it('expect a value that is no date, string or number to be empty string', () => {
        expect(DateFormatterYYYYMMDD.format(true)).toEqual('');
        expect(DateFormatterYYYYMMDD.format({})).toEqual('');
    });

    it('expect the methods to work detached, without this', () => {
        const { format, parse } = DateFormatterYYYYMMDD;
        expect(format(parse('2019-01-05'))).toEqual('2019-01-05');
    });

    it('expect placeholder to be YYYY-MM-DD', () => {
        expect(DateFormatterYYYYMMDD.placeholder).toEqual('YYYY-MM-DD');
    });
});
