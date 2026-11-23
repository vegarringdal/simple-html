import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fillText, TEXTS } from '../../texts';
import {
    compileFormula,
    type FieldTypeResult,
    type FormulaProblem,
    type FormulaType,
    FUNCTIONS,
    formulaProblemText,
    MAX_FORMULA_DEPTH,
    MAX_FORMULA_LENGTH
} from '../formula';

/**
 * The formula language (formula.ts): the grammar and the precedence, every function, the blanks, the
 * comparisons, the types checked before a formula runs, the problems with their texts and positions,
 * the problems of a row, the limits. The hostile input is in formulaHostile.test.ts.
 */

const originalTimeZone = process.env.TZ;
beforeAll(() => {
    process.env.TZ = 'Europe/Oslo';
});
afterAll(() => {
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 22, 15, 30));
});
afterEach(() => {
    vi.useRealTimers();
});

/** the fields the formulas know: a Map, never an object's prototype */
const TYPES = new Map<string, FormulaType>([
    ['price', 'number'],
    ['qty', 'number'],
    ['name', 'text'],
    ['status', 'text'],
    ['due', 'date'],
    ['active', 'boolean'],
    ['first name', 'text']
]);
const typeOf = (field: string): FieldTypeResult => {
    const type = TYPES.get(field);
    return type ? { type } : undefined;
};

const ROW: Record<string, unknown> = {
    price: 2.5,
    qty: 4,
    name: 'Ann',
    status: 'Late',
    due: new Date(2026, 10, 20, 9, 0),
    active: true,
    'first name': 'Anne'
};

/** the formula read, or a failure of the test naming its problem */
function formula(text: string) {
    const compiled = compileFormula(text, typeOf);
    if ('problem' in compiled) {
        throw new Error(`${text}: ${JSON.stringify(compiled.problem)}`);
    }
    return compiled.formula;
}

/** the value of a formula in a row */
function value(text: string, row: Record<string, unknown> = ROW) {
    const result = formula(text).evaluate((field) => row[field]);
    if ('problem' in result) {
        throw new Error(`${text}: ${JSON.stringify(result.problem)}`);
    }
    return result.value;
}

/** the problem of a formula that has one, as its English text */
function problem(text: string): string {
    const compiled = compileFormula(text, typeOf);
    if (!('problem' in compiled)) {
        throw new Error(`${text} has no problem`);
    }
    return english(compiled.problem);
}

/** the problem of a row, as its English text */
function rowProblem(text: string, row: Record<string, unknown> = ROW): string {
    const result = formula(text).evaluate((field) => row[field]);
    if (!('problem' in result)) {
        throw new Error(`${text} has a value in the row`);
    }
    return english(result.problem);
}

const english = (found: FormulaProblem) =>
    formulaProblemText(found, (id, values) => fillText((TEXTS as Record<string, string>)[id] ?? id, values));

