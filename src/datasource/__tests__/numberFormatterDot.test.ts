import { describe, expect, it } from 'vitest';
import { NumberFormatterDot } from '../numberFormatterDot';

describe('NumberFormatterDot.fromSource', () => {
    it('expect null to be empty string', () => {
        expect(NumberFormatterDot.fromSource(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(NumberFormatterDot.fromSource(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(NumberFormatterDot.fromSource('')).toEqual('');
    });

    it('expect a non numeric string to be empty string', () => {
        expect(NumberFormatterDot.fromSource('abc')).toEqual('');
    });

    it('expect number to be converted to string', () => {
        expect(NumberFormatterDot.fromSource(1234)).toEqual('1234');
    });

    it('expect zero to be string zero', () => {
        expect(NumberFormatterDot.fromSource(0)).toEqual('0');
    });

    it('expect negative number to be converted to string', () => {
        expect(NumberFormatterDot.fromSource(-12.5)).toEqual('-12.5');
    });

    it('expect decimal number to keep dot as separator', () => {
        expect(NumberFormatterDot.fromSource(12.5)).toEqual('12.5');
    });

    it('expect comma separated string to be converted to dot', () => {
        expect(NumberFormatterDot.fromSource('12,5')).toEqual('12.5');
    });

    it('expect dot separated string to be unchanged', () => {
        expect(NumberFormatterDot.fromSource('12.5')).toEqual('12.5');
    });
});

describe('NumberFormatterDot.toSource', () => {
    it('expect null to be null', () => {
        expect(NumberFormatterDot.toSource(null)).toEqual(null);
    });

    it('expect undefined to be null', () => {
        expect(NumberFormatterDot.toSource(undefined)).toEqual(null);
    });

    it('expect the string undefined to be null', () => {
        expect(NumberFormatterDot.toSource('undefined')).toEqual(null);
    });

    it('expect empty string to be 0', () => {
        expect(NumberFormatterDot.toSource('')).toEqual(0);
    });

    it('expect non numeric string to be 0', () => {
        expect(NumberFormatterDot.toSource('abc')).toEqual(0);
    });

    it('expect string zero to be 0', () => {
        expect(NumberFormatterDot.toSource('0')).toEqual(0);
    });

    it('expect number to be returned as is', () => {
        expect(NumberFormatterDot.toSource(12.5)).toEqual(12.5);
    });

    it('expect dot separated string to be a number', () => {
        expect(NumberFormatterDot.toSource('12.5')).toEqual(12.5);
    });

    it('expect comma separated string to be a number', () => {
        expect(NumberFormatterDot.toSource('12,5')).toEqual(12.5);
    });

    it('expect negative comma separated string to be a negative number', () => {
        expect(NumberFormatterDot.toSource('-12,5')).toEqual(-12.5);
    });

    it('expect string containing both dot and comma to only parse up to the comma', () => {
        expect(NumberFormatterDot.toSource('1.234,5')).toEqual(1.234);
    });

    it('expect round trip toSource then fromSource to keep the value', () => {
        expect(NumberFormatterDot.fromSource(NumberFormatterDot.toSource('12,5'))).toEqual('12.5');
    });

    it('expect round trip fromSource then toSource to keep the value', () => {
        expect(NumberFormatterDot.toSource(NumberFormatterDot.fromSource(12.5))).toEqual(12.5);
    });
});

describe('NumberFormatterDot misc', () => {
    it('expect toFilter to be same as toSource', () => {
        expect(NumberFormatterDot.toFilter('12,5')).toEqual(12.5);
    });

    it('expect toFilter of null to be null', () => {
        expect(NumberFormatterDot.toFilter(null)).toEqual(null);
    });

    it('expect fromSourceDisplay to be same as fromSource', () => {
        expect(NumberFormatterDot.fromSourceDisplay('12,5')).toEqual(NumberFormatterDot.fromSource('12,5'));
    });

    it('expect fromSourceGrouping to be same as fromSource', () => {
        expect(NumberFormatterDot.fromSourceGrouping(12.5)).toEqual('12.5');
    });

    it('expect placeholder to be empty string', () => {
        expect(NumberFormatterDot.placeholder()).toEqual('');
    });
});
