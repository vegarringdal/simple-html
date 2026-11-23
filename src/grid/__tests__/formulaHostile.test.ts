// @vitest-environment happy-dom
// reads formula.ts as text (TS 6 includes no @types by default)
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { assertCalculatedColumns, calculatedFields, compileCalculatedColumns, readerOf } from '../calculatedColumns';
import { assertColorRules, colorRuleStyle } from '../colorRules';
import { compileFormula, type FieldTypeResult, type FormulaType } from '../formula';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * Formulas and colour rules from a saved state are hostile input (the user: "important that expressions
 * is injection proof, so no one can hack / script injection"). Checked here:
 * - the source of the language runs no code: no eval, new Function, setTimeout of text, with, import()
 * - a function name is one of FUNCTIONS only - `constructor`, `toString`, `__proto__`, `valueOf`,
 *   `hasOwnProperty` are no functions; there is no `.` or `[ ]`
 * - a field is one the grid knows, not the grid's own (`{__proto__}`, `{__KEY}`), read as an own property
 *   of the row: a formula reads the fields it names and nothing else of the row
 * - a list of known payloads and random formulas (a fuzz): the parser and the evaluator never throw, any
 *   text is a formula or a problem
 * - what a formula gives is data: markup stays text in the cell
 * - a colour is a name of the palette or `#rrggbb`, set as a custom property only
 * - the field name of a calculated column is a strict pattern
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});
afterEach(() => {
    vi.restoreAllMocks();
});

const TYPES = new Map<string, FormulaType>([
    ['price', 'number'],
    ['name', 'text'],
    ['due', 'date'],
    ['active', 'boolean']
]);
/** the fields the formulas know: own entries of a Map, as the grid's are */
const typeOf = (field: string): FieldTypeResult => {
    const type = TYPES.get(field);
    return type ? { type } : undefined;
};

/** a formula read: never throws, a formula or a problem */
const read = (text: unknown) => compileFormula(text, typeOf);

/** the known payloads: code, markup, prototype names, addresses, very long and very deep input */
const PAYLOADS: string[] = [
    '__proto__',
    'constructor',
    '{constructor}',
    '{__proto__}',
    '{prototype}',
    '{__KEY}',
    '{__controller}',
    'constructor.constructor("alert(1)")()',
    '{name}.constructor',
    '{name}["constructor"]',
    'toString()',
    'valueOf()',
    'hasOwnProperty("x")',
    '__defineGetter__("x", 1)',
    'alert(1)',
    'eval("1")',
    'Function("return 1")()',
    'import("x")',
    'this',
    'globalThis',
    'window.location',
    'document.cookie',
    '"</script><script>alert(1)</script>"',
    '"<img src=x onerror=alert(1)>"',
    '`${alert(1)}`',
    'javascript:alert(1)',
    '"javascript:alert(1)"',
    'data:text/html,<script>alert(1)</script>',
    '{name}; alert(1)',
    '1; DROP TABLE x',
    '=HYPERLINK("http://evil.example")',
    '@SUM(1)',
    '\u0000',
    '"\u0000"',
    '{ }',
    '\\u0061lert(1)',
    'IF(TRUE, alert, 1)',
    'x'.repeat(5000),
    '('.repeat(5000),
    `${'('.repeat(400)}1${')'.repeat(400)}`,
    `${'ABS('.repeat(200)}1${')'.repeat(200)}`,
    '-'.repeat(900),
    'NOT '.repeat(240),
    `{${'a'.repeat(990)}}`,
    `"${'"'.repeat(999)}`,
    '1'.repeat(999),
    'IF('.repeat(300),
    '{price} *'.repeat(100)
];