describe('formula - the language', () => {
    it('expect numbers, texts, booleans and fields, the type of each', () => {
        expect(value('12')).toEqual(12);
        expect(value('0.25 + .5')).toEqual(0.75);
        expect(value('"late"')).toEqual('late');
        expect(value("'it''s'")).toEqual("it's");
        expect(value('"say ""hi"""')).toEqual('say "hi"');
        expect(value('TRUE')).toBe(true);
        expect(value('false')).toBe(false);
        expect(value('{price}')).toEqual(2.5);
        expect(value('{first name}')).toEqual('Anne');
        expect(formula('{due}').type).toEqual('date');
        expect(formula('{price} > 1').type).toEqual('boolean');
        expect(formula('{name} & 1').type).toEqual('text');
    });

    it('expect the precedence of the grammar: * / before + -, & after them, a comparison after &, NOT, AND, OR last', () => {
        expect(value('1 + 2 * 3')).toEqual(7);
        expect(value('(1 + 2) * 3')).toEqual(9);
        expect(value('10 - 4 - 3')).toEqual(3);
        expect(value('12 / 3 / 2')).toEqual(2);
        expect(value('-2 * -3')).toEqual(6);
        expect(value('- - 2')).toEqual(2);
        expect(value('+2')).toEqual(2);
        expect(value('1 + 2 & "x"')).toEqual('3x');
        expect(value('"a" & "b" = "AB"')).toBe(true);
        expect(value('1 < 2 AND 2 < 1 OR TRUE')).toBe(true);
        expect(value('NOT 1 > 2 AND TRUE')).toBe(true);
        expect(value('NOT (TRUE OR FALSE)')).toBe(false);
        expect(value('TRUE OR FALSE AND FALSE')).toBe(true);
    });

    it('expect the keywords and functions in any case, the spaces and line breaks between parts ignored', () => {
        expect(value('if({qty} > 3, "many", "few")')).toEqual('many');
        expect(value('{qty}>3\n and\t{price}<3')).toBe(true);
        expect(value('Round(2.345, 2)')).toEqual(2.35);
    });

    it('expect a computed number to keep 15 significant digits, as a spreadsheet', () => {
        expect(value('0.1 + 0.2')).toEqual(0.3);
        expect(value('406.09 * 10')).toEqual(4060.9);
        expect(value('1 / 3')).toEqual(0.333333333333333);
    });

    it('expect a text compared without its case, a date on its day, numbers as numbers', () => {
        expect(value('{status} = "late"')).toBe(true);
        expect(value('{status} <> "LATE"')).toBe(false);
        expect(value('"apple" < "Banana"')).toBe(true);
        expect(value('"é" = "e"')).toBe(false);
        // due is 2026-11-20 09:00, today 2026-11-22: the day counts, not the time
        expect(value('{due} < TODAY()')).toBe(true);
        expect(value('{due} = {due}')).toBe(true);
        expect(value('10 >= 10')).toBe(true);
        expect(value('9 > 10')).toBe(false);
        expect(value('TRUE = TRUE')).toBe(true);
        expect(value('{active} <> FALSE')).toBe(true);
    });
});

