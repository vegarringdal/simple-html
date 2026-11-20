import { describe, expect, it } from 'vitest';
import { DateFormatterDDMMYYYY } from '../DateFormatterDDMMYYYY';

describe('DateFormatterDDMMYYYY.fromSource', () => {
    it('expect null to be empty string', () => {
        expect(DateFormatterDDMMYYYY.fromSource(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(DateFormatterDDMMYYYY.fromSource(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(DateFormatterDDMMYYYY.fromSource('')).toEqual('');
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterDDMMYYYY.fromSource('this is not a date')).toEqual('');
    });

    it('expect local date to be formated as DD.MM.YYYY', () => {
        expect(DateFormatterDDMMYYYY.fromSource(new Date(2019, 10, 25, 13, 45, 12))).toEqual('25.11.2019');
    });

    it('expect single digit month and day to be zero padded', () => {
        expect(DateFormatterDDMMYYYY.fromSource(new Date(2019, 0, 5))).toEqual('05.01.2019');
    });

    it('expect leap day to be formated correctly', () => {
        expect(DateFormatterDDMMYYYY.fromSource(new Date(2020, 1, 29))).toEqual('29.02.2020');
    });
});

describe('DateFormatterDDMMYYYY.toSource', () => {
    it('expect null to be null', () => {
        expect(DateFormatterDDMMYYYY.toSource(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormatterDDMMYYYY.toSource(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormatterDDMMYYYY.toSource('')).toEqual(null);
    });

    it('expect number 0 to be null', () => {
        expect(DateFormatterDDMMYYYY.toSource(0)).toEqual(null);
    });

    it('expect a non string value to be null', () => {
        expect(DateFormatterDDMMYYYY.toSource(new Date(2019, 0, 1))).toEqual(null);
    });

    it('expect full date string to be a local date', () => {
        const result = DateFormatterDDMMYYYY.toSource('25.11.2019') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
    });

    it('expect missing year to fall back to current year', () => {
        const now = new Date();
        const result = DateFormatterDDMMYYYY.toSource('25.11') as Date;
        expect(result.getFullYear()).toEqual(now.getFullYear());
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
    });

    it('expect missing month and year to fall back to current month and year', () => {
        const now = new Date();
        const result = DateFormatterDDMMYYYY.toSource('25') as Date;
        expect(result.getFullYear()).toEqual(now.getFullYear());
        expect(result.getMonth()).toEqual(now.getMonth());
        expect(result.getDate()).toEqual(25);
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterDDMMYYYY.toSource('aa.bb.cccc')).toEqual('');
    });

    it('expect round trip toSource then fromSource to keep the date', () => {
        expect(DateFormatterDDMMYYYY.fromSource(DateFormatterDDMMYYYY.toSource('25.11.2019'))).toEqual('25.11.2019');
    });

    it('expect round trip with single digit month and day to keep the date', () => {
        expect(DateFormatterDDMMYYYY.fromSource(DateFormatterDDMMYYYY.toSource('05.01.2019'))).toEqual('05.01.2019');
    });
});

describe('DateFormatterDDMMYYYY.toFilter', () => {
    it('expect null to be null', () => {
        expect(DateFormatterDDMMYYYY.toFilter(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormatterDDMMYYYY.toFilter(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormatterDDMMYYYY.toFilter('')).toEqual(null);
    });

    it('expect a non string value to be null', () => {
        expect(DateFormatterDDMMYYYY.toFilter(12345)).toEqual(null);
    });

    it('expect full date string to be local midnight', () => {
        expect(DateFormatterDDMMYYYY.toFilter('25.11.2019')).toEqual(new Date(2019, 10, 25, 0, 0, 0, 0));
    });

    it('expect missing month and year to fall back to current month and year at midnight', () => {
        const now = new Date();
        expect(DateFormatterDDMMYYYY.toFilter('25')).toEqual(new Date(now.getFullYear(), now.getMonth(), 25, 0, 0, 0, 0));
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterDDMMYYYY.toFilter('aa.bb.cccc')).toEqual('');
    });
});

describe('DateFormatterDDMMYYYY misc', () => {
    it('expect fromSourceDisplay to be same as fromSource', () => {
        const date = new Date(2019, 0, 5);
        expect(DateFormatterDDMMYYYY.fromSourceDisplay(date)).toEqual(DateFormatterDDMMYYYY.fromSource(date));
    });

    it('expect fromSourceGrouping to be formated as DD.MM.YYYY', () => {
        expect(DateFormatterDDMMYYYY.fromSourceGrouping(new Date(2019, 0, 5))).toEqual('05.01.2019');
    });

    it('expect placeholder to be DD.MM.YYYY', () => {
        expect(DateFormatterDDMMYYYY.placeholder()).toEqual('DD.MM.YYYY');
    });
});
