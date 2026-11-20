import { describe, expect, it } from 'vitest';
import { BooleanFormatter } from '../booleanFormatter';
import { DateFormatterDDMMYYYY } from '../DateFormatterDDMMYYYY';
import { DateFormatterYYYYMMDD } from '../DateFormatterYYYYMMDD';
import { DateFormatterYYYYMMDDTHHMMSS } from '../DateFormatterYYYYMMDDTHHMMSS';
import { Datasource } from '../dataSource';
import { NumberFormatterComma } from '../numberFormatterComma';
import { NumberFormatterDot } from '../numberFormatterDot';
import { TextFormatter } from '../textFormatter';

/**
 * Every type has a default formatter (the v5 DefaultValueFormatter switched on the type instead).
 * `formatters` replaces the default of a type, a field's own formatter wins over both.
 */

describe('default formatters - one per type', () => {
    const datasource = new Datasource({
        fields: { name: 'text', amount: 'number', active: 'boolean', created: 'date', changed: 'datetime' }
    });

    it('expect the built-in default for each type', () => {
        expect(datasource.getFormatter('name')).toBe(TextFormatter);
        expect(datasource.getFormatter('amount')).toBe(NumberFormatterDot);
        expect(datasource.getFormatter('active')).toBe(BooleanFormatter);
        expect(datasource.getFormatter('created')).toBe(DateFormatterYYYYMMDD);
        expect(datasource.getFormatter('changed')).toBe(DateFormatterYYYYMMDDTHHMMSS);
    });

    it('expect values to be formatted by their type', () => {
        expect(datasource.getFormatter('name').format('hello')).toEqual('hello');
        expect(datasource.getFormatter('amount').format(12.5)).toEqual('12.5');
        expect(datasource.getFormatter('active').format(true)).toEqual('true');
        expect(datasource.getFormatter('created').format(new Date(2019, 0, 5, 13, 45))).toEqual('2019-01-05');
        expect(datasource.getFormatter('changed').format(new Date(2019, 0, 5, 13, 45, 12))).toEqual('2019-01-05T13:45:12');
    });

    it('expect text to be parsed by its type', () => {
        expect(datasource.getFormatter('amount').parse('12,5')).toEqual(12.5);
        expect(datasource.getFormatter('active').parse('true')).toEqual(true);
        const created = datasource.getFormatter('created').parse('2019-01-05') as Date;
        expect([created.getFullYear(), created.getMonth(), created.getDate()]).toEqual([2019, 0, 5]);
    });

    it('expect only the date types to have a placeholder', () => {
        expect(datasource.getFormatter('created').placeholder).toEqual('YYYY-MM-DD');
        expect(datasource.getFormatter('changed').placeholder).toEqual('YYYY-MM-DDTHH:MM:SS');
        expect(datasource.getFormatter('name').placeholder).toBeUndefined();
        expect(datasource.getFormatter('amount').placeholder).toBeUndefined();
        expect(datasource.getFormatter('active').placeholder).toBeUndefined();
    });
});

describe('default formatters - the formatters option', () => {
    it('expect a replaced default to be used by every field of the type', () => {
        const datasource = new Datasource({
            fields: { created: 'date', changed: 'date', amount: 'number' },
            formatters: { date: DateFormatterDDMMYYYY }
        });
        expect(datasource.getFormatter('created')).toBe(DateFormatterDDMMYYYY);
        expect(datasource.getFormatter('changed').format(new Date(2019, 0, 5))).toEqual('05.01.2019');
        // the types left out keep the built-in default
        expect(datasource.getFormatter('amount')).toBe(NumberFormatterDot);
    });

    it('expect a field formatter to win over the default of its type', () => {
        const datasource = new Datasource({
            fields: { price: { type: 'number', formatter: NumberFormatterComma }, amount: 'number' },
            formatters: { number: NumberFormatterDot }
        });
        expect(datasource.getFormatter('price').format(12.5)).toEqual('12,5');
        expect(datasource.getFormatter('amount').format(12.5)).toEqual('12.5');
    });

    it('expect a replaced text default to be used for fields not listed', () => {
        const upper = { ...TextFormatter, format: (value: unknown) => TextFormatter.format(value).toUpperCase() };
        const datasource = new Datasource({ formatters: { text: upper } });
        expect(datasource.getFormatter('anything').format('abc')).toEqual('ABC');
    });

    it('expect a type set to undefined to keep the built-in default', () => {
        const datasource = new Datasource({ fields: { d: 'date' }, formatters: { date: undefined } });
        expect(datasource.getFormatter('d')).toBe(DateFormatterYYYYMMDD);
    });

    it('expect two datasources not to share a replaced default', () => {
        const comma = new Datasource({ fields: { n: 'number' }, formatters: { number: NumberFormatterComma } });
        const dot = new Datasource({ fields: { n: 'number' } });
        expect(comma.getFormatter('n').format(1.5)).toEqual('1,5');
        expect(dot.getFormatter('n').format(1.5)).toEqual('1.5');
    });
});

describe('TextFormatter', () => {
    it('expect text to be returned as is', () => {
        expect(TextFormatter.format('hello')).toEqual('hello');
        expect(TextFormatter.parse('hello')).toEqual('hello');
    });

    it('expect null and undefined to be empty string', () => {
        expect(TextFormatter.format(null)).toEqual('');
        expect(TextFormatter.format(undefined)).toEqual('');
    });

    it('expect 0 and false to be shown, not blank', () => {
        expect(TextFormatter.format(0)).toEqual('0');
        expect(TextFormatter.format(false)).toEqual('false');
    });

    it('expect an empty text to stay empty text when parsed', () => {
        expect(TextFormatter.parse('')).toEqual('');
    });
});

describe('BooleanFormatter', () => {
    it('expect true and false as text', () => {
        expect(BooleanFormatter.format(true)).toEqual('true');
        expect(BooleanFormatter.format(false)).toEqual('false');
    });

    it('expect null and undefined to be empty string', () => {
        expect(BooleanFormatter.format(null)).toEqual('');
        expect(BooleanFormatter.format(undefined)).toEqual('');
    });

    it('expect true in any case, spaces ignored, to be true', () => {
        expect(BooleanFormatter.parse('true')).toEqual(true);
        expect(BooleanFormatter.parse(' TRUE ')).toEqual(true);
    });

    it('expect other text to be false, and blank text null', () => {
        expect(BooleanFormatter.parse('false')).toEqual(false);
        expect(BooleanFormatter.parse('no')).toEqual(false);
        expect(BooleanFormatter.parse('')).toEqual(null);
        expect(BooleanFormatter.parse('  ')).toEqual(null);
    });

    it('expect a boolean to pass through, and null/undefined to be null', () => {
        expect(BooleanFormatter.parse(true)).toEqual(true);
        expect(BooleanFormatter.parse(false)).toEqual(false);
        expect(BooleanFormatter.parse(null)).toEqual(null);
        expect(BooleanFormatter.parse(undefined)).toEqual(null);
    });
});