describe('formula - the functions', () => {
    it('expect IF to give the branch of its condition, only that one computed', () => {
        expect(value('IF({qty} > 3, "many", "few")')).toEqual('many');
        expect(value('IF({qty} > 30, "many", "few")')).toEqual('few');
        // the branch not taken would divide by 0
        expect(value('IF({qty} = 0, 0, {price} / {qty})')).toEqual(0.625);
        expect(value('IF({qty} > 3, {qty} / 0, 1)', { ...ROW, qty: 1 })).toEqual(1);
    });

    it('expect ROUND to round halves away from 0, to n decimals or to tens with a negative n', () => {
        expect(value('ROUND(2.5)')).toEqual(3);
        expect(value('ROUND(-2.5)')).toEqual(-3);
        expect(value('ROUND(1.005, 2)')).toEqual(1.01);
        expect(value('ROUND(1234.5678, 1)')).toEqual(1234.6);
        expect(value('ROUND(1250, -2)')).toEqual(1300);
        expect(value('ROUND(-0.4)')).toEqual(-0);
    });

    it('expect ABS, MIN and MAX - of numbers and of dates, the blanks skipped', () => {
        expect(value('ABS(-3.5)')).toEqual(3.5);
        expect(value('MIN(3, 1, 2)')).toEqual(1);
        expect(value('MAX(3, 1, 2)')).toEqual(3);
        expect(value('MAX(0, {price} - 10)')).toEqual(0);
        expect(value('MAX({qty}, 1)', { ...ROW, qty: null })).toEqual(1);
        expect(value('MIN({qty}, {qty})', { ...ROW, qty: null })).toBeNull();
        expect(value('MIN({due}, TODAY())')).toEqual(ROW.due);
        expect(formula('MAX({due}, TODAY())').type).toEqual('date');
    });

    it('expect TODAY() to be today at 00:00, DAYS the days from one day to another, YEAR and MONTH', () => {
        expect(value('TODAY()')).toEqual(new Date(2026, 10, 22));
        expect(formula('TODAY()').usesToday).toBe(true);
        expect(formula('{due}').usesToday).toBe(false);
        expect(value('DAYS({due}, TODAY())')).toEqual(2);
        expect(value('DAYS(TODAY(), {due})')).toEqual(-2);
        // over the change to winter time (2026-10-25 in Oslo): a day of 25 hours is one day
        expect(value('DAYS({due}, TODAY())', { ...ROW, due: new Date(2026, 9, 20, 23, 59) })).toEqual(33);
        expect(value('YEAR({due})')).toEqual(2026);
        expect(value('MONTH({due})')).toEqual(11);
    });

    it('expect CONCAT and & to join texts, numbers and dates as text, a blank as nothing', () => {
        expect(value('CONCAT({name}, " ", {qty}, " ", {due})')).toEqual('Ann 4 2026-11-20');
        expect(value('{name} & " - " & {active}')).toEqual('Ann - true');
        expect(value('{name} & {qty}', { ...ROW, qty: null })).toEqual('Ann');
        expect(value('"" & ""')).toBeNull();
    });

    it('expect COALESCE to give the first value that is not blank, ISBLANK whether one is', () => {
        expect(value('COALESCE({qty}, 0)', { ...ROW, qty: null })).toEqual(0);
        expect(value('COALESCE({qty}, 0)')).toEqual(4);
        expect(value('COALESCE({qty}, {qty})', { ...ROW, qty: undefined })).toBeNull();
        expect(value('ISBLANK({name})', { ...ROW, name: '' })).toBe(true);
        expect(value('ISBLANK({qty})', { ...ROW, qty: 0 })).toBe(false);
        expect(value('ISBLANK({due})', { ...ROW, due: new Date('x') })).toBe(true);
    });

    it('expect every function of FUNCTIONS to be one of the language', () => {
        expect([...FUNCTIONS.keys()]).toEqual([
            'IF',
            'ROUND',
            'ABS',
            'MIN',
            'MAX',
            'TODAY',
            'DAYS',
            'YEAR',
            'MONTH',
            'CONCAT',
            'COALESCE',
            'ISBLANK'
        ]);
    });
});

describe('formula - blanks', () => {
    const blank = { ...ROW, qty: null, name: null, due: null, active: null };

    it('expect a blank in a sum or a function of numbers or dates to give a blank', () => {
        expect(value('{price} * {qty}', blank)).toBeNull();
        expect(value('-{qty}', blank)).toBeNull();
        expect(value('ROUND({qty}, 1)', blank)).toBeNull();
        expect(value('ABS({qty})', blank)).toBeNull();
        expect(value('DAYS({due}, TODAY())', blank)).toBeNull();
        expect(value('YEAR({due})', blank)).toBeNull();
        expect(value('{qty} + 1', { ...ROW, qty: Number.NaN })).toBeNull();
    });

    it('expect a comparison with a blank to be false, = true for two blanks and <> the other way round', () => {
        expect(value('{qty} > 0', blank)).toBe(false);
        expect(value('{qty} < 0', blank)).toBe(false);
        expect(value('{qty} = 0', blank)).toBe(false);
        expect(value('{name} = ""', blank)).toBe(true);
        expect(value('{name} <> ""', blank)).toBe(false);
        expect(value('{name} <> ""')).toBe(true);
    });

    it('expect AND, OR, NOT and IF to take a blank as false', () => {
        expect(value('{active} AND TRUE', blank)).toBe(false);
        expect(value('{active} OR TRUE', blank)).toBe(true);
        expect(value('NOT {active}', blank)).toBe(true);
        expect(value('IF({active}, 1, 2)', blank)).toEqual(2);
    });

    it('expect a number or true / false in a text field to be its text', () => {
        expect(value('{name} & "!"', { ...ROW, name: 42 })).toEqual('42!');
        expect(value('{name} = "true"', { ...ROW, name: true })).toBe(true);
    });
});

