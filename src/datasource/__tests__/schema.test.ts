import { describe, expect, it } from 'vitest';
import { DateFormatterDDMMYYYY } from '../DateFormatterDDMMYYYY';
import { DateFormatterYYYYMMDD } from '../DateFormatterYYYYMMDD';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';
import type { FieldConfig, FieldType } from '../field';
import type { Formatter } from '../formatter';
import { registerFormatter } from '../formatterRegistry';
import { NumberFormatterComma } from '../numberFormatterComma';
import { NumberFormatterDot } from '../numberFormatterDot';
import { TextFormatter } from '../textFormatter';

/**
 * The schema: `new Datasource({ fields })` is the one place a field's type, label and formatter
 * are set. getField() resolves a field with every default filled in.
 */

describe('schema - getField', () => {
    it('expect a field that is not listed to be text, labelled with its name', () => {
        const ds = new Datasource();
        expect(ds.getField('name')).toEqual({
            name: 'name',
            type: 'text',
            label: 'name',
            formatter: TextFormatter,
            validate: [],
            multiline: false
        });
    });

    it('expect the type shorthand to be the same as { type }', () => {
        const ds = new Datasource({ fields: { born: 'date', died: { type: 'date' } } });
        expect(ds.getField('born')).toEqual({
            name: 'born',
            type: 'date',
            label: 'born',
            formatter: DateFormatterYYYYMMDD,
            validate: [],
            multiline: false
        });
        expect(ds.getField('died')).toEqual({
            name: 'died',
            type: 'date',
            label: 'died',
            formatter: DateFormatterYYYYMMDD,
            validate: [],
            multiline: false
        });
    });

    it('expect the label, type and formatter given to be used', () => {
        const ds = new Datasource({ fields: { price: { type: 'number', label: 'Price', formatter: 'numberComma' } } });
        expect(ds.getField('price')).toEqual({
            name: 'price',
            type: 'number',
            label: 'Price',
            formatter: NumberFormatterComma,
            validate: [],
            multiline: false
        });
    });

    it('expect a field with only a label to be text', () => {
        const ds = new Datasource({ fields: { company: { label: 'Company' } } });
        expect(ds.getField('company').type).toEqual('text');
        expect(ds.getField('company').label).toEqual('Company');
    });

    it('expect an empty label to fall back to the field name', () => {
        const ds = new Datasource({ fields: { company: { label: '' } } });
        expect(ds.getField('company').label).toEqual('company');
    });

    it('expect a change to the result not to change the field', () => {
        const ds = new Datasource({ fields: { age: 'number' } });
        ds.getField('age').type = 'text';
        expect(ds.getField('age').type).toEqual('number');
    });

    it('expect a change to the options object after the constructor not to change the field', () => {
        const fields: Record<string, FieldConfig> = { age: { type: 'number' } };
        const ds = new Datasource({ fields });
        fields.age.type = 'date';
        fields.other = { type: 'number' };
        expect(ds.getField('age').type).toEqual('number');
        expect(ds.getField('other').type).toEqual('text');
    });

    it('expect multiline on a text field: getField() says it, false by default', () => {
        const ds = new Datasource({
            fields: { notes: { multiline: true }, memo: { type: 'text', multiline: true }, name: 'text' }
        });
        expect(ds.getField('notes').multiline).toBe(true);
        expect(ds.getField('memo').multiline).toBe(true);
        expect(ds.getField('name').multiline).toBe(false);
        expect(ds.getField('other').multiline).toBe(false);
    });

    it('expect multiline on a field that is not text to throw, false to be allowed', () => {
        expect(() => new Datasource({ fields: { age: { type: 'number', multiline: true } } })).toThrow(
            "field 'age' is multiline, that is for text fields only, not 'number'"
        );
        expect(() => new Datasource({ fields: { born: { type: 'date', multiline: true } } })).toThrow(/text fields only/);
        expect(new Datasource({ fields: { age: { type: 'number', multiline: false } } }).getField('age').multiline).toBe(false);
    });

    it('expect multiline that is not true or false to throw', () => {
        // plain JSON from a backend can have anything
        const fields = JSON.parse('{ "notes": { "multiline": "yes" } }') as Record<string, FieldConfig>;
        expect(() => new Datasource({ fields })).toThrow("field 'notes' has multiline 'yes', it is true or false");
    });

    it('expect an unknown type to throw', () => {
        // a plain js user can pass any string, the type check is what this test is about
        const fields = JSON.parse('{ "born": "dat" }') as Record<string, FieldType>;
        expect(() => new Datasource({ fields })).toThrow("field 'born' has an unknown type 'dat'");
    });
});

