import { afterAll, describe, expect, it } from 'vitest';
import { TEXTS } from '../../texts';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';
import type { DatasourceEvents } from '../datasourceEvents';
import type { FieldConfig } from '../field';
import type { ValidationError } from '../validator';
import { isMissingValue, registerValidator } from '../validatorRegistry';

/**
 * Validation: the rules are in the datasource's fields as JSON, the validators are registered by id
 * (like the formatters). A field is validated when it is edited, and validate() checks every row.
 *
 * The registry is one for the page. Every test file runs in a module graph of its own, so only the
 * tests of this file share it: each test registers under an id of its own (`validation.<test>`), and
 * the one test that replaces a built-in puts it back in afterAll.
 */

interface Person {
    id: number;
    name?: string | null;
    age?: number | null;
}

/** a datasource with the fields given, and rows with these keys */
function people(fields: Record<string, FieldConfig>, rows: Person[] = [{ id: 1, name: 'Ann', age: 36 }]) {
    const ds = new Datasource<Person>({ key: 'id', fields });
    ds.setData(rows);
    return ds;
}

/** the errors as plain data: the row's key, the field and the messages */
const plain = (errors: ValidationError<Person>[]) => errors.map(({ row, field, messages }) => [row.id, field, messages]);

/** the messages of one field of a value under one rule list, through a datasource */
function messagesFor(field: FieldConfig, value: unknown): string[] {
    const ds = new Datasource({ fields: { value: field } });
    ds.setData([{ value }]);
    return ds.validate().flatMap((error) => error.messages);
}

describe('validation - the built-in validators', () => {
    it.each([
        [null, true],
        [undefined, true],
        ['', true],
        [new Date('x'), true],
        [0, true],
        // only spaces are as empty as ''
        [' ', true],
        ['\t \n', true],
        // values
        ['0', false],
        [' a ', false],
        [false, false],
        [1, false],
        [new Date(2026, 10, 21), false]
    ])('expect required to fail on %s: %s', (value, fails) => {
        expect(messagesFor({ validate: ['required'] }, value)).toEqual(fails ? ['Required'] : []);
        // the grid's stripes use the same test
        expect(isMissingValue(value)).toBe(fails);
    });

    it('expect min and max to check numbers, and pass blanks and values that are no number', () => {
        const rules: FieldConfig = {
            type: 'number',
            validate: [
                { id: 'min', value: 0 },
                { id: 'max', value: 10 }
            ]
        };
        expect(messagesFor(rules, -1)).toEqual(['Must be at least 0']);
        expect(messagesFor(rules, 11)).toEqual(['Must be at most 10']);
        expect(messagesFor(rules, 0)).toEqual([]);
        expect(messagesFor(rules, 10)).toEqual([]);
        for (const value of [null, undefined, '', '-5', new Date()]) {
            expect(messagesFor(rules, value)).toEqual([]);
        }
    });

    it('expect minLength and maxLength to check text, and pass blanks and values that are no text', () => {
        const rules: FieldConfig = {
            validate: [
                { id: 'minLength', value: 2 },
                { id: 'maxLength', value: 4 }
            ]
        };
        expect(messagesFor(rules, 'a')).toEqual(['Must be at least 2 characters']);
        expect(messagesFor(rules, 'abcde')).toEqual(['Must be at most 4 characters']);
        expect(messagesFor(rules, 'ab')).toEqual([]);
        expect(messagesFor(rules, 'abcd')).toEqual([]);
        for (const value of [null, undefined, '', 1, 123456]) {
            expect(messagesFor(rules, value)).toEqual([]);
        }
    });

    it('expect pattern to be a regular expression as text, not anchored, checking text only', () => {
        expect(messagesFor({ validate: [{ id: 'pattern', value: '[0-9]' }] }, 'abc')).toEqual(['Not in the expected format']);
        // finds a digit anywhere
        expect(messagesFor({ validate: [{ id: 'pattern', value: '[0-9]' }] }, 'ab1c')).toEqual([]);
        // ^ and $ for the whole text
        expect(messagesFor({ validate: [{ id: 'pattern', value: '^[0-9]+$' }] }, 'ab1c')).toEqual(['Not in the expected format']);
        for (const value of [null, '', 12]) {
            expect(messagesFor({ validate: [{ id: 'pattern', value: '^x$' }] }, value)).toEqual([]);
        }
    });

    it('expect the default messages to be texts, by their ids', () => {
        const validationTexts = Object.fromEntries(Object.entries(TEXTS).filter(([id]) => id.startsWith('validation.')));
        expect(validationTexts).toEqual({
            'validation.required': 'Required',
            'validation.min': 'Must be at least {value}',
            'validation.max': 'Must be at most {value}',
            'validation.minLength': 'Must be at least {value} characters',
            'validation.maxLength': 'Must be at most {value} characters',
            'validation.pattern': 'Not in the expected format',
            'validation.integer': 'Must be a whole number',
            'validation.decimals': 'Must have at most {value} decimals',
            'validation.oneOf': 'Must be one of {value}',
            'validation.email': 'Not an email address',
            'validation.unique': 'Another row has the same value',
            'validation.uniqueWith': 'Another row has the same value and {with}'
        });
    });
});

