import { describe, expect, it } from 'vitest';
import { DateFormaterDDMMYYYYTHHMMSS } from '../DateFormaterDDMMYYYYTHHMMSS';

describe('DateFormaterDDMMYYYYTHHMMSS.fromSource', () => {
    it('expect null to be empty string', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.fromSource(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.fromSource(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.fromSource('')).toEqual('');
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.fromSource('this is not a date')).toEqual('');
    });

    it('expect local date to be formated as DD.MM.YYYYTHH:MM:SS', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.fromSource(new Date(2019, 10, 25, 13, 45, 12))).toEqual('25.11.2019T13:45:12');
    });

    it('expect single digit month, day, hour, minute and second to be zero padded', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.fromSource(new Date(2019, 0, 5, 3, 4, 9))).toEqual('05.01.2019T03:04:09');
    });

    it('expect midnight to be formated as 00:00:00', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.fromSource(new Date(2019, 0, 5, 0, 0, 0))).toEqual('05.01.2019T00:00:00');
    });
});

describe('DateFormaterDDMMYYYYTHHMMSS.toSource', () => {
    it('expect null to be null', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.toSource(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.toSource(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.toSource('')).toEqual(null);
    });

    it('expect a non string value to be null', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.toSource(new Date(2019, 0, 1))).toEqual(null);
    });

    it('expect full date and time string to be a local date', () => {
        const result = DateFormaterDDMMYYYYTHHMMSS.toSource('25.11.2019T13:45:12') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(13);
        expect(result.getMinutes()).toEqual(45);
        expect(result.getSeconds()).toEqual(12);
    });

    it('expect zero time parts to be kept', () => {
        const result = DateFormaterDDMMYYYYTHHMMSS.toSource('25.11.2019T00:00:00') as Date;
        expect(result.getHours()).toEqual(0);
        expect(result.getMinutes()).toEqual(0);
        expect(result.getSeconds()).toEqual(0);
    });

    it('expect missing time part to fall back to current time', () => {
        const now = new Date();
        const result = DateFormaterDDMMYYYYTHHMMSS.toSource('25.11.2019') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(now.getHours());
    });

    it('expect missing month and year to fall back to current month and year', () => {
        const now = new Date();
        const result = DateFormaterDDMMYYYYTHHMMSS.toSource('25T13:45:12') as Date;
        expect(result.getFullYear()).toEqual(now.getFullYear());
        expect(result.getMonth()).toEqual(now.getMonth());
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(13);
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.toSource('aa.bb.ccccThh:mm:ss')).toEqual('');
    });

    it('expect round trip toSource then fromSource to keep the date and time', () => {
        const value = '25.11.2019T13:45:12';
        expect(DateFormaterDDMMYYYYTHHMMSS.fromSource(DateFormaterDDMMYYYYTHHMMSS.toSource(value))).toEqual(value);
    });

    it('expect round trip with single digit parts to keep the date and time', () => {
        const value = '05.01.2019T03:04:09';
        expect(DateFormaterDDMMYYYYTHHMMSS.fromSource(DateFormaterDDMMYYYYTHHMMSS.toSource(value))).toEqual(value);
    });
});

describe('DateFormaterDDMMYYYYTHHMMSS.toFilter', () => {
    it('expect null to be null', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.toFilter(null)).toEqual(null);
    });

    it('expect undefined to be undefined', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.toFilter(undefined)).toEqual(undefined);
    });

    it('expect empty string to be null', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.toFilter('')).toEqual(null);
    });

    it('expect a non string value to be null', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.toFilter(12345)).toEqual(null);
    });

    it('expect missing time part to fall back to midnight', () => {
        const result = DateFormaterDDMMYYYYTHHMMSS.toFilter('25.11.2019') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(10);
        expect(result.getDate()).toEqual(25);
        expect(result.getHours()).toEqual(0);
        expect(result.getMinutes()).toEqual(0);
        expect(result.getSeconds()).toEqual(0);
    });

    it('expect given time part to be kept', () => {
        const result = DateFormaterDDMMYYYYTHHMMSS.toFilter('25.11.2019T13:45:12') as Date;
        expect(result.getHours()).toEqual(13);
        expect(result.getMinutes()).toEqual(45);
        expect(result.getSeconds()).toEqual(12);
    });

    it('expect invalid date string to be empty string', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.toFilter('aa.bb.cccc')).toEqual('');
    });
});

describe('DateFormaterDDMMYYYYTHHMMSS misc', () => {
    it('expect fromSourceDisplay to be same as fromSource', () => {
        const date = new Date(2019, 0, 5, 3, 4, 9);
        expect(DateFormaterDDMMYYYYTHHMMSS.fromSourceDisplay(date)).toEqual(DateFormaterDDMMYYYYTHHMMSS.fromSource(date));
    });

    it('expect fromSourceGrouping to be formated as DD.MM.YYYYTHH:MM:SS', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.fromSourceGrouping(new Date(2019, 0, 5, 3, 4, 9))).toEqual('05.01.2019T03:04:09');
    });

    it('expect placeholder to be DD.MM.YYYYTHH:MM:SS', () => {
        expect(DateFormaterDDMMYYYYTHHMMSS.placeholder()).toEqual('DD.MM.YYYYTHH:MM:SS');
    });
});
