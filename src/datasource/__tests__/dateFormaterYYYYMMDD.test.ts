import { describe, expect, it } from 'vitest';
import { DateFormaterYYYYMMDD } from '../DateFormaterYYYYMMDD';

describe('DateFormaterYYYYMMDD.fromSource', () => {
    it('expect null to be empty string', () => {
        expect(DateFormaterYYYYMMDD.fromSource(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(DateFormaterYYYYMMDD.fromSource(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(DateFormaterYYYYMMDD.fromSource('')).toEqual('');
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormaterYYYYMMDD.fromSource('this is not a date')).toEqual('');
    });

    it('expect local date to be formated as YYYY-MM-DD', () => {
        expect(DateFormaterYYYYMMDD.fromSource(new Date(2019, 10, 25, 13, 45, 12))).toEqual('2019-11-25');
    });

    it('expect single digit month and day to be zero padded', () => {
        expect(DateFormaterYYYYMMDD.fromSource(new Date(2019, 0, 5, 0, 0, 0))).toEqual('2019-01-05');
    });

    it('expect last day of year to be formated correctly', () => {
        expect(DateFormaterYYYYMMDD.fromSource(new Date(2020, 11, 31, 23, 59, 59))).toEqual('2020-12-31');
    });

    it('expect leap day to be formated correctly', () => {
        expect(DateFormaterYYYYMMDD.fromSource(new Date(2020, 1, 29))).toEqual('2020-02-29');
    });
});

describe('DateFormaterYYYYMMDD.toSource', () => {
    it('expect null to be null', () => {
        expect(DateFormaterYYYYMMDD.toSource(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormaterYYYYMMDD.toSource(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormaterYYYYMMDD.toSource('')).toEqual(null);
    });

    it('expect number 0 to be null', () => {
        expect(DateFormaterYYYYMMDD.toSource(0)).toEqual(null);
    });

    it('expect a non string value to be null', () => {
        expect(DateFormaterYYYYMMDD.toSource(new Date(2019, 0, 1))).toEqual(null);
    });

    it('expect full date string to be a local date', () => {
        const result = DateFormaterYYYYMMDD.toSource('2019-11-25') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
    });

    it('expect missing day to fall back to current day', () => {
        const now = new Date();
        const result = DateFormaterYYYYMMDD.toSource('2019-11') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(now.getDate());
    });

    it('expect missing month and day to fall back to current month and day', () => {
        const now = new Date();
        const result = DateFormaterYYYYMMDD.toSource('2019') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(now.getMonth());
        expect(result.getDate()).toEqual(now.getDate());
    });

    it('expect time part to be taken from current time', () => {
        const before = new Date();
        const result = DateFormaterYYYYMMDD.toSource('2019-11-25') as Date;
        const after = new Date();
        expect(result.getHours()).toBeGreaterThanOrEqual(Math.min(before.getHours(), after.getHours()));
        expect(result.getHours()).toBeLessThanOrEqual(Math.max(before.getHours(), after.getHours()));
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormaterYYYYMMDD.toSource('abc-de-fg')).toEqual('');
    });

    it('expect round trip toSource then fromSource to keep the date', () => {
        expect(DateFormaterYYYYMMDD.fromSource(DateFormaterYYYYMMDD.toSource('2019-11-25'))).toEqual('2019-11-25');
    });

    it('expect round trip with single digit month and day to keep the date', () => {
        expect(DateFormaterYYYYMMDD.fromSource(DateFormaterYYYYMMDD.toSource('2019-01-05'))).toEqual('2019-01-05');
    });
});

describe('DateFormaterYYYYMMDD.toFilter', () => {
    it('expect null to be null', () => {
        expect(DateFormaterYYYYMMDD.toFilter(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormaterYYYYMMDD.toFilter(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormaterYYYYMMDD.toFilter('')).toEqual(null);
    });

    it('expect a non string value to be null', () => {
        expect(DateFormaterYYYYMMDD.toFilter(new Date(2019, 0, 1))).toEqual(null);
    });

    it('expect full date string to be local midnight', () => {
        expect(DateFormaterYYYYMMDD.toFilter('2019-11-25')).toEqual(new Date(2019, 10, 25, 0, 0, 0, 0));
    });

    it('expect missing month and day to fall back to current month and day at midnight', () => {
        const now = new Date();
        expect(DateFormaterYYYYMMDD.toFilter('2019')).toEqual(new Date(2019, now.getMonth(), now.getDate(), 0, 0, 0, 0));
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormaterYYYYMMDD.toFilter('abc-de-fg')).toEqual('');
    });
});

describe('DateFormaterYYYYMMDD misc', () => {
    it('expect fromSourceDisplay to be same as fromSource', () => {
        const date = new Date(2019, 0, 5);
        expect(DateFormaterYYYYMMDD.fromSourceDisplay(date)).toEqual(DateFormaterYYYYMMDD.fromSource(date));
    });

    it('expect fromSourceDisplay of null to be empty string', () => {
        expect(DateFormaterYYYYMMDD.fromSourceDisplay(null)).toEqual('');
    });

    it('expect fromSourceGrouping to be same as fromSource', () => {
        const date = new Date(2019, 0, 5);
        expect(DateFormaterYYYYMMDD.fromSourceGrouping(date)).toEqual('2019-01-05');
    });

    it('expect placeholder to be YYYY-MM-DD', () => {
        expect(DateFormaterYYYYMMDD.placeholder()).toEqual('YYYY-MM-DD');
    });
});