describe('validation - messages', () => {
    it("expect a rule's message to replace the default, with its options in it", () => {
        const rules: FieldConfig = { type: 'number', validate: [{ id: 'max', value: 150, message: 'too old, at most {value}' }] };
        expect(messagesFor(rules, 200)).toEqual(['too old, at most 150']);
    });

    it('expect a name the rule has no option for to stay as it is', () => {
        expect(messagesFor({ validate: [{ id: 'required', message: 'needs {thing}' }] }, null)).toEqual(['needs {thing}']);
    });

    it('expect every rule a value fails to give a message, in the order of the rules', () => {
        registerValidator('validation.never', () => 'never valid');
        const rules: FieldConfig = { validate: ['validation.never', { id: 'maxLength', value: 1 }, 'required'] };
        expect(messagesFor(rules, 'abc')).toEqual(['never valid', 'Must be at most 1 characters']);
    });

    it('expect a validator of your own to give a message id or the message, with the options in it', () => {
        registerValidator('validation.ownId', () => 'validation.required');
        registerValidator('validation.ownText', (_value, _row, rule) => (rule.limit ? 'over {limit}' : null));
        expect(messagesFor({ validate: ['validation.ownId'] }, 'x')).toEqual(['Required']);
        expect(messagesFor({ validate: [{ id: 'validation.ownText', limit: 5 }] }, 'x')).toEqual(['over 5']);
    });

    it("expect '' from a validator to be valid, and a value that is no text to throw", () => {
        registerValidator('validation.empty', () => '');
        expect(messagesFor({ validate: ['validation.empty'] }, 'x')).toEqual([]);

        // plain js: a boolean is not a message
        Reflect.apply(registerValidator, undefined, ['validation.boolean', (value: unknown) => Boolean(value)]);
        expect(() => messagesFor({ validate: ['validation.boolean'] }, 'x')).toThrow(
            "the validator 'validation.boolean' returned true: return null when the value is valid, else the message"
        );
    });
});

describe('validation - registerValidator()', () => {
    it('expect a validator to get the value, the row and the rule written out', () => {
        const calls: unknown[][] = [];
        registerValidator('validation.args', (value, row, rule) => {
            calls.push([value, row.id, rule]);
            return null;
        });
        const ds = people({ name: { validate: ['validation.args', { id: 'validation.args', extra: [1, 2] }] } });
        ds.validate();
        expect(calls).toEqual([
            ['Ann', 1, { id: 'validation.args' }],
            ['Ann', 1, { id: 'validation.args', extra: [1, 2] }]
        ]);
    });

    it('expect registering an id again to replace it for the datasources made after, not before', () => {
        registerValidator('validation.replaced', () => 'first');
        const before = people({ name: { validate: ['validation.replaced'] } });
        registerValidator('validation.replaced', () => 'second');
        const after = people({ name: { validate: ['validation.replaced'] } });

        expect(before.validate()[0].messages).toEqual(['first']);
        expect(after.validate()[0].messages).toEqual(['second']);
    });

    describe('a built-in id', () => {
        afterAll(() => {
            // the built-in, back for the rest of this file
            registerValidator('required', (value) => (isMissingValue(value) ? 'validation.required' : null));
        });

        it('expect it to be replaced too, and its option check to go with it', () => {
            registerValidator('required', (value) => (value === 'x' ? 'no x' : null));
            expect(messagesFor({ validate: ['required'] }, 'x')).toEqual(['no x']);
            expect(messagesFor({ validate: ['required'] }, null)).toEqual([]);
        });
    });

    it('expect an id that is no text, or a validator that is no function, to throw a TypeError', () => {
        expect(() => registerValidator('', () => null)).toThrow(TypeError);
        // plain js can pass anything
        expect(() => Reflect.apply(registerValidator, undefined, [7, () => null])).toThrow('the id must be a text, got 7');
        expect(() => Reflect.apply(registerValidator, undefined, ['validation.object', { validate: () => null }])).toThrow(
            "the validator of 'validation.object' must be a function"
        );
    });
});