describe('formula - problems of the formula', () => {
    it('expect the problems of the syntax, with the position of the character', () => {
        expect(problem('')).toEqual('Write the formula');
        expect(problem('   ')).toEqual('Write the formula');
        expect(problem('1 +')).toEqual('The formula ends too soon');
        expect(problem('ROUND(1')).toEqual('The formula ends too soon');
        expect(problem('1 2')).toEqual('2 at 3 can not be there');
        expect(problem('(1))')).toEqual(') at 4 can not be there');
        expect(problem('1 $ 2')).toEqual('$ at 3 is no part of a formula');
        expect(problem('1; 2')).toEqual('; at 2 is no part of a formula');
        expect(problem('"open')).toEqual('The text at 1 has no closing quote');
        expect(problem('{price')).toEqual('The field at 1 has no closing brace');
        expect(problem('{}')).toEqual('The field at 1 has no closing brace');
        expect(problem('{a{b}')).toEqual('The field at 1 has no closing brace');
        expect(problem('1 < 2 < 3')).toEqual('Compare two values at a time (7): a < b AND b < c');
        expect(problem('price * 2')).toEqual('PRICE at 1 is no function - a field is written in braces');
        expect(problem('SUM(1, 2)')).toEqual(
            'SUM is no function: IF, ROUND, ABS, MIN, MAX, TODAY, DAYS, YEAR, MONTH, CONCAT, COALESCE, ISBLANK'
        );
        expect(problem('AND(TRUE, FALSE)')).toMatch(/^AND is no function/);
        expect(problem('ROUND()')).toEqual('ROUND has 0 values: it is written ROUND(x, n)');
        expect(problem('IF(TRUE, 1)')).toEqual('IF has 2 values: it is written IF(condition, a, b)');
        expect(problem('TODAY(1)')).toEqual('TODAY has 1 values: it is written TODAY()');
        expect(problem('1 AND')).toEqual('The formula ends too soon');
        expect(problem('AND 1')).toEqual('AND at 1 can not be there');
        expect(problem('1.2.3')).toEqual('.3 at 4 can not be there');
        expect(problem('1 . 2')).toEqual('. at 3 is no part of a formula');
    });

    it('expect the fields: none of the grid’s own, none the grid does not know', () => {
        expect(problem('{__KEY}')).toEqual("{__KEY} is the grid's own, not a field");
        expect(problem('{nope} + 1')).toEqual('No field {nope}');
        expect(formula('{price} * {qty} + {price}').fields).toEqual(['price', 'qty']);
    });

    it('expect the types checked before it runs: a part of another type is a problem naming it', () => {
        expect(problem('{name} * 2')).toEqual('* takes a number: {name} is a text');
        expect(problem('-{name}')).toEqual('- takes a number: {name} is a text');
        expect(problem('"a" + "b"')).toEqual('+ takes a number: "a" is a text');
        expect(problem('NOT {qty}')).toEqual('NOT takes true / false: {qty} is a number');
        expect(problem('{qty} AND TRUE')).toEqual('AND takes true / false: {qty} is a number');
        expect(problem('{qty} = "4"')).toEqual('= takes values of one type: {qty} is a number, "4" is a text');
        expect(problem('TRUE < FALSE')).toEqual('< compares numbers, texts and dates, not true / false');
        expect(problem('IF({qty}, 1, 2)')).toEqual('IF takes true / false: {qty} is a number');
        expect(problem('IF(TRUE, 1, "a")')).toEqual('IF takes values of one type: 1 is a number, "a" is a text');
        expect(problem('DAYS({due}, 3)')).toEqual('DAYS takes a date: 3 is a number');
        expect(problem('YEAR({name})')).toEqual('YEAR takes a date: {name} is a text');
        expect(problem('MAX("a", "b")')).toEqual('MAX takes a number: "a" is a text');
        expect(problem('MIN(1, {due})')).toEqual('MIN takes values of one type: 1 is a number, {due} is a date');
        expect(problem('COALESCE({qty}, "none")')).toMatch(/^COALESCE takes values of one type/);
        expect(problem('ROUND(1, 1.5)')).toEqual('ROUND takes a whole number of digits from -10 to 10, not 1.5');
        expect(problem('ROUND(1, -11)')).toEqual('ROUND takes a whole number of digits from -10 to 10, not -11');
        // a long part is cut
        expect(problem(`${'{price} + '.repeat(10)}"x" * 2`)).toEqual('* takes a number: "x" is a text');
        expect(problem(`({name} & "${'x'.repeat(60)}") * 2`)).toEqual(
            `* takes a number: ${`{name} & "${'x'.repeat(60)}`.slice(0, 39)}… is a text`
        );
    });

    it('expect the limits: its length, how deep it nests', () => {
        expect(problem(`1${' + 1'.repeat(300)}`)).toEqual('The formula is longer than 1000 characters');
        expect(problem(`${'('.repeat(MAX_FORMULA_DEPTH + 1)}1${')'.repeat(MAX_FORMULA_DEPTH + 1)}`)).toEqual(
            'The formula nests deeper than 32 levels'
        );
        expect(value(`${'('.repeat(MAX_FORMULA_DEPTH)}1${')'.repeat(MAX_FORMULA_DEPTH)}`)).toEqual(1);
        expect(problem(`${'-'.repeat(40)}1`)).toEqual('The formula nests deeper than 32 levels');
        expect(problem(`${'NOT '.repeat(40)}TRUE`)).toEqual('The formula nests deeper than 32 levels');
        expect(problem(`${'ABS('.repeat(40)}1${')'.repeat(40)}`)).toEqual('The formula nests deeper than 32 levels');
        // 501 parts, under 1000 characters
        expect(problem(Array.from({ length: 251 }, () => '1').join('+'))).toEqual('The formula has more than 500 parts');
        expect(MAX_FORMULA_LENGTH).toEqual(1000);
    });
});