describe('schema - getFormatter', () => {
    const own: Formatter = { format: () => 'own', parse: (text) => text };
    // an id of this file's own: the registry is shared by the tests of this file
    registerFormatter('schema.own', own);
    const ds = new Datasource({ fields: { a: { type: 'text', formatter: 'schema.own' }, born: 'date', n: 'number' } });

    it("expect the field's own formatter, else the default for its type", () => {
        expect(ds.getFormatter('a')).toBe(own);
        expect(ds.getFormatter('born')).toBe(DateFormatterYYYYMMDD);
        expect(ds.getFormatter('n')).toBe(NumberFormatterDot);
        expect(ds.getFormatter('not-listed')).toBe(TextFormatter);
    });

    it("expect a type that is the field's own to keep its formatter", () => {
        expect(ds.getFormatter('a', 'text')).toBe(own);
        expect(ds.getFormatter('born', 'date')).toBe(DateFormatterYYYYMMDD);
    });

    it('expect another type to give the default for that type (dynamicCellTypeColumn)', () => {
        expect(ds.getFormatter('a', 'number')).toBe(NumberFormatterDot);
        expect(ds.getFormatter('a', 'number').format(12.5)).toEqual('12.5');
        expect(ds.getFormatter('not-listed', 'date')).toBe(DateFormatterYYYYMMDD);
    });

    it('expect another type to follow the formatters option', () => {
        const withDefaults = new Datasource({ formatters: { date: 'dateDDMMYYYY' } });
        expect(withDefaults.getFormatter('value', 'date')).toBe(DateFormatterDDMMYYYY);
    });
});

describe('schema - key and container', () => {
    it('expect key to be the key of the container the datasource makes', () => {
        const ds = new Datasource({ key: 'id' });
        expect(ds.getDataContainer().getKeyAttribute()).toEqual('id');
        ds.setData([{ id: 7, name: 'a' }]);
        expect(ds.getAllData()[0].__KEY).toEqual(7);
    });

    it('expect no key to give generated keys', () => {
        const ds = new Datasource();
        expect(ds.getDataContainer().getKeyAttribute()).toBeUndefined();
        ds.setData([{ id: 7 }]);
        expect(ds.getAllData()[0].__KEY).toBeLessThan(0);
    });

    it('expect two datasources on one container to share the rows', () => {
        const container = new DataContainer('id');
        const left = new Datasource({ container });
        const right = new Datasource({ container, fields: { age: 'number' } });
        left.setData([{ id: 1 }, { id: 2 }]);
        right.reloadDatasource();
        expect(right.getDataContainer()).toBe(container);
        expect(right.getAllData().map((row) => row.id)).toEqual([1, 2]);
    });

    it("expect a key that is the container's key to be fine", () => {
        const container = new DataContainer('id');
        expect(new Datasource({ key: 'id', container }).getDataContainer()).toBe(container);
    });

    it("expect a key that is not the container's key to throw", () => {
        expect(() => new Datasource({ key: 'id', container: new DataContainer('uuid') })).toThrow(
            "key 'id' is not the key of the container ('uuid')"
        );
    });

    it('expect a key for a container without one to throw', () => {
        expect(() => new Datasource({ key: 'id', container: new DataContainer() })).toThrow(
            "key 'id' is not the key of the container ('undefined')"
        );
    });
});

describe('schema - selection mode', () => {
    it("expect 'multiple' by default, and the option to set it", () => {
        expect(new Datasource().getSelectionMode()).toEqual('multiple');
        expect(new Datasource({ selectionMode: 'single' }).getSelectionMode()).toEqual('single');
    });
});