describe('validation - the rules in the fields', () => {
    it('expect getField() to give the rules written out, [] without', () => {
        const ds = people({ age: { type: 'number', validate: ['required', { id: 'min', value: 0, message: 'm' }] } });
        expect(ds.getField('age').validate).toEqual([{ id: 'required' }, { id: 'min', value: 0, message: 'm' }]);
        expect(ds.getField('name').validate).toEqual([]);
        expect(ds.getField('other').validate).toEqual([]);
    });

    it('expect the rules given not to be kept: a copy of each object', () => {
        const rule = { id: 'min', value: 0 };
        const ds = people({ age: { type: 'number', validate: [rule] } });
        rule.value = 100;
        expect(ds.getField('age').validate).toEqual([{ id: 'min', value: 0 }]);
    });

    it('expect an id that is not registered to throw when the datasource is made, listing the registered ids', () => {
        expect(() => people({ name: { validate: ['validation.unknown'] } })).toThrow(
            /field 'name' has the unknown validator 'validation.unknown'.*Registered: 'required', 'min'/
        );
    });

    it('expect rules that are no list, or a rule without an id, to throw a TypeError (plain js, JSON)', () => {
        // plain js and JSON can give anything
        const fields = (validate: unknown) => {
            const name: FieldConfig = {};
            Reflect.set(name, 'validate', validate);
            return { name };
        };
        expect(() => people(fields('required'))).toThrow("Datasource: field 'name' takes a list of rules as validate");
        expect(() => people(fields([{ value: 1 }]))).toThrow(
            "Datasource: field 'name' has a rule that is no id or { id, ...options }"
        );
        expect(() => people(fields([null]))).toThrow(TypeError);
        expect(() => people(fields([{ id: 'required', message: 7 }]))).toThrow('with a message that is not a text');
    });

    it('expect the options of a built-in to be checked when the datasource is made', () => {
        expect(() => people({ age: { validate: [{ id: 'min' }] } })).toThrow(
            /rule 'min', which takes a number or a day \('YYYY-MM-DD'\) as its value/
        );
        expect(() => people({ age: { validate: [{ id: 'maxLength', value: '3' }] } })).toThrow(TypeError);
        expect(() => people({ name: { validate: [{ id: 'pattern', value: 3 }] } })).toThrow(/regular expression as text/);
        expect(() => people({ name: { validate: [{ id: 'pattern', value: '[' }] } })).toThrow(/no regular expression/);
    });
});

