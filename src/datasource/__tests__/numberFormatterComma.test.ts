import { describe, expect, it } from 'vitest';
import { parseFilterText } from '../formatter';
import { NumberFormatterComma } from '../numberFormatterComma';
import { NumberFormatterDot } from '../numberFormatterDot';

describe('NumberFormatterComma.format', () => {
    it('expect null to be empty string', () => {
        expect(NumberFormatterComma.format(null)).toEqual('');
    });

    it('expect undefined to be empty string', () => {
        expect(NumberFormatterComma.format(undefined)).toEqual('');
    });

    it('expect empty string to be empty string', () => {
        expect(NumberFormatterComma.format('')).toEqual('');
    });

    it('expect a non numeric string to be empty string', () => {
        expect(NumberFormatterComma.format('abc')).toEqual('');
    });

    it('expect number to be converted to string', () => {
        expect(NumberFormatterComma.format(1234)).toEqual('1234');
    });

    it('expect zero to be string zero', () => {
        expect(NumberFormatterComma.format(0)).toEqual('0');
    });

    it('expect decimal number to use comma as separator', () => {
        expect(NumberFormatterComma.format(12.5)).toEqual('12,5');
    });

    it('expect negative decimal number to use comma as separator', () => {
        expect(NumberFormatterComma.format(-12.5)).toEqual('-12,5');
    });

    it('expect dot separated string to be converted to comma', () => {
        expect(NumberFormatterComma.format('12.5')).toEqual('12,5');
    });

    it('expect comma separated string to be unchanged', () => {
        expect(NumberFormatterComma.format('12,5')).toEqual('12,5');
    });
});

describe('NumberFormatterComma.parse', () => {
    it('expect empty string to be 0', () => {
        expect(NumberFormatterComma.parse('')).toEqual(0);
    });

    it('expect non numeric string to be 0', () => {
        expect(NumberFormatterComma.parse('abc')).toEqual(0);
    });

    it('expect string zero to be 0', () => {
        expect(NumberFormatterComma.parse('0')).toEqual(0);
    });

    it('expect comma separated string to be a number', () => {
        expect(NumberFormatterComma.parse('12,5')).toEqual(12.5);
    });

    it('expect dot separated string to be a number', () => {
        expect(NumberFormatterComma.parse('12.5')).toEqual(12.5);
    });

    it('expect negative comma separated string to be a negative number', () => {
        expect(NumberFormatterComma.parse('-12,5')).toEqual(-12.5);
    });

    it('expect string containing both dot and comma to only parse up to the comma', () => {
        expect(NumberFormatterComma.parse('1.234,5')).toEqual(1.234);
    });

    it('expect null to be null (v5 threw)', () => {
        expect(NumberFormatterComma.parse(null)).toEqual(null);
    });

    it('expect undefined to be null (v5 threw)', () => {
        expect(NumberFormatterComma.parse(undefined)).toEqual(null);
    });

    it('expect a number to be returned as is (v5 threw)', () => {
        expect(NumberFormatterComma.parse(12.5)).toEqual(12.5);
    });

    it('expect it to parse the same as NumberFormatterDot', () => {
        for (const text of ['12,5', '12.5', '-1', '', 'abc', '1.234,5', '0', 'undefined']) {
            expect(NumberFormatterComma.parse(text)).toEqual(NumberFormatterDot.parse(text));
        }
    });

    it('expect round trip parse then format to keep the value', () => {
        expect(NumberFormatterComma.format(NumberFormatterComma.parse('12,5'))).toEqual('12,5');
    });

    it('expect round trip format then parse to keep the value', () => {
        expect(NumberFormatterComma.parse(NumberFormatterComma.format(12.5))).toEqual(12.5);
    });
});

describe('NumberFormatterComma misc', () => {
    it('expect a filter to be parsed like a cell, there is no parseFilter', () => {
        expect(parseFilterText(NumberFormatterComma, '12,5')).toEqual(12.5);
    });

    it('expect no placeholder, the header filter shows its search icon', () => {
        expect(NumberFormatterComma).not.toHaveProperty('placeholder');
    });
});
