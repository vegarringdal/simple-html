import { describe, expect, it } from 'vitest';
import { BooleanFormatter } from '../booleanFormatter';
import { DateFormatterDDMMYYYY } from '../DateFormatterDDMMYYYY';
import { DateFormatterDDMMYYYYTHHMMSS } from '../DateFormatterDDMMYYYYTHHMMSS';
import { DateFormatterYYYYMMDD } from '../DateFormatterYYYYMMDD';
import { DateFormatterYYYYMMDDTHHMMSS } from '../DateFormatterYYYYMMDDTHHMMSS';
import { Datasource } from '../dataSource';
import type { FieldConfig } from '../field';
import type { Formatter } from '../formatter';
import { registerFormatter } from '../formatterRegistry';
import { NumberFormatterComma } from '../numberFormatterComma';
import { NumberFormatterDot } from '../numberFormatterDot';
import { TextFormatter } from '../textFormatter';

/**
 * The formatter registry: the datasource options name a formatter by its id, so they are plain
 * JSON. The built-ins are registered from the start, registerFormatter() adds your own.
 *
 * The registry is one for the page. Every test file runs in a module graph of its own, so only the
 * tests of this file share it: each test registers under an id of its own (`registry.<test>`).
 */

/** a formatter that shows every value as `text`, to tell it apart */
const showing = (text: string): Formatter => ({ format: () => text, parse: (value) => value });

describe('formatter registry - the built-in ids', () => {
    it.each([
        ['text', TextFormatter],
        ['boolean', BooleanFormatter],
        ['numberDot', NumberFormatterDot],
        ['numberComma', NumberFormatterComma],
        ['dateYYYYMMDD', DateFormatterYYYYMMDD],
        ['dateDDMMYYYY', DateFormatterDDMMYYYY],
        ['datetimeYYYYMMDD', DateFormatterYYYYMMDDTHHMMSS],
        ['datetimeDDMMYYYY', DateFormatterDDMMYYYYTHHMMSS]
    ])("expect '%s' to be registered", (id, formatter) => {
        const datasource = new Datasource({ fields: { field: { formatter: id } } });
        expect(datasource.getFormatter('field')).toBe(formatter);
    });
});

describe('formatter registry - registerFormatter()', () => {
    it('expect a field to get the formatter registered under its id, getField() the object', () => {
        const money = showing('money');
        registerFormatter('registry.money', money);
        const datasource = new Datasource({ fields: { price: { type: 'number', formatter: 'registry.money' } } });

        expect(datasource.getFormatter('price')).toBe(money);
        expect(datasource.getField('price')).toEqual({
            name: 'price',
            type: 'number',
            label: 'price',
            formatter: money,
            validate: [],
            multiline: false
        });
    });

    it('expect the formatters option to take a registered id as the default of a type', () => {
        const date = showing('a date');
        registerFormatter('registry.date', date);
        const datasource = new Datasource({ fields: { born: 'date', died: 'date' }, formatters: { date: 'registry.date' } });

        expect(datasource.getFormatter('born')).toBe(date);
        expect(datasource.getFormatter('died').format(new Date())).toEqual('a date');
        // dynamicCellTypeColumn asks for the default of a type
        expect(datasource.getFormatter('value', 'date')).toBe(date);
    });

    it('expect registering an id again to replace it for the datasources made after, not before', () => {
        registerFormatter('registry.again', showing('first'));
        const before = new Datasource({ fields: { a: { formatter: 'registry.again' } } });
        registerFormatter('registry.again', showing('second'));
        const after = new Datasource({ fields: { a: { formatter: 'registry.again' } } });

        expect(before.getFormatter('a').format('x')).toEqual('first');
        expect(after.getFormatter('a').format('x')).toEqual('second');
    });

    it('expect an id that is no text, or empty, to throw a TypeError', () => {
        expect(() => registerFormatter('', TextFormatter)).toThrow(TypeError);
        // plain js can pass anything
        expect(() => Reflect.apply(registerFormatter, undefined, [42, TextFormatter])).toThrow('the id must be a text, got 42');
    });

    it('expect a formatter without format() or parse() to throw a TypeError', () => {
        expect(() => Reflect.apply(registerFormatter, undefined, ['registry.noParse', { format: () => '' }])).toThrow(
            "the formatter of 'registry.noParse' must have a format() and a parse() method"
        );
        expect(() => Reflect.apply(registerFormatter, undefined, ['registry.nothing', undefined])).toThrow(TypeError);
    });
});

describe('formatter registry - an id that is not registered', () => {
    it('expect a field with an unknown id to throw when the datasource is made, listing the ids', () => {
        registerFormatter('registry.listed', showing('listed'));

        const make = () => new Datasource({ fields: { price: { type: 'number', formatter: 'monye' } } });

        expect(make).toThrow("Datasource: field 'price' has the unknown formatter 'monye'");
        expect(make).toThrow(
            "Registered: 'text', 'boolean', 'numberDot', 'numberComma', 'dateYYYYMMDD', 'dateDDMMYYYY', 'datetimeYYYYMMDD', 'datetimeDDMMYYYY'"
        );
        expect(make).toThrow("'registry.listed'");
    });

    it('expect an unknown id in the formatters option to throw, naming the type', () => {
        expect(() => new Datasource({ formatters: { date: 'dateNO' } })).toThrow(
            "Datasource: formatters.date has the unknown formatter 'dateNO'"
        );
    });

    it('expect a formatter object instead of an id (plain js, as before the registry) to throw a TypeError', () => {
        const field: FieldConfig = { type: 'number' };
        Reflect.set(field, 'formatter', NumberFormatterComma);

        expect(() => new Datasource({ fields: { price: field } })).toThrow(TypeError);
        expect(() => new Datasource({ fields: { price: field } })).toThrow(
            "Datasource: field 'price' takes the id (a text) of a registered formatter, got object: registerFormatter('myId', formatter), then formatter: 'myId'"
        );
    });
});