describe('validation - when it runs', () => {
    it('expect the rows set not to be validated', () => {
        const ds = people({ name: { validate: ['required'] } }, [{ id: 1, name: '' }]);
        expect(ds.getErrors()).toEqual([]);
        expect(ds.hasErrors()).toBe(false);
    });

    it('expect an edit from code to validate the field, and an edit that makes it valid to clear it', () => {
        const ds = people({ name: { validate: ['required'] } });
        const [ann] = ds.getDataRows();

        ann.name = '';
        expect(plain(ds.getErrors())).toEqual([[1, 'name', ['Required']]]);
        expect(ds.hasErrors()).toBe(true);

        ann.name = 'Anna';
        expect(ds.getErrors()).toEqual([]);
        expect(ds.hasErrors()).toBe(false);
    });

    it('expect an edit to check the fields of the row that have an error, not the others', () => {
        // age must not be below the row's minimum: a validator that reads the row
        registerValidator('validation.atLeastRow', (value, row) =>
            typeof value === 'number' && value < row.minimum ? 'below the minimum' : null
        );
        const ds = new Datasource({
            fields: { age: { type: 'number', validate: ['validation.atLeastRow'] }, name: { validate: ['required'] } }
        });
        ds.setData([{ age: 5, minimum: 0, name: '' }]);
        const [row] = ds.getDataRows();

        row.age = 1;
        row.minimum = 3; // not the age: its error is not there yet
        expect(ds.getErrors()).toEqual([]);

        row.age = 2;
        expect(ds.getErrors().map((error) => error.field)).toEqual(['age']);
        // the minimum fixed: the age has an error, so it is checked again. name never had one
        row.minimum = 0;
        expect(ds.getErrors()).toEqual([]);
    });

    it('expect a new row not to be validated until it is edited or validate() runs', () => {
        const ds = people({ name: { validate: ['required'] }, age: { type: 'number', validate: ['required'] } });
        ds.addNewEmpty({ age: 3 });
        const added = ds.getAllData()[1];
        expect(ds.getErrors()).toEqual([]);

        added.age = 4; // an edit validates that field only
        expect(ds.getErrors()).toEqual([]);

        expect(plain(ds.validate())).toEqual([[added.id, 'name', ['Required']]]);
    });

    it('expect validate() to check every row and field, in the order of the rows and of the rules', () => {
        const ds = people({ name: { validate: ['required'] }, age: { type: 'number', validate: [{ id: 'min', value: 0 }] } }, [
            { id: 1, name: '', age: -1 },
            { id: 2, name: 'Bob', age: 3 },
            { id: 3, name: null, age: 0 }
        ]);
        expect(plain(ds.validate())).toEqual([
            [1, 'name', ['Required']],
            [1, 'age', ['Must be at least 0']],
            [3, 'name', ['Required']]
        ]);
        // kept: getErrors() gives the same
        expect(plain(ds.getErrors())).toEqual(plain(ds.validate()));
    });

    it('expect validate(rows) to check the rows given only, and getErrors(rows) to read them only', () => {
        const ds = people({ name: { validate: ['required'] } }, [
            { id: 1, name: '' },
            { id: 2, name: '' }
        ]);
        const [first, second] = ds.getDataRows();

        expect(plain(ds.validate(second))).toEqual([[2, 'name', ['Required']]]);
        expect(plain(ds.getErrors())).toEqual([[2, 'name', ['Required']]]);
        ds.validate();
        expect(plain(ds.getErrors([first]))).toEqual([[1, 'name', ['Required']]]);
        expect(plain(ds.getErrors(first))).toEqual([[1, 'name', ['Required']]]);
    });

    it('expect validate() to clear the error of a field that passes now', () => {
        const raw: Person = { id: 1, name: '' };
        const ds = people({ name: { validate: ['required'] } }, [raw]);
        ds.validate();
        // set on your own object, not the row: no edit, so not validated
        raw.name = 'Ann';
        expect(ds.hasErrors()).toBe(true);

        expect(ds.validate()).toEqual([]);
        expect(ds.hasErrors()).toBe(false);
    });

    it("expect validate() to send 'validate' with what it returned", () => {
        const ds = people({ name: { validate: ['required'] } }, [{ id: 1, name: '' }]);
        const events: DatasourceEvents['validate'][] = [];
        ds.on('validate', (data) => events.push(data));

        const errors = ds.validate();
        expect(events).toEqual([{ errors }]);
        expect(errors).toHaveLength(1);
    });

    it('expect the messages handed out to be copies', () => {
        const ds = people({ name: { validate: ['required'] } }, [{ id: 1, name: '' }]);
        ds.validate()[0].messages.push('changed');
        expect(ds.getErrors()[0].messages).toEqual(['Required']);
    });

    it('expect a row not in the data to be skipped', () => {
        const ds = people({ name: { validate: ['required'] } }, [{ id: 1, name: '' }]);
        const other = people({ name: { validate: ['required'] } }, [{ id: 1, name: '' }]);
        expect(ds.validate(other.getAllData())).toEqual([]);
        expect(ds.getErrors(other.getAllData())).toEqual([]);
    });
});

