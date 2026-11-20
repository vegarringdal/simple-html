import { describe, expect, it } from 'vitest';
import { parseFilterText } from '../formatter';
import { NumberFormatterDot } from '../numberFormatterDot';

describe('NumberFormatterDot.format', () => {
    it('expect null to be empty string', () => {
        expect(NumberFormatterDot.format(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(NumberFormatterDot.format(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(NumberFormatterDot.format('')).toEqual('');
    });

    it('expect a non numeric string to be empty string', () => {
        expect(NumberFormatterDot.format('abc')).toEqual('');
    });

    it('expect number to be converted to string', () => {
        expect(NumberFormatterDot.format(1234)).toEqual('1234');
    });

    it('expect zero to be string zero', () => {
        expect(NumberFormatterDot.format(0)).toEqual('0');
    });

    it('expect negative number to be converted to string', () => {
        expect(NumberFormatterDot.format(-12.5)).toEqual('-12.5');
    });

    it('expect decimal number to keep dot as separator', () => {
        expect(NumberFormatterDot.format(12.5)).toEqual('12.5');
    });

    it('expect comma separated string to be converted to dot', () => {
        expect(NumberFormatterDot.format('12,5')).toEqual('12.5');
    });

    it('expect dot separated string to be unchanged', () => {
        expect(NumberFormatterDot.format('12.5')).toEqual('12.5');
    });
});

describe('NumberFormatterDot.parse', () => {
    it('expect null to be null', () => {
        expect(NumberFormatterDot.parse(null)).toEqual(null);
    });

    it('expect undefined to be null', () => {
        expect(NumberFormatterDot.parse(undefined)).toEqual(null);
    });

    it('expect the string undefined to be null', () => {
        expect(NumberFormatterDot.parse('undefined')).toEqual(null);
    });

    it('expect empty string to be 0', () => {
        expect(NumberFormatterDot.parse('')).toEqual(0);
    });

    it('expect non numeric string to be 0', () => {
        expect(NumberFormatterDot.parse('abc')).toEqual(0);
    });

    it('expect string zero to be 0', () => {
        expect(NumberFormatterDot.parse('0')).toEqual(0);
    });

    it('expect number to be returned as is', () => {
        expect(NumberFormatterDot.parse(12.5)).toEqual(12.5);
    });

    it('expect dot separated string to be a number', () => {
        expect(NumberFormatterDot.parse('12.5')).toEqual(12.5);
    });

    it('expect comma separated string to be a number', () => {
        expect(NumberFormatterDot.parse('12,5')).toEqual(12.5);
    });

    it('expect negative comma separated string to be a negative number', () => {
        expect(NumberFormatterDot.parse('-12,5')).toEqual(-12.5);
    });

    it('expect string containing both dot and comma to only parse up to the comma', () => {
        expect(NumberFormatterDot.parse('1.234,5')).toEqual(1.234);
    });

    it('expect round trip parse then format to keep the value', () => {
        expect(NumberFormatterDot.format(NumberFormatterDot.parse('12,5'))).toEqual('12.5');
    });

    it('expect round trip format then parse to keep the value', () => {
        expect(NumberFormatterDot.parse(NumberFormatterDot.format(12.5))).toEqual(12.5);
    });
});

describe('NumberFormatterDot misc', () => {
    it('expect a filter to be parsed like a cell, there is no parseFilter', () => {
        expect(NumberFormatterDot).not.toHaveProperty('parseFilter');
        expect(parseFilterText(NumberFormatterDot, '12,5')).toEqual(12.5);
    });

    it('expect no placeholder, the header filter shows its search icon', () => {
        expect(NumberFormatterDot).not.toHaveProperty('placeholder');
    });

    it('expect a variant made with spread to keep the parse', () => {
        const twoDecimals = {
            ...NumberFormatterDot,
            format: (value: unknown) => (typeof value === 'number' ? value.toFixed(2) : '')
        };
        expect(twoDecimals.format(12.5)).toEqual('12.50');
        expect(twoDecimals.parse('12,5')).toEqual(12.5);
    });
});
