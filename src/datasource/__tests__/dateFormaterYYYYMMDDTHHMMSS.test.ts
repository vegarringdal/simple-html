import { describe, expect, it } from 'vitest';
import { DateFormaterYYYYMMDDTHHMMSS } from '../DateFormaterYYYYMMDDTHHMMSS';

describe('DateFormaterYYYYMMDDTHHMMSS.fromSource', () => {
    it('expect null to be empty string', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.fromSource(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.fromSource(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.fromSource('')).toEqual('');
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.fromSource('this is not a date')).toEqual('');
    });

    it('expect local date to be formated as YYYY-MM-DDTHH:MM:SS', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.fromSource(new Date(2019, 10, 25, 13, 45, 12))).toEqual('2019-11-25T13:45:12');
    });

    it('expect single digit month, day, hour, minute and second to be zero padded', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.fromSource(new Date(2019, 0, 5, 3, 4, 9))).toEqual('2019-01-05T03:04:09');
    });

    it('expect midnight to be formated as 00:00:00', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.fromSource(new Date(2019, 0, 5, 0, 0, 0))).toEqual('2019-01-05T00:00:00');
    });
});

describe('DateFormaterYYYYMMDDTHHMMSS.toSource', () => {
    it('expect null to be null', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.toSource(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.toSource(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.toSource('')).toEqual(null);
    });

    it('expect a non string value to be null', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.toSource(new Date(2019, 0, 1))).toEqual(null);
    });

    it('expect full date and time string to be a local date', () => {
        const result = DateFormaterYYYYMMDDTHHMMSS.toSource('2019-11-25T13:45:12') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(13);
        expect(result.getMinutes()).toEqual(45);
        expect(result.getSeconds()).toEqual(12);
    });

    it('expect zero time parts to be kept', () => {
        const result = DateFormaterYYYYMMDDTHHMMSS.toSource('2019-11-25T00:00:00') as Date;
        expect(result.getHours()).toEqual(0);
        expect(result.getMinutes()).toEqual(0);
        expect(result.getSeconds()).toEqual(0);
    });

    it('expect missing time part to fall back to current time', () => {
        const now = new Date();
        const result = DateFormaterYYYYMMDDTHHMMSS.toSource('2019-11-25') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(now.getHours());
    });

    it('expect missing seconds to fall back to current seconds', () => {
        const result = DateFormaterYYYYMMDDTHHMMSS.toSource('2019-11-25T13:45') as Date;
        expect(result.getHours()).toEqual(13);
        expect(result.getMinutes()).toEqual(45);
        expect(result.getSeconds()).toBeGreaterThanOrEqual(0);
        expect(result.getSeconds()).toBeLessThanOrEqual(59);
    });

    it('expect missing month and day to fall back to current month and day', () => {
        const now = new Date();
        const result = DateFormaterYYYYMMDDTHHMMSS.toSource('2019T13:45:12') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(now.getMonth());
        expect(result.getDate()).toEqual(now.getDate());
        expect(result.getHours()).toEqual(13);
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.toSource('abc-de-fgThh:mm:ss')).toEqual('');
    });

    it('expect round trip toSource then fromSource to keep the date and time', () => {
        const value = '2019-11-25T13:45:12';
        expect(DateFormaterYYYYMMDDTHHMMSS.fromSource(DateFormaterYYYYMMDDTHHMMSS.toSource(value))).toEqual(value);
    });

    it('expect round trip with single digit parts to keep the date and time', () => {
        const value = '2019-01-05T03:04:09';
        expect(DateFormaterYYYYMMDDTHHMMSS.fromSource(DateFormaterYYYYMMDDTHHMMSS.toSource(value))).toEqual(value);
    });
});

describe('DateFormaterYYYYMMDDTHHMMSS.toFilter', () => {
    it('expect null to be null', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.toFilter(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.toFilter(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.toFilter('')).toEqual(null);
    });

    it('expect a non string value to be null', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.toFilter(12345)).toEqual(null);
    });

    it('expect missing time part to fall back to midnight', () => {
        const result = DateFormaterYYYYMMDDTHHMMSS.toFilter('2019-11-25') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(0);
        expect(result.getMinutes()).toEqual(0);
        expect(result.getSeconds()).toEqual(0);
    });

    it('expect given time part to be kept', () => {
        const result = DateFormaterYYYYMMDDTHHMMSS.toFilter('2019-11-25T13:45:12') as Date;
        expect(result.getHours()).toEqual(13);
        expect(result.getMinutes()).toEqual(45);
        expect(result.getSeconds()).toEqual(12);
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.toFilter('abc-de-fg')).toEqual('');
    });
});

describe('DateFormaterYYYYMMDDTHHMMSS misc', () => {
    it('expect fromSourceDisplay to be same as fromSource', () => {
        const date = new Date(2019, 0, 5, 3, 4, 9);
        expect(DateFormaterYYYYMMDDTHHMMSS.fromSourceDisplay(date)).toEqual(DateFormaterYYYYMMDDTHHMMSS.fromSource(date));
    });

    it('expect fromSourceGrouping to be formated as YYYY-MM-DDTHH:MM:SS', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.fromSourceGrouping(new Date(2019, 0, 5, 3, 4, 9))).toEqual('2019-01-05T03:04:09');
    });

    it('expect placeholder to be YYYY-MM-DDTHH:MM:SS', () => {
        expect(DateFormaterYYYYMMDDTHHMMSS.placeholder()).toEqual('YYYY-MM-DDTHH:MM:SS');
    });
});
