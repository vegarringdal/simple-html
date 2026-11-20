import { describe, expect, it } from 'vitest';
import { DateFormatterDDMMYYYYTHHMMSS } from '../DateFormatterDDMMYYYYTHHMMSS';

describe('DateFormatterDDMMYYYYTHHMMSS.format', () => {
    it('expect null to be empty string', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.format(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.format(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.format('')).toEqual('');
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.format('this is not a date')).toEqual('');
    });

    it('expect local date to be formated as DD.MM.YYYYTHH:MM:SS', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.format(new Date(2019, 10, 25, 13, 45, 12))).toEqual('25.11.2019T13:45:12');
    });

    it('expect single digit month, day, hour, minute and second to be zero padded', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.format(new Date(2019, 0, 5, 3, 4, 9))).toEqual('05.01.2019T03:04:09');
    });

    it('expect midnight to be formated as 00:00:00', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.format(new Date(2019, 0, 5, 0, 0, 0))).toEqual('05.01.2019T00:00:00');
    });
});

describe('DateFormatterDDMMYYYYTHHMMSS.parse', () => {
    it('expect null to be null', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.parse(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.parse(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.parse('')).toEqual(null);
    });

    it('expect a Date to pass through (v5 gave null)', () => {
        const date = new Date(2019, 0, 1, 13, 45, 12, 500);
        expect(DateFormatterDDMMYYYYTHHMMSS.parse(date)).toBe(date);
    });

    it('expect a number to be null', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.parse(12345)).toEqual(null);
    });

    it('expect full date and time string to be a local date', () => {
        const result = DateFormatterDDMMYYYYTHHMMSS.parse('25.11.2019T13:45:12') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(13);
        expect(result.getMinutes()).toEqual(45);
        expect(result.getSeconds()).toEqual(12);
    });

    it('expect zero time parts to be kept', () => {
        const result = DateFormatterDDMMYYYYTHHMMSS.parse('25.11.2019T00:00:00') as Date;
        expect(result.getHours()).toEqual(0);
        expect(result.getMinutes()).toEqual(0);
        expect(result.getSeconds()).toEqual(0);
    });

    it('expect missing time part to fall back to current time', () => {
        const now = new Date();
        const result = DateFormatterDDMMYYYYTHHMMSS.parse('25.11.2019') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(now.getHours());
    });

    it('expect missing month and year to fall back to current month and year', () => {
        const now = new Date();
        const result = DateFormatterDDMMYYYYTHHMMSS.parse('25T13:45:12') as Date;
        expect(result.getFullYear()).toEqual(now.getFullYear());
        expect(result.getMonth()).toEqual(now.getMonth());
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(13);
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.parse('aa.bb.ccccThh:mm:ss')).toEqual('');
    });

    it('expect round trip parse then format to keep the date and time', () => {
        const value = '25.11.2019T13:45:12';
        expect(DateFormatterDDMMYYYYTHHMMSS.format(DateFormatterDDMMYYYYTHHMMSS.parse(value))).toEqual(value);
    });

    it('expect round trip with single digit parts to keep the date and time', () => {
        const value = '05.01.2019T03:04:09';
        expect(DateFormatterDDMMYYYYTHHMMSS.format(DateFormatterDDMMYYYYTHHMMSS.parse(value))).toEqual(value);
    });
});

describe('DateFormatterDDMMYYYYTHHMMSS.parseFilter', () => {
    it('expect null to be null', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.parseFilter(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.parseFilter(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.parseFilter('')).toEqual(null);
    });

    it('expect a number to be null', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.parseFilter(12345)).toEqual(null);
    });

    it('expect a Date to pass through, time kept (v5 gave null)', () => {
        const date = new Date(2019, 0, 1, 13, 45, 12);
        expect(DateFormatterDDMMYYYYTHHMMSS.parseFilter(date)).toBe(date);
    });

    it('expect the milliseconds of a filter boundary to be 0 (v5 stamped the current milliseconds)', () => {
        expect((DateFormatterDDMMYYYYTHHMMSS.parseFilter('25.11.2019T13:45:12') as Date).getMilliseconds()).toEqual(0);
        expect((DateFormatterDDMMYYYYTHHMMSS.parseFilter('25.11.2019') as Date).getMilliseconds()).toEqual(0);
    });

    it('expect a filter boundary to be the same every time', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.parseFilter('25.11.2019T13:45:12')).toEqual(
            DateFormatterDDMMYYYYTHHMMSS.parseFilter('25.11.2019T13:45:12')
        );
    });

    it('expect missing time part to fall back to midnight', () => {
        const result = DateFormatterDDMMYYYYTHHMMSS.parseFilter('25.11.2019') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(0);
        expect(result.getMinutes()).toEqual(0);
        expect(result.getSeconds()).toEqual(0);
    });

    it('expect given time part to be kept', () => {
        const result = DateFormatterDDMMYYYYTHHMMSS.parseFilter('25.11.2019T13:45:12') as Date;
        expect(result.getHours()).toEqual(13);
        expect(result.getMinutes()).toEqual(45);
        expect(result.getSeconds()).toEqual(12);
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.parseFilter('aa.bb.cccc')).toEqual('');
    });
});

describe('DateFormatterDDMMYYYYTHHMMSS misc', () => {
    it('expect placeholder to be DD.MM.YYYYTHH:MM:SS', () => {
        expect(DateFormatterDDMMYYYYTHHMMSS.placeholder).toEqual('DD.MM.YYYYTHH:MM:SS');
    });
});
