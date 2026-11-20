import { describe, expect, it } from 'vitest';
import { NumberFormatterComma } from '../numberFormatterComma';

describe('NumberFormatterComma.fromSource', () => {
    it('expect null to be empty string', () => {
        expect(NumberFormatterComma.fromSource(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(NumberFormatterComma.fromSource(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(NumberFormatterComma.fromSource('')).toEqual('');
    });

    it('expect a non numeric string to be empty string', () => {
        expect(NumberFormatterComma.fromSource('abc')).toEqual('');
    });

    it('expect number to be converted to string', () => {
        expect(NumberFormatterComma.fromSource(1234)).toEqual('1234');
    });

    it('expect zero to be string zero', () => {
        expect(NumberFormatterComma.fromSource(0)).toEqual('0');
    });

    it('expect decimal number to use comma as separator', () => {
        expect(NumberFormatterComma.fromSource(12.5)).toEqual('12,5');
    });

    it('expect negative decimal number to use comma as separator', () => {
        expect(NumberFormatterComma.fromSource(-12.5)).toEqual('-12,5');
    });

    it('expect dot separated string to be converted to comma', () => {
        expect(NumberFormatterComma.fromSource('12.5')).toEqual('12,5');
    });

    it('expect comma separated string to be unchanged', () => {
        expect(NumberFormatterComma.fromSource('12,5')).toEqual('12,5');
    });
});

describe('NumberFormatterComma.toSource', () => {
    it('expect empty string to be 0', () => {
        expect(NumberFormatterComma.toSource('')).toEqual(0);
    });

    it('expect non numeric string to be 0', () => {
        expect(NumberFormatterComma.toSource('abc')).toEqual(0);
    });

    it('expect string zero to be 0', () => {
        expect(NumberFormatterComma.toSource('0')).toEqual(0);
    });

    it('expect comma separated string to be a number', () => {
        expect(NumberFormatterComma.toSource('12,5')).toEqual(12.5);
    });

    it('expect dot separated string to be a number', () => {
        expect(NumberFormatterComma.toSource('12.5')).toEqual(12.5);
    });

    it('expect negative comma separated string to be a negative number', () => {
        expect(NumberFormatterComma.toSource('-12,5')).toEqual(-12.5);
    });

    it('expect string containing both dot and comma to only parse up to the comma', () => {
        expect(NumberFormatterComma.toSource('1.234,5')).toEqual(1.234);
    });

    it('expect null to throw since it has no includes method', () => {
        expect(() => NumberFormatterComma.toSource(null)).toThrow();
    });

    it('expect undefined to throw since it has no includes method', () => {
        expect(() => NumberFormatterComma.toSource(undefined)).toThrow();
    });

    it('expect a number to throw since it has no includes method', () => {
        expect(() => NumberFormatterComma.toSource(12.5)).toThrow();
    });

    it('expect round trip toSource then fromSource to keep the value', () => {
        expect(NumberFormatterComma.fromSource(NumberFormatterComma.toSource('12,5'))).toEqual('12,5');
    });

    it('expect round trip fromSource then toSource to keep the value', () => {
        expect(NumberFormatterComma.toSource(NumberFormatterComma.fromSource(12.5))).toEqual(12.5);
    });
});

describe('NumberFormatterComma misc', () => {
    it('expect toFilter to be same as toSource', () => {
        expect(NumberFormatterComma.toFilter('12,5')).toEqual(12.5);
    });

    it('expect fromSourceDisplay to be same as fromSource', () => {
        expect(NumberFormatterComma.fromSourceDisplay('12.5')).toEqual(NumberFormatterComma.fromSource('12.5'));
    });

    it('expect fromSourceGrouping to be same as fromSource', () => {
        expect(NumberFormatterComma.fromSourceGrouping(12.5)).toEqual('12,5');
    });

    it('expect placeholder to be empty string', () => {
        expect(NumberFormatterComma.placeholder()).toEqual('');
    });
});
