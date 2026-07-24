import { describe, expect, it } from 'vitest';
import { DateFormaterDDMMYYYY } from '../DateFormaterDDMMYYYY';

describe('DateFormaterDDMMYYYY.fromSource', () => {
    it('expect null to be empty string', () => {
        expect(DateFormaterDDMMYYYY.fromSource(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(DateFormaterDDMMYYYY.fromSource(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(DateFormaterDDMMYYYY.fromSource('')).toEqual('');
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormaterDDMMYYYY.fromSource('this is not a date')).toEqual('');
    });

    it('expect local date to be formated as DD.MM.YYYY', () => {
        expect(DateFormaterDDMMYYYY.fromSource(new Date(2019, 10, 25, 13, 45, 12))).toEqual('25.11.2019');
    });

    it('expect single digit month and day to be zero padded', () => {
        expect(DateFormaterDDMMYYYY.fromSource(new Date(2019, 0, 5))).toEqual('05.01.2019');
    });

    it('expect leap day to be formated correctly', () => {
        expect(DateFormaterDDMMYYYY.fromSource(new Date(2020, 1, 29))).toEqual('29.02.2020');
    });
});

describe('DateFormaterDDMMYYYY.toSource', () => {
    it('expect null to be null', () => {
        expect(DateFormaterDDMMYYYY.toSource(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormaterDDMMYYYY.toSource(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormaterDDMMYYYY.toSource('')).toEqual(null);
    });

    it('expect number 0 to be null', () => {
        expect(DateFormaterDDMMYYYY.toSource(0)).toEqual(null);
    });

    it('expect a non string value to be null', () => {
        expect(DateFormaterDDMMYYYY.toSource(new Date(2019, 0, 1))).toEqual(null);
    });

    it('expect full date string to be a local date', () => {
        const result = DateFormaterDDMMYYYY.toSource('25.11.2019') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
    });

    it('expect missing year to fall back to current year', () => {
        const now = new Date();
        const result = DateFormaterDDMMYYYY.toSource('25.11') as Date;
        expect(result.getFullYear()).toEqual(now.getFullYear());
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
    });

    it('expect missing month and year to fall back to current month and year', () => {
        const now = new Date();
        const result = DateFormaterDDMMYYYY.toSource('25') as Date;
        expect(result.getFullYear()).toEqual(now.getFullYear());
        expect(result.getMonth()).toEqual(now.getMonth());
        expect(result.getDate()).toEqual(25);
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormaterDDMMYYYY.toSource('aa.bb.cccc')).toEqual('');
    });

    it('expect round trip toSource then fromSource to keep the date', () => {
        expect(DateFormaterDDMMYYYY.fromSource(DateFormaterDDMMYYYY.toSource('25.11.2019'))).toEqual('25.11.2019');
    });

    it('expect round trip with single digit month and day to keep the date', () => {
        expect(DateFormaterDDMMYYYY.fromSource(DateFormaterDDMMYYYY.toSource('05.01.2019'))).toEqual('05.01.2019');
    });
});

describe('DateFormaterDDMMYYYY.toFilter', () => {
    it('expect null to be null', () => {
        expect(DateFormaterDDMMYYYY.toFilter(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormaterDDMMYYYY.toFilter(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormaterDDMMYYYY.toFilter('')).toEqual(null);
    });

    it('expect a non string value to be null', () => {
        expect(DateFormaterDDMMYYYY.toFilter(12345)).toEqual(null);
    });

    it('expect full date string to be local midnight', () => {
        expect(DateFormaterDDMMYYYY.toFilter('25.11.2019')).toEqual(new Date(2019, 10, 25, 0, 0, 0, 0));
    });

    it('expect missing month and year to fall back to current month and year at midnight', () => {
        const now = new Date();
        expect(DateFormaterDDMMYYYY.toFilter('25')).toEqual(new Date(now.getFullYear(), now.getMonth(), 25, 0, 0, 0, 0));
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormaterDDMMYYYY.toFilter('aa.bb.cccc')).toEqual('');
    });
});

describe('DateFormaterDDMMYYYY misc', () => {
    it('expect fromSourceDisplay to be same as fromSource', () => {
        const date = new Date(2019, 0, 5);
        expect(DateFormaterDDMMYYYY.fromSourceDisplay(date)).toEqual(DateFormaterDDMMYYYY.fromSource(date));
    });

    it('expect fromSourceGrouping to be formated as DD.MM.YYYY', () => {
        expect(DateFormaterDDMMYYYY.fromSourceGrouping(new Date(2019, 0, 5))).toEqual('05.01.2019');
    });

    it('expect placeholder to be DD.MM.YYYY', () => {
        expect(DateFormaterDDMMYYYY.placeholder()).toEqual('DD.MM.YYYY');
    });
});
