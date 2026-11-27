import { describe, expect, it } from 'vitest';
import { DateFormatterDDMMYYYY } from '../DateFormatterDDMMYYYY';

describe('DateFormatterDDMMYYYY.format', () => {
    it('expect null to be empty string', () => {
        expect(DateFormatterDDMMYYYY.format(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(DateFormatterDDMMYYYY.format(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(DateFormatterDDMMYYYY.format('')).toEqual('');
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterDDMMYYYY.format('this is not a date')).toEqual('');
    });

    it('expect local date to be formated as DD.MM.YYYY', () => {
        expect(DateFormatterDDMMYYYY.format(new Date(2019, 10, 25, 13, 45, 12))).toEqual('25.11.2019');
    });

    it('expect single digit month and day to be zero padded', () => {
        expect(DateFormatterDDMMYYYY.format(new Date(2019, 0, 5))).toEqual('05.01.2019');
    });

    it('expect leap day to be formated correctly', () => {
        expect(DateFormatterDDMMYYYY.format(new Date(2020, 1, 29))).toEqual('29.02.2020');
    });
});

describe('DateFormatterDDMMYYYY.parse', () => {
    it('expect null to be null', () => {
        expect(DateFormatterDDMMYYYY.parse(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormatterDDMMYYYY.parse(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormatterDDMMYYYY.parse('')).toEqual(null);
    });

    it('expect number 0 to be null', () => {
        expect(DateFormatterDDMMYYYY.parse(0)).toEqual(null);
    });

    it('expect a Date to pass through, time of day kept (v5 gave null)', () => {
        const date = new Date(2019, 0, 1, 13, 45);
        expect(DateFormatterDDMMYYYY.parse(date)).toBe(date);
    });

    it('expect a number to be null', () => {
        expect(DateFormatterDDMMYYYY.parse(12345)).toEqual(null);
    });

    it('expect full date string to be a local date', () => {
        const result = DateFormatterDDMMYYYY.parse('25.11.2019') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
    });

    it('expect missing year to fall back to current year', () => {
        const now = new Date();
        const result = DateFormatterDDMMYYYY.parse('25.11') as Date;
        expect(result.getFullYear()).toEqual(now.getFullYear());
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
    });

    it('expect missing month and year to fall back to current month and year', () => {
        const now = new Date();
        const result = DateFormatterDDMMYYYY.parse('25') as Date;
        expect(result.getFullYear()).toEqual(now.getFullYear());
        expect(result.getMonth()).toEqual(now.getMonth());
        expect(result.getDate()).toEqual(25);
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterDDMMYYYY.parse('aa.bb.cccc')).toEqual('');
    });

    it('expect round trip parse then format to keep the date', () => {
        expect(DateFormatterDDMMYYYY.format(DateFormatterDDMMYYYY.parse('25.11.2019'))).toEqual('25.11.2019');
    });

    it('expect round trip with single digit month and day to keep the date', () => {
        expect(DateFormatterDDMMYYYY.format(DateFormatterDDMMYYYY.parse('05.01.2019'))).toEqual('05.01.2019');
    });
});

describe('DateFormatterDDMMYYYY.parseFilter', () => {
    it('expect null to be null', () => {
        expect(DateFormatterDDMMYYYY.parseFilter(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormatterDDMMYYYY.parseFilter(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormatterDDMMYYYY.parseFilter('')).toEqual(null);
    });

    it('expect a number to be null', () => {
        expect(DateFormatterDDMMYYYY.parseFilter(12345)).toEqual(null);
    });

    it('expect a Date to be moved to the start of its day (v5 gave null)', () => {
        expect(DateFormatterDDMMYYYY.parseFilter(new Date(2019, 0, 1, 13, 45, 12, 500))).toEqual(
            new Date(2019, 0, 1, 0, 0, 0, 0)
        );
    });

    it('expect full date string to be local midnight', () => {
        expect(DateFormatterDDMMYYYY.parseFilter('25.11.2019')).toEqual(new Date(2019, 10, 25, 0, 0, 0, 0));
    });

    it('expect missing month and year to fall back to current month and year at midnight', () => {
        const now = new Date();
        expect(DateFormatterDDMMYYYY.parseFilter('25')).toEqual(new Date(now.getFullYear(), now.getMonth(), 25, 0, 0, 0, 0));
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormatterDDMMYYYY.parseFilter('aa.bb.cccc')).toEqual('');
    });
});

describe('DateFormatterDDMMYYYY misc', () => {
    it('expect placeholder to be DD.MM.YYYY', () => {
        expect(DateFormatterDDMMYYYY.placeholder).toEqual('DD.MM.YYYY');
    });
});