describe('validation - rows marked for deletion', () => {
    it('expect validate() to skip them, and getErrors() / hasErrors() to leave them out', () => {
        const ds = people({ name: { validate: ['required'] } }, [
            { id: 1, name: '' },
            { id: 2, name: '' }
        ]);
        const [first, second] = ds.getDataRows();
        ds.markForDeletion(first);

        expect(plain(ds.validate())).toEqual([[2, 'name', ['Required']]]);
        ds.markForDeletion(second); // it has an error: hidden while it is marked
        expect(ds.getErrors()).toEqual([]);
        expect(ds.getErrors(second)).toEqual([]);
        expect(ds.hasErrors()).toBe(false);
    });

    it('expect the errors to be back when the row is unmarked', () => {
        const ds = people({ name: { validate: ['required'] } }, [{ id: 1, name: '' }]);
        const [row] = ds.getDataRows();
        ds.validate();
        ds.markForDeletion(row);
        ds.unmarkForDeletion(row);
        expect(plain(ds.getErrors())).toEqual([[1, 'name', ['Required']]]);
    });
});

describe('validation - clearing the errors', () => {
    const invalid = () =>
        people({ name: { validate: ['required'] } }, [
            { id: 1, name: '' },
            { id: 2, name: '' }
        ]);

    it('expect acceptChanges() to clear every row, or the rows given', () => {
        const ds = invalid();
        ds.validate();
        ds.acceptChanges({ rows: ds.getDataRows()[0] });
        expect(plain(ds.getErrors())).toEqual([[2, 'name', ['Required']]]);

        ds.acceptChanges();
        expect(ds.hasErrors()).toBe(false);
    });

    it('expect resetData() to clear them: the original values are not validated', () => {
        const ds = invalid();
        const [first] = ds.getDataRows();
        first.name = 'Ann';
        first.name = ''; // edited, with an error
        ds.validate();

        ds.resetData();
        expect(ds.getErrors()).toEqual([]);
        expect(first.name).toEqual('');
    });

    it('expect resetDataSelectionOnly() to clear the selected rows only', () => {
        const ds = invalid();
        ds.validate();
        ds.select(2);
        ds.resetDataSelectionOnly();
        expect(plain(ds.getErrors())).toEqual([[1, 'name', ['Required']]]);
    });
});

describe('validation - the errors of a server are apart', () => {
    it('expect setErrors() not to change the validation errors, and validate() not __rowError', () => {
        const ds = people({ name: { validate: ['required'] } }, [
            { id: 1, name: '' },
            { id: 2, name: 'Bob' }
        ]);
        ds.validate();
        ds.getDataContainer().setErrors(new Map([['2', 'taken']]));

        expect(plain(ds.getErrors())).toEqual([[1, 'name', ['Required']]]);
        ds.validate();
        expect(ds.getAllData().map((row) => row.__rowError)).toEqual([null, 'taken']);
    });

    it('expect hasErrors() not to count a server error', () => {
        const ds = people({ name: { validate: ['required'] } });
        ds.getDataContainer().setErrors(new Map([['1', 'taken']]));
        expect(ds.hasErrors()).toBe(false);
        expect(ds.validate()).toEqual([]);
    });
});

describe('validation - datasources sharing a container', () => {
    it('expect the rules of one to validate the edits made through the other', () => {
        const container = new DataContainer('id');
        const withRules = new Datasource({ container, fields: { name: { validate: ['required'] } } });
        const without = new Datasource({ container });
        withRules.setData([{ id: 1, name: 'Ann' }]);
        without.reloadDatasource();

        without.getDataRows()[0].name = '';
        expect(withRules.getErrors().map((error) => error.field)).toEqual(['name']);
        expect(without.hasErrors()).toBe(true);
    });

    it('expect the same rules in both to be fine, in any order of their options', () => {
        const container = new DataContainer('id');
        new Datasource({ container, fields: { age: { type: 'number', validate: [{ id: 'min', value: 0 }] } } });
        expect(
            () => new Datasource({ container, fields: { age: { type: 'number', validate: [{ value: 0, id: 'min' }] } } })
        ).not.toThrow();
        // rules in one of them only
        expect(() => new Datasource({ container, fields: { age: 'number' } })).not.toThrow();
    });

    it('expect other rules for the same field to throw, and nothing to be added then', () => {
        const container = new DataContainer('id');
        new Datasource({ container, fields: { age: { type: 'number', validate: [{ id: 'min', value: 0 }] } } });
        expect(
            () =>
                new Datasource({
                    container,
                    fields: { name: 'text', age: { type: 'number', validate: [{ id: 'min', value: 1 }] } }
                })
        ).toThrow(/field 'age' has other validation rules/);

        // name was not added as a text field: a number type for it is fine
        expect(() => new Datasource({ container, fields: { name: 'number' } })).not.toThrow();
    });
});
