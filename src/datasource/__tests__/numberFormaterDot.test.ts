import { describe, expect, it } from 'vitest';
import { NumberFormaterDot } from '../numberFormaterDot';

describe('NumberFormaterDot.fromSource', () => {
    it('expect null to be empty string', () => {
        expect(NumberFormaterDot.fromSource(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(NumberFormaterDot.fromSource(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(NumberFormaterDot.fromSource('')).toEqual('');
    });

    it('expect a non numeric string to be empty string', () => {
        expect(NumberFormaterDot.fromSource('abc')).toEqual('');
    });

    it('expect number to be converted to string', () => {
        expect(NumberFormaterDot.fromSource(1234)).toEqual('1234');
    });

    it('expect zero to be string zero', () => {
        expect(NumberFormaterDot.fromSource(0)).toEqual('0');
    });

    it('expect negative number to be converted to string', () => {
        expect(NumberFormaterDot.fromSource(-12.5)).toEqual('-12.5');
    });

    it('expect decimal number to keep dot as separator', () => {
        expect(NumberFormaterDot.fromSource(12.5)).toEqual('12.5');
    });

    it('expect comma separated string to be converted to dot', () => {
        expect(NumberFormaterDot.fromSource('12,5')).toEqual('12.5');
    });

    it('expect dot separated string to be unchanged', () => {
        expect(NumberFormaterDot.fromSource('12.5')).toEqual('12.5');
    });
});

describe('NumberFormaterDot.toSource', () => {
    it('expect null to be null', () => {
        expect(NumberFormaterDot.toSource(null)).toEqual(null);
    });

    it('expect undefined to be null', () => {
        expect(NumberFormaterDot.toSource(undefined)).toEqual(null);
    });

    it('expect the string undefined to be null', () => {
        expect(NumberFormaterDot.toSource('undefined')).toEqual(null);
    });

    it('expect empty string to be 0', () => {
        expect(NumberFormaterDot.toSource('')).toEqual(0);
    });

    it('expect non numeric string to be 0', () => {
        expect(NumberFormaterDot.toSource('abc')).toEqual(0);
    });

    it('expect string zero to be 0', () => {
        expect(NumberFormaterDot.toSource('0')).toEqual(0);
    });

    it('expect number to be returned as is', () => {
        expect(NumberFormaterDot.toSource(12.5)).toEqual(12.5);
    });

    it('expect dot separated string to be a number', () => {
        expect(NumberFormaterDot.toSource('12.5')).toEqual(12.5);
    });

    it('expect comma separated string to be a number', () => {
        expect(NumberFormaterDot.toSource('12,5')).toEqual(12.5);
    });

    it('expect negative comma separated string to be a negative number', () => {
        expect(NumberFormaterDot.toSource('-12,5')).toEqual(-12.5);
    });

    it('expect string containing both dot and comma to only parse up to the comma', () => {
        expect(NumberFormaterDot.toSource('1.234,5')).toEqual(1.234);
    });

    it('expect round trip toSource then fromSource to keep the value', () => {
        expect(NumberFormaterDot.fromSource(NumberFormaterDot.toSource('12,5'))).toEqual('12.5');
    });

    it('expect round trip fromSource then toSource to keep the value', () => {
        expect(NumberFormaterDot.toSource(NumberFormaterDot.fromSource(12.5))).toEqual(12.5);
    });
});

describe('NumberFormaterDot misc', () => {
    it('expect toFilter to be same as toSource', () => {
        expect(NumberFormaterDot.toFilter('12,5')).toEqual(12.5);
    });

    it('expect toFilter of null to be null', () => {
        expect(NumberFormaterDot.toFilter(null)).toEqual(null);
    });

    it('expect fromSourceDisplay to be same as fromSource', () => {
        expect(NumberFormaterDot.fromSourceDisplay('12,5')).toEqual(NumberFormaterDot.fromSource('12,5'));
    });

    it('expect fromSourceGrouping to be same as fromSource', () => {
        expect(NumberFormaterDot.fromSourceGrouping(12.5)).toEqual('12.5');
    });

    it('expect placeholder to be empty string', () => {
        expect(NumberFormaterDot.placeholder()).toEqual('');
    });
});
