import { describe, expect, it } from 'vitest';
import { NumberFormaterComma } from '../numberFormaterComma';

describe('NumberFormaterComma.fromSource', () => {
    it('expect null to be empty string', () => {
        expect(NumberFormaterComma.fromSource(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(NumberFormaterComma.fromSource(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(NumberFormaterComma.fromSource('')).toEqual('');
    });

    it('expect a non numeric string to be empty string', () => {
        expect(NumberFormaterComma.fromSource('abc')).toEqual('');
    });

    it('expect number to be converted to string', () => {
        expect(NumberFormaterComma.fromSource(1234)).toEqual('1234');
    });

    it('expect zero to be string zero', () => {
        expect(NumberFormaterComma.fromSource(0)).toEqual('0');
    });

    it('expect decimal number to use comma as separator', () => {
        expect(NumberFormaterComma.fromSource(12.5)).toEqual('12,5');
    });

    it('expect negative decimal number to use comma as separator', () => {
        expect(NumberFormaterComma.fromSource(-12.5)).toEqual('-12,5');
    });

    it('expect dot separated string to be converted to comma', () => {
        expect(NumberFormaterComma.fromSource('12.5')).toEqual('12,5');
    });

    it('expect comma separated string to be unchanged', () => {
        expect(NumberFormaterComma.fromSource('12,5')).toEqual('12,5');
    });
});

describe('NumberFormaterComma.toSource', () => {
    it('expect empty string to be 0', () => {
        expect(NumberFormaterComma.toSource('')).toEqual(0);
    });

    it('expect non numeric string to be 0', () => {
        expect(NumberFormaterComma.toSource('abc')).toEqual(0);
    });

    it('expect string zero to be 0', () => {
        expect(NumberFormaterComma.toSource('0')).toEqual(0);
    });

    it('expect comma separated string to be a number', () => {
        expect(NumberFormaterComma.toSource('12,5')).toEqual(12.5);
    });

    it('expect dot separated string to be a number', () => {
        expect(NumberFormaterComma.toSource('12.5')).toEqual(12.5);
    });

    it('expect negative comma separated string to be a negative number', () => {
        expect(NumberFormaterComma.toSource('-12,5')).toEqual(-12.5);
    });

    it('expect string containing both dot and comma to only parse up to the comma', () => {
        expect(NumberFormaterComma.toSource('1.234,5')).toEqual(1.234);
    });

    it('expect null to throw since it has no includes method', () => {
        expect(() => NumberFormaterComma.toSource(null)).toThrow();
    });

    it('expect undefined to throw since it has no includes method', () => {
        expect(() => NumberFormaterComma.toSource(undefined)).toThrow();
    });

    it('expect a number to throw since it has no includes method', () => {
        expect(() => NumberFormaterComma.toSource(12.5)).toThrow();
    });

    it('expect round trip toSource then fromSource to keep the value', () => {
        expect(NumberFormaterComma.fromSource(NumberFormaterComma.toSource('12,5'))).toEqual('12,5');
    });

    it('expect round trip fromSource then toSource to keep the value', () => {
        expect(NumberFormaterComma.toSource(NumberFormaterComma.fromSource(12.5))).toEqual(12.5);
    });
});

describe('NumberFormaterComma misc', () => {
    it('expect toFilter to be same as toSource', () => {
        expect(NumberFormaterComma.toFilter('12,5')).toEqual(12.5);
    });

    it('expect fromSourceDisplay to be same as fromSource', () => {
        expect(NumberFormaterComma.fromSourceDisplay('12.5')).toEqual(NumberFormaterComma.fromSource('12.5'));
    });

    it('expect fromSourceGrouping to be same as fromSource', () => {
        expect(NumberFormaterComma.fromSourceGrouping(12.5)).toEqual('12,5');
    });

    it('expect placeholder to be empty string', () => {
        expect(NumberFormaterComma.placeholder()).toEqual('');
    });
});