/** the pieces the fuzz puts together: every token kind, broken ones too */
const PIECES = [
    '1',
    '0',
    '.5',
    '1e3',
    '"a"',
    "'b'",
    '"',
    '{price}',
    '{name}',
    '{due}',
    '{active}',
    '{nope}',
    '{__proto__}',
    '{',
    '}',
    '(',
    ')',
    ',',
    '+',
    '-',
    '*',
    '/',
    '&',
    '=',
    '<>',
    '<',
    '<=',
    '>',
    '>=',
    'AND',
    'OR',
    'NOT',
    'TRUE',
    'FALSE',
    'IF(',
    'ROUND(',
    'ABS(',
    'MIN(',
    'MAX(',
    'TODAY()',
    'DAYS(',
    'YEAR(',
    'MONTH(',
    'CONCAT(',
    'COALESCE(',
    'ISBLANK(',
    'constructor(',
    'toString',
    '.',
    '[',
    ']',
    ';',
    '$',
    '`',
    '\\',
    ' ',
    '\n'
];

/** a random number generator that gives the same formulas every run */
function seeded(seed: number) {
    let state = seed;
    return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
}

/**
 * a row that records every property read: a formula must read the fields it names and nothing else -
 * not its prototype, not a `__` field, not `constructor`
 */
function recordingRow(values: Record<string, unknown>) {
    const reads: (string | symbol)[] = [];
    const row = new Proxy(values, {
        get(target, prop) {
            reads.push(prop);
            return Reflect.get(target, prop);
        },
        getOwnPropertyDescriptor(target, prop) {
            reads.push(`own:${String(prop)}`);
            return Reflect.getOwnPropertyDescriptor(target, prop);
        }
    });
    return { row, reads };
}