describe('formula - problems of a row', () => {
    it('expect a division by 0, a value not of its field’s type, a number too big: no value, said why', () => {
        expect(rowProblem('{price} / 0')).toEqual('Divides by 0 in this row: no value');
        expect(rowProblem('{price} * 2', { ...ROW, price: 'cheap' })).toEqual('{price} is not a number in this row: no value');
        expect(rowProblem('YEAR({due})', { ...ROW, due: '2026-11-20' })).toEqual('{due} is not a date in this row: no value');
        expect(rowProblem('{active} AND TRUE', { ...ROW, active: 'yes' })).toEqual(
            '{active} is not true / false in this row: no value'
        );
        expect(rowProblem('{name} & ""', { ...ROW, name: { toString: () => 'x' } })).toEqual(
            '{name} is not a text in this row: no value'
        );
        expect(rowProblem('{price} * {price}', { ...ROW, price: 1e200 })).toEqual('A number too big in this row: no value');
        expect(rowProblem('ROUND(1, {qty})', { ...ROW, qty: 1.5 })).toMatch(/^ROUND takes a whole number of digits/);
    });

    it('expect a text longer than 10000 characters made by & or CONCAT to be a problem of the row', () => {
        const long = { ...ROW, name: 'x'.repeat(6000) };
        expect(rowProblem('{name} & {name}', long)).toEqual('A text of more than 10000 characters in this row: no value');
        expect(rowProblem('CONCAT({name}, {name})', long)).toEqual('A text of more than 10000 characters in this row: no value');
        expect(value('{name} & "!"', long)).toHaveLength(6001);
    });
});
