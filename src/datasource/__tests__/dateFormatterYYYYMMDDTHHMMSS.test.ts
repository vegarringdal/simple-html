import { describe, expect, it } from 'vitest';
import { DateFormatterYYYYMMDDTHHMMSS } from '../DateFormatterYYYYMMDDTHHMMSS';

describe('DateFormatterYYYYMMDDTHHMMSS.format', () => {
    it('expect null to be empty string', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.format(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.format(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.format('')).toEqual('');
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.format('this is not a date')).toEqual('');
    });

    it('expect local date to be formated as YYYY-MM-DDTHH:MM:SS', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.format(new Date(2019, 10, 25, 13, 45, 12))).toEqual('2019-11-25T13:45:12');
    });

    it('expect single digit month, day, hour, minute and second to be zero padded', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.format(new Date(2019, 0, 5, 3, 4, 9))).toEqual('2019-01-05T03:04:09');
    });

    it('expect midnight to be formated as 00:00:00', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.format(new Date(2019, 0, 5, 0, 0, 0))).toEqual('2019-01-05T00:00:00');
    });
});

describe('DateFormatterYYYYMMDDTHHMMSS.parse', () => {
    it('expect null to be null', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.parse(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.parse(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.parse('')).toEqual(null);
    });

    it('expect a Date to pass through (v5 gave null)', () => {
        const date = new Date(2019, 0, 1, 13, 45, 12, 500);
        expect(DateFormatterYYYYMMDDTHHMMSS.parse(date)).toBe(date);
    });

    it('expect a number to be null', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.parse(12345)).toEqual(null);
    });

    it('expect full date and time string to be a local date', () => {
        const result = DateFormatterYYYYMMDDTHHMMSS.parse('2019-11-25T13:45:12') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(13);
        expect(result.getMinutes()).toEqual(45);
        expect(result.getSeconds()).toEqual(12);
    });

    it('expect zero time parts to be kept', () => {
        const result = DateFormatterYYYYMMDDTHHMMSS.parse('2019-11-25T00:00:00') as Date;
        expect(result.getHours()).toEqual(0);
        expect(result.getMinutes()).toEqual(0);
        expect(result.getSeconds()).toEqual(0);
    });

    it('expect missing time part to fall back to current time', () => {
        const now = new Date();
        const result = DateFormatterYYYYMMDDTHHMMSS.parse('2019-11-25') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(now.getHours());
    });

    it('expect missing seconds to fall back to current seconds', () => {
        const result = DateFormatterYYYYMMDDTHHMMSS.parse('2019-11-25T13:45') as Date;
        expect(result.getHours()).toEqual(13);
        expect(result.getMinutes()).toEqual(45);
        expect(result.getSeconds()).toBeGreaterThanOrEqual(0);
        expect(result.getSeconds()).toBeLessThanOrEqual(59);
    });

    it('expect missing month and day to fall back to current month and day', () => {
        const now = new Date();
        const result = DateFormatterYYYYMMDDTHHMMSS.parse('2019T13:45:12') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(now.getMonth());
        expect(result.getDate()).toEqual(now.getDate());
        expect(result.getHours()).toEqual(13);
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.parse('abc-de-fgThh:mm:ss')).toEqual('');
    });

    it('expect round trip parse then format to keep the date and time', () => {
        const value = '2019-11-25T13:45:12';
        expect(DateFormatterYYYYMMDDTHHMMSS.format(DateFormatterYYYYMMDDTHHMMSS.parse(value))).toEqual(value);
    });

    it('expect round trip with single digit parts to keep the date and time', () => {
        const value = '2019-01-05T03:04:09';
        expect(DateFormatterYYYYMMDDTHHMMSS.format(DateFormatterYYYYMMDDTHHMMSS.parse(value))).toEqual(value);
    });
});

describe('DateFormatterYYYYMMDDTHHMMSS.parseFilter', () => {
    it('expect null to be null', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.parseFilter(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.parseFilter(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.parseFilter('')).toEqual(null);
    });

    it('expect a number to be null', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.parseFilter(12345)).toEqual(null);
    });

    it('expect a Date to pass through, time kept (v5 gave null)', () => {
        const date = new Date(2019, 0, 1, 13, 45, 12);
        expect(DateFormatterYYYYMMDDTHHMMSS.parseFilter(date)).toBe(date);
    });

    it('expect the milliseconds of a filter boundary to be 0 (v5 stamped the current milliseconds)', () => {
        expect((DateFormatterYYYYMMDDTHHMMSS.parseFilter('2019-11-25T13:45:12') as Date).getMilliseconds()).toEqual(0);
        expect((DateFormatterYYYYMMDDTHHMMSS.parseFilter('2019-11-25') as Date).getMilliseconds()).toEqual(0);
    });

    it('expect a filter boundary to be the same every time', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.parseFilter('2019-11-25T13:45:12')).toEqual(
            DateFormatterYYYYMMDDTHHMMSS.parseFilter('2019-11-25T13:45:12')
        );
    });

    it('expect missing time part to fall back to midnight', () => {
        const result = DateFormatterYYYYMMDDTHHMMSS.parseFilter('2019-11-25') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(0);
        expect(result.getMinutes()).toEqual(0);
        expect(result.getSeconds()).toEqual(0);
    });

    it('expect given time part to be kept', () => {
        const result = DateFormatterYYYYMMDDTHHMMSS.parseFilter('2019-11-25T13:45:12') as Date;
        expect(result.getHours()).toEqual(13);
        expect(result.getMinutes()).toEqual(45);
        expect(result.getSeconds()).toEqual(12);
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.parseFilter('abc-de-fg')).toEqual('');
    });
});

describe('DateFormatterYYYYMMDDTHHMMSS misc', () => {
    it('expect placeholder to be YYYY-MM-DDTHH:MM:SS', () => {
        expect(DateFormatterYYYYMMDDTHHMMSS.placeholder).toEqual('YYYY-MM-DDTHH:MM:SS');
    });
});