describe('formula - hostile input', () => {
    it('expect the language to run no code: no eval, Function, timers of text, with, import() in its source', () => {
        const source = fs
            .readFileSync(path.resolve(__dirname, '../formula.ts'), 'utf8')
            // the comments say what it does not do
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');
        for (const banned of [
            /\beval\s*\(/,
            /\bnew\s+Function\b/,
            /\bFunction\s*\(/,
            /setTimeout|setInterval/,
            /\bwith\s*\(/,
            /\bimport\s*\(/,
            /new\s+RegExp/,
            /innerHTML/
        ]) {
            expect(source, String(banned)).not.toMatch(banned);
        }
    });

    it('expect eval and Function never called while formulas are read and run', () => {
        const evalSpy = vi.spyOn(globalThis, 'eval');
        const functionSpy = vi.spyOn(globalThis, 'Function');
        for (const text of [...PAYLOADS, '{price} * 2', 'IF({active}, {name} & "!", "no")']) {
            const result = read(text);
            if ('formula' in result) {
                result.formula.evaluate((field) => ({ price: 1, name: 'x', due: new Date(), active: true })[field]);
            }
        }
        expect(evalSpy).not.toHaveBeenCalled();
        expect(functionSpy).not.toHaveBeenCalled();
    });

    it('expect the names every object has to be no functions, and no member access', () => {
        for (const name of [
            'constructor',
            'toString',
            '__proto__',
            'valueOf',
            'hasOwnProperty',
            'isPrototypeOf',
            '__defineGetter__'
        ]) {
            const result = read(`${name}(1)`);
            expect('problem' in result && result.problem.id, name).toEqual('function');
        }
        expect(read('{name}.length')).toMatchObject({ problem: { id: 'character' } });
        expect(read('{name}["length"]')).toMatchObject({ problem: { id: 'character' } });
        expect(read('constructor.constructor("alert(1)")()')).toMatchObject({ problem: { id: 'character' } });
        expect(read('constructor("alert(1)")')).toMatchObject({ problem: { id: 'function' } });
    });

    it('expect a field of the grid’s own or one the grid does not know to be refused before it runs', () => {
        for (const field of ['__proto__', '__KEY', '__controller', '__rowState']) {
            expect(read(`{${field}}`), field).toMatchObject({ problem: { id: 'internal' } });
        }
        for (const field of ['constructor', 'prototype', 'toString', 'hasOwnProperty', 'valueOf']) {
            expect(read(`{${field}}`), field).toMatchObject({ problem: { id: 'unknownField' } });
        }
    });

    it('expect the known payloads and 3000 random formulas to be read and run without an exception', () => {
        const values = { price: 2, name: 'x', due: new Date(2026, 0, 1), active: true };
        const random = seeded(42);
        const fuzz = Array.from({ length: 3000 }, () =>
            Array.from({ length: 1 + Math.floor(random() * 14) }, () => PIECES[Math.floor(random() * PIECES.length)]).join(
                random() > 0.5 ? ' ' : ''
            )
        );
        let formulas = 0;
        for (const text of [...PAYLOADS, ...fuzz]) {
            const { row, reads } = recordingRow({ ...values });
            let result: ReturnType<typeof read> | undefined;
            expect(() => {
                result = read(text);
                if (result && 'formula' in result) {
                    formulas++;
                    result.formula.evaluate(readerOf(row, new Set()));
                }
            }, text).not.toThrow();
            // nothing of the row but the fields the formula names, as own properties
            const named = result && 'formula' in result ? result.formula.fields : [];
            for (const prop of reads) {
                const name = typeof prop === 'string' ? prop.replace(/^own:/, '') : String(prop);
                expect(named, `${text} read ${String(prop)}`).toContain(name);
            }
        }
        // the fuzz makes formulas too, not only problems
        expect(formulas).toBeGreaterThan(50);
    });

    it('expect a field that is not an own property of the row to be blank: nothing of its prototype is read', () => {
        const proto = { price: 1000 };
        const row = Object.create(proto) as Record<string, unknown>;
        row.name = 'x';
        const compiled = compileFormula('COALESCE({price}, -1)', typeOf);
        expect('formula' in compiled && compiled.formula.evaluate(readerOf(row, new Set()))).toEqual({ value: -1 });
    });

    it('expect anything that is not a text to be no formula, and nothing to throw', () => {
        for (const text of [undefined, null, 1, {}, [], () => 1, Symbol('x'), new String('1')]) {
            expect(read(text as unknown)).toMatchObject({ problem: { id: 'empty' } });
        }
    });

    it('expect markup a formula gives to stay text in the cell: the input shows it as its value', async () => {
        const { element, gridInterface } = await mountGrid(
            {
                calculatedColumns: { html: { formula: '"<img src=x onerror=alert(1)>" & {name}' } },
                layout: {
                    center: [
                        { fields: ['name'], width: 100 },
                        { fields: ['html'], width: 200 }
                    ]
                }
            },
            [{ name: '<b>x</b>' }]
        );
        const input = element.querySelector<HTMLInputElement>('input[data-attribute="html"]');
        expect(input?.value).toEqual('<img src=x onerror=alert(1)><b>x</b>');
        expect(element.querySelector('img')).toBeNull();
        expect(element.querySelector('b')).toBeNull();
        expect(gridInterface.getCsv().split('\r\n')[1]).toEqual('<b>x</b>,<img src=x onerror=alert(1)><b>x</b>');
    });
});

describe('calculated columns - hostile state', () => {
    const datasource = new Datasource({ fields: { price: 'number' } });
    datasource.setData([{ price: 1, name: 'x' }]);
    const fieldType = (field: string) => (field === 'price' ? 'number' : field === 'name' ? 'text' : undefined);
    const isTaken = (name: string) => name === 'price' || name === 'name';
    const check = (columns: unknown) => () => assertCalculatedColumns(columns, fieldType, isTaken, 'setState: calculatedColumns');

    it('expect a field name of the strict pattern only: no prototype names, no grid names, no markup', () => {
        for (const name of [
            '__proto__',
            'constructor',
            '__KEY',
            'toString',
            '<img>',
            'a.b',
            'a[0]',
            'a b',
            '',
            'é',
            '1a',
            'x'.repeat(65)
        ]) {
            const columns =
                name === '__proto__' ? JSON.parse('{ "__proto__": { "formula": "1" } }') : { [name]: { formula: '1' } };
            expect(check(columns), name).toThrow(TypeError);
        }
        expect(check({ a: { formula: '1' }, B_2: { formula: '2' } })).not.toThrow();
    });

    it('expect a column of the keys it has only, a formula of text, at most 50 columns', () => {
        expect(check({ a: { formula: '1', onclick: 'alert(1)' } })).toThrow(
            /has 'onclick', a calculated column has formula, label, type/
        );
        expect(check({ a: { formula: { toString: () => '1' } } })).toThrow(/formula is \{\}, it is text/);
        expect(check({ a: { formula: '1', type: 'datetime' } })).toThrow(/type is "datetime"/);
        expect(check({ a: { formula: '1', label: '' } })).toThrow(/label is "", it is text, not empty/);
        expect(check([])).toThrow(/it is an object of columns by field/);
        expect(check(Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`c${i}`, { formula: '1' }])))).toThrow(
            /50 at most/
        );
    });

    it('expect a cycle refused, however long - nothing can recurse while a row is read', () => {
        const columns = Object.fromEntries(
            Array.from({ length: 30 }, (_, i) => [`c${i}`, { formula: `{c${(i + 1) % 30}} + 1` }])
        );
        expect(check(columns)).toThrow(/is computed from itself/);
        const compiled = compileCalculatedColumns(columns, fieldType);
        expect([...compiled.values()].every((each) => 'problem' in each)).toBe(true);
        // and the fields made of them: none, so no row reads one
        expect(calculatedFields(compiled, (name) => name).size).toEqual(0);
    });
});

describe('colour rules - hostile state', () => {
    it('expect a colour of the palette or #rrggbb only, set as a custom property - no css text from a rule', () => {
        const check = (color: unknown) => () =>
            assertColorRules([{ operator: 'IS_BLANK', background: color }], 'number', false, 'setState: formats.age.rules');
        for (const color of [
            '#ff0000; background: url(javascript:alert(1))',
            'red;',
            'url(x)',
            'expression(alert(1))',
            '#ff000',
            '#fff',
            'rgb(0,0,0)',
            'var(--x)',
            '',
            0,
            null,
            { toString: () => 'red' }
        ]) {
            expect(check(color), String(color)).toThrow(TypeError);
        }
        expect(colorRuleStyle({ operator: 'IS_BLANK', background: '#AbCdEf' })).toEqual({
            '--simple-html-grid-rule-bg': '#AbCdEf',
            '--simple-html-grid-rule-text-light': '#000000',
            '--simple-html-grid-rule-text-dark': '#000000'
        });
        // a value that is no #rrggbb is never put in a custom property, even if a rule got past the checks
        expect(colorRuleStyle({ operator: 'IS_BLANK', background: 'red;x' as never, color: 'url(x)' as never })).toEqual({});
    });

    it('expect a formula rule of the hostile kind to be a TypeError, before anything changes', () => {
        const fieldOf = (field: string) => (field === 'age' ? { type: 'number' as const, lookup: false } : undefined);
        const check = (expression: unknown) => () =>
            assertColorRules([{ expression, color: 'red' }], 'number', false, 'setState: formats.age.rules', fieldOf);
        expect(check('constructor.constructor("alert(1)")()')).toThrow(
            /rules\[0\]\.expression: \. at 12 is no part of a formula/
        );
        expect(check('constructor("alert(1)")')).toThrow(/rules\[0\]\.expression: CONSTRUCTOR is no function/);
        expect(check('{__proto__} = 1')).toThrow(/is the grid's own/);
        expect(check('{age} + 1')).toThrow(/The formula gives a number, it must give true \/ false/);
        expect(check({ length: 1 })).toThrow(/expression is \{"length":1\}, it is a formula/);
        expect(check('{age} > 1')).not.toThrow();
    });
});
