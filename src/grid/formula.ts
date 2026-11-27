/**
 * The formula language of the calculated columns (`GridState.calculatedColumns`, calculatedColumns.ts)
 * and of the formula colour rules (`ColorRule.expression`, colorRules.ts): a small language of its own,
 * read and run by this file - never `eval`, `new Function` or anything that runs code. A formula is
 * text in the state, it can come from storage or another user: it reads the fields of a row and
 * computes a value, nothing else.
 *
 * ```text
 * formula    := or
 * or         := and ( OR and )*
 * and        := not ( AND not )*
 * not        := NOT not | compare
 * compare    := concat [ ( = | <> | < | <= | > | >= ) concat ]     -- one comparison: no a < b < c
 *                                                                   -- `!=` is `<>`, `==` is `=`
 * concat     := additive ( & additive )*
 * additive   := term ( ( + | - ) term )*
 * term       := unary ( ( * | / ) unary )*
 * unary      := ( - | + ) unary | primary
 * primary    := number | text | TRUE | FALSE | {field} | NAME ( [ formula ( , formula )* ] ) | ( formula )
 * ```
 *
 * - **A number** is digits with a `.` for decimals: `12`, `0.25`, `.5`. **A text** is in `"` or `'`,
 *   its quote doubled inside it: `"say ""hi"""`. **A field** is `{name}`, as in the templates of the
 *   text columns (cellTemplate.ts): any characters but braces; not one of the grid's own (`{__...}`).
 *   The keywords and the names of the functions are in any case: `and`, `If`.
 * - **The types**: number, text, date, boolean. A field has its field's type (`datasource.getField()`,
 *   a `datetime` is a date, a field not listed in the datasource's `fields` is text), a calculated
 *   column the type of its formula. Every part of a formula has its type before it runs: `{name} * 2`
 *   on a text field is a problem at once, not a wrong value in some rows.
 * - **Blank**: a field that is empty (null, undefined, `''`, an invalid date, NaN) is blank. A blank in
 *   a sum, a function of numbers or dates is a blank out (`{price} * {qty}` is blank without a qty -
 *   `COALESCE({qty}, 0)` counts it as 0); `&` and CONCAT take it as `''`; MIN and MAX skip it. A
 *   comparison with a blank is false, `=` is true for two blanks and `<>` the other way round: `{x} = ""`
 *   asks whether x is blank. AND, OR, NOT and IF take a blank as false.
 * - **Comparisons**: a text ignores case (`"Late" = "late"`), a date compares its day.
 * - **A number computed** (`+ - * /`) keeps 15 significant digits, as a spreadsheet: `0.1 + 0.2` is 0.3.
 * - **A row where it can not be computed** - a division by 0, a value that is not of its field's type
 *   (a text in a number field), a number too big - has no value: the cell is blank. Formula.evaluate()
 *   says why, for the preview of the grid config dialog.
 * - **Limits** against abuse: at most MAX_FORMULA_LENGTH characters and MAX_FORMULA_PARTS parts, nested
 *   at most MAX_FORMULA_DEPTH deep (brackets, functions, a minus or NOT in front); a text it makes at
 *   most MAX_TEXT_LENGTH characters. It has no loops and no recursion: it runs once through its parts.
 *
 * **Hostile input.** A formula from a saved state is taken as hostile: it is read by the tokenizer and
 * parser below into parts of a fixed set of kinds (Node), checked, and run by a switch on the kind. Only
 * the names of FUNCTIONS (a Map, so `constructor`, `toString`, `__proto__` are no functions) and the
 * keywords are names; there is no `.` or `[ ]`, no way to reach an object. A field is one the grid knows
 * (the caller's typeOf), never one of the grid's own (`{__...}`), and the caller reads it as an own
 * property of the row. What it gives is a number, a text, a date or true / false - data, shown as text.
 *
 * The functions (FUNCTIONS): IF, ROUND, ABS, MIN, MAX, TODAY, DAYS, YEAR, MONTH, CONCAT, COALESCE,
 * ISBLANK, and of text LEFT, RIGHT, MID (SUBSTRING), LEN, UPPER, LOWER, TRIM, CONTAINS - see the guide
 * "Calculated columns".
 */

/**
 * The type of a value of a formula: a number, a text, a date (a `Date`, its day counts) or true / false
 */
export type FormulaType = 'number' | 'text' | 'date' | 'boolean';

/** every type of a formula, for checking one from plain JavaScript or JSON */
export const FORMULA_TYPES: readonly FormulaType[] = ['number', 'text', 'date', 'boolean'];

/** the most characters a formula may have */
export const MAX_FORMULA_LENGTH = 1000;

/** how deep a formula may nest: brackets, functions, a minus or NOT in front of a part */
export const MAX_FORMULA_DEPTH = 32;

/** the most parts a formula may have: numbers, texts, fields, operators, functions */
export const MAX_FORMULA_PARTS = 500;

/** the most characters a text a formula makes may have (`&`, CONCAT): a longer one is a problem of the row */
export const MAX_TEXT_LENGTH = 10_000;

/**
 * What is wrong with a formula, or with a row it was run on: the id of its text (the text is
 * `columnSettings.formula.problem.<id>`, see texts.ts), the values of its text, and the values that are
 * types - the text of the type is put in for them (`columnSettings.formula.type.<type>`)
 */
export interface FormulaProblem {
    id: FormulaProblemId;
    values: Record<string, string | number>;
    types?: Record<string, FormulaType>;
}

/**
 * the problems of a formula:
 * - `empty`: no formula; `length`, `depth`, `size`: over a limit
 * - `character`: a character that is no part of a formula (`$`, `;`); `unexpected`: a part where it
 *   can not be (`1 2`, `)`); `end`: the formula stops too soon (`1 +`, `ROUND(1`); `text`: a text
 *   without its closing quote; `field`: a `{` without its `}`, or `{}`
 * - `function`: a NAME( that is no function; `arguments`: a function with too few or too many values;
 *   `name`: a name that is no keyword and is not followed by `(` (a field is written `{name}`)
 * - `internal`: a field of the grid's own (`{__KEY}`); `unknownField`: a field the grid does not know;
 *   `cycle`: a calculated column computed from itself; `fieldProblem`: a calculated column the formula
 *   reads has a problem of its own; `clobField`: a field with `clobType` (FieldConfig.clobType), a long
 *   text no formula reads
 * - `number`, `date`, `boolean`: a part of another type where one of these is needed; `same`: two parts
 *   that must have one type (`=`, IF, COALESCE ...) have two; `order`: `<` on true / false; `chain`:
 *   `a < b < c`; `digits`: ROUND's digits not a whole number from -10 to 10
 * - `result`: a formula that is not of the type it must have (a colour rule's is true / false)
 * - and in a row (Formula.evaluate): `divide` by 0, `value` (a field's value is not of its type),
 *   `overflow` (a number too big), `long` (a text longer than MAX_TEXT_LENGTH)
 */
export type FormulaProblemId =
    | 'empty'
    | 'length'
    | 'depth'
    | 'size'
    | 'character'
    | 'bigNumber'
    | 'unexpected'
    | 'end'
    | 'text'
    | 'field'
    | 'function'
    | 'arguments'
    | 'name'
    | 'internal'
    | 'unknownField'
    | 'cycle'
    | 'fieldProblem'
    | 'clobField'
    | 'number'
    | 'date'
    | 'boolean'
    | 'same'
    | 'order'
    | 'chain'
    | 'digits'
    | 'result'
    | 'divide'
    | 'value'
    | 'overflow'
    | 'long';

/** a value of a formula: null is blank */
export type FormulaValue = number | string | boolean | Date | null;

/** what a formula gives in a row: its value, or why it has none */
export type FormulaResult = { value: FormulaValue } | { problem: FormulaProblem };

/**
 * What a formula knows of a field: its type, or the problem of the calculated column it is (a cycle,
 * a formula with a problem). undefined: no such field
 */
export type FieldTypeResult = { type: FormulaType } | { problem: FormulaProblem } | undefined;

/**
 * A formula, read and checked: run it on a row with evaluate()
 */
export interface Formula {
    /** the type of its value */
    type: FormulaType;
    /** the fields it reads, once each, in the order they are written */
    fields: readonly string[];
    /** true when it calls TODAY(): its value changes from one day to the next */
    usesToday: boolean;
    /**
     * Its value in a row, or why the row has none. Never throws
     * @param read the value of a field of the row: `(field) => row[field]`
     */
    evaluate(read: (field: string) => unknown): FormulaResult;
}

/**
 * A function of the language: how many values it takes (`max` Infinity: any number), how its type is
 * checked, how it is run
 */
interface FunctionSpec {
    min: number;
    max: number;
    /** how it is written, for the problem of a wrong number of values */
    usage: string;
}

/**
 * The functions, by name - see the guide "Calculated columns" for each:
 *
 * | function | gives |
 * | --- | --- |
 * | `IF(condition, a, b)` | a when the condition is true, else b - a and b of one type, only the one taken is computed |
 * | `ROUND(x, n)` | x rounded to n decimals (n left out: 0, negative: tens, hundreds), halves away from 0 |
 * | `ABS(x)` | x without its sign |
 * | `MIN(a, b, …)`, `MAX(a, b, …)` | the least / the greatest of numbers or of dates, blanks skipped |
 * | `TODAY()` | today, at 00:00 |
 * | `DAYS(from, to)` | the days from the day of `from` to the day of `to`: negative when `to` is before |
 * | `YEAR(d)`, `MONTH(d)` | the year, the month (1 to 12) of a date |
 * | `CONCAT(a, b, …)` | the values as one text, as `&` joins them |
 * | `COALESCE(a, b, …)` | the first that is not blank - all of one type |
 * | `ISBLANK(x)` | true when x is blank |
 * | `LEFT(text, n)`, `RIGHT(text, n)` | the first / the last n characters |
 * | `MID(text, start, n)`, `SUBSTRING(…)` | n characters from the start-th, the first is 1 |
 * | `LEN(text)` | how many characters, 0 for a blank |
 * | `UPPER(text)`, `LOWER(text)`, `TRIM(text)` | in upper / lower case; without the spaces around it |
 * | `CONTAINS(text, part)` | true when the text has the part, in any case |
 *
 * The functions of text take a value of any type as `&` does (a number as written, a date `YYYY-MM-DD`);
 * a count or a position that is not a whole number is cut to one, a negative one is 0 (a start below 1 is 1).
 */
export const FUNCTIONS: ReadonlyMap<string, FunctionSpec> = new Map([
    ['IF', { min: 3, max: 3, usage: 'IF(condition, a, b)' }],
    ['ROUND', { min: 1, max: 2, usage: 'ROUND(x, n)' }],
    ['ABS', { min: 1, max: 1, usage: 'ABS(x)' }],
    ['MIN', { min: 1, max: Number.POSITIVE_INFINITY, usage: 'MIN(a, b, …)' }],
    ['MAX', { min: 1, max: Number.POSITIVE_INFINITY, usage: 'MAX(a, b, …)' }],
    ['TODAY', { min: 0, max: 0, usage: 'TODAY()' }],
    ['DAYS', { min: 2, max: 2, usage: 'DAYS(from, to)' }],
    ['YEAR', { min: 1, max: 1, usage: 'YEAR(date)' }],
    ['MONTH', { min: 1, max: 1, usage: 'MONTH(date)' }],
    ['CONCAT', { min: 1, max: Number.POSITIVE_INFINITY, usage: 'CONCAT(a, b, …)' }],
    ['COALESCE', { min: 1, max: Number.POSITIVE_INFINITY, usage: 'COALESCE(a, b, …)' }],
    ['ISBLANK', { min: 1, max: 1, usage: 'ISBLANK(x)' }],
    ['LEFT', { min: 2, max: 2, usage: 'LEFT(text, n)' }],
    ['RIGHT', { min: 2, max: 2, usage: 'RIGHT(text, n)' }],
    ['MID', { min: 3, max: 3, usage: 'MID(text, start, n)' }],
    ['SUBSTRING', { min: 3, max: 3, usage: 'SUBSTRING(text, start, n)' }],
    ['LEN', { min: 1, max: 1, usage: 'LEN(text)' }],
    ['UPPER', { min: 1, max: 1, usage: 'UPPER(text)' }],
    ['LOWER', { min: 1, max: 1, usage: 'LOWER(text)' }],
    ['TRIM', { min: 1, max: 1, usage: 'TRIM(text)' }],
    ['CONTAINS', { min: 2, max: 2, usage: 'CONTAINS(text, part)' }]
]);

/** the keywords: operators and the two booleans, any case */
const KEYWORDS = ['AND', 'OR', 'NOT', 'TRUE', 'FALSE'];

/** the operators of two parts */
type BinaryOperator = '+' | '-' | '*' | '/' | '&' | '=' | '<>' | '<' | '<=' | '>' | '>=' | 'AND' | 'OR';

/** @internal a part of a formula, read: `start` and `end` are where it is in the text, for the problems */
export type FormulaNode = Node;
/** @internal the operators of two parts */
export type FormulaBinaryOperator = BinaryOperator;

/** a part of a formula, read: `start` and `end` are where it is in the text, for the problems */
type Node = { start: number; end: number } & (
    | { kind: 'number'; value: number }
    | { kind: 'text'; value: string }
    | { kind: 'boolean'; value: boolean }
    | { kind: 'field'; name: string }
    | { kind: 'negate'; arg: Node }
    | { kind: 'not'; arg: Node }
    | { kind: 'binary'; operator: BinaryOperator; left: Node; right: Node }
    | { kind: 'call'; name: string; args: Node[] }
);

/** a piece of the text: what it is, its text (a keyword or a name in upper case), where it is */
interface Token {
    kind: 'number' | 'text' | 'field' | 'name' | 'operator' | 'end';
    text: string;
    start: number;
    end: number;
}

/** a problem found while a formula is read or checked: thrown, caught by compileFormula */
class ProblemError {
    constructor(readonly problem: FormulaProblem) {}
}

/** stops reading or checking with a problem */
function fail(id: FormulaProblemId, values: Record<string, string | number> = {}, types?: Record<string, FormulaType>): never {
    throw new ProblemError(types ? { id, values, types } : { id, values });
}

/** the characters of an operator, the longest first: `<=` before `<` */
const OPERATORS = ['<>', '!=', '==', '<=', '>=', '+', '-', '*', '/', '&', '=', '<', '>', '(', ')', ','];

/** the operators written another way, as in JavaScript and SQL: `!=` is `<>`, `==` is `=` */
const OPERATOR_ALIASES: Record<string, string> = { '!=': '<>', '==': '=' };

/**
 * The formula in its tokens, the last one `end`
 */
function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let at = 0;
    while (at < text.length) {
        const char = text[at];
        if (/\s/.test(char)) {
            at++;
            continue;
        }
        const start = at;
        if (/[0-9.]/.test(char)) {
            const match = /^(\d+(\.\d+)?|\.\d+)/.exec(text.slice(at));
            if (!match) {
                fail('character', { text: char, position: at + 1 });
            }
            at += match[0].length;
            // more digits than a number holds (Infinity): no number, also not in SQL
            if (!Number.isFinite(Number(match[0]))) {
                fail('bigNumber', { position: start + 1 });
            }
            tokens.push({ kind: 'number', text: match[0], start, end: at });
        } else if (char === '"' || char === "'") {
            // the quote doubled is one quote in the text
            let value = '';
            at++;
            for (;;) {
                if (at >= text.length) {
                    fail('text', { position: start + 1 });
                }
                if (text[at] === char) {
                    if (text[at + 1] === char) {
                        value += char;
                        at += 2;
                        continue;
                    }
                    at++;
                    break;
                }
                value += text[at];
                at++;
            }
            tokens.push({ kind: 'text', text: value, start, end: at });
        } else if (char === '{') {
            const close = text.indexOf('}', at);
            const open = text.indexOf('{', at + 1);
            if (close === -1 || (open !== -1 && open < close) || close === at + 1) {
                fail('field', { position: start + 1 });
            }
            tokens.push({ kind: 'field', text: text.slice(at + 1, close), start, end: close + 1 });
            at = close + 1;
        } else if (/[A-Za-z_]/.test(char)) {
            const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(at)) as RegExpExecArray;
            at += match[0].length;
            tokens.push({ kind: 'name', text: match[0].toUpperCase(), start, end: at });
        } else {
            const operator = OPERATORS.find((each) => text.startsWith(each, at));
            if (!operator) {
                fail('character', { text: char, position: at + 1 });
            }
            at += operator.length;
            tokens.push({ kind: 'operator', text: OPERATOR_ALIASES[operator] ?? operator, start, end: at });
        }
    }
    tokens.push({ kind: 'end', text: '', start: text.length, end: text.length });
    return tokens;
}

/**
 * Reads the tokens into the parts of the formula, by the grammar at the top of the file
 */
function parse(tokens: Token[]): Node {
    // a part is made of one token at least (a bracket, a comma none): the tokens bound the parts
    if (tokens.length - 1 > MAX_FORMULA_PARTS) {
        fail('size', { max: MAX_FORMULA_PARTS });
    }
    let index = 0;
    let depth = 0;
    const peek = () => tokens[index];
    const next = () => tokens[index++];
    const isOperator = (text: string) => peek().kind === 'operator' && peek().text === text;
    const isKeyword = (text: string) => peek().kind === 'name' && peek().text === text;
    /** a part one level deeper: over the limit is a problem */
    const deeper = <T>(read: () => T): T => {
        depth++;
        if (depth > MAX_FORMULA_DEPTH) {
            fail('depth', { max: MAX_FORMULA_DEPTH });
        }
        const node = read();
        depth--;
        return node;
    };
    /** the token is not what can come here */
    const unexpected = (token: Token): never =>
        token.kind === 'end' ? fail('end') : fail('unexpected', { text: tokenText(token), position: token.start + 1 });
    const expect = (text: string) => {
        if (!isOperator(text)) {
            unexpected(peek());
        }
        next();
    };
    const binary = (operator: BinaryOperator, left: Node, right: Node): Node => ({
        kind: 'binary',
        operator,
        left,
        right,
        start: left.start,
        end: right.end
    });

    const or = (): Node => {
        let left = and();
        while (isKeyword('OR')) {
            next();
            left = binary('OR', left, and());
        }
        return left;
    };
    const and = (): Node => {
        let left = not();
        while (isKeyword('AND')) {
            next();
            left = binary('AND', left, not());
        }
        return left;
    };
    const not = (): Node => {
        if (isKeyword('NOT')) {
            const start = next().start;
            return deeper(() => {
                const arg = not();
                return { kind: 'not', arg, start, end: arg.end };
            });
        }
        return compare();
    };
    const COMPARISONS = ['=', '<>', '<', '<=', '>', '>='];
    const isComparison = () => peek().kind === 'operator' && COMPARISONS.includes(peek().text);
    const compare = (): Node => {
        const left = concat();
        if (!isComparison()) {
            return left;
        }
        const operator = next().text as BinaryOperator;
        const node = binary(operator, left, concat());
        if (isComparison()) {
            fail('chain', { position: peek().start + 1 });
        }
        return node;
    };
    const concat = (): Node => {
        let left = additive();
        while (isOperator('&')) {
            next();
            left = binary('&', left, additive());
        }
        return left;
    };
    const additive = (): Node => {
        let left = term();
        while (isOperator('+') || isOperator('-')) {
            const operator = next().text as BinaryOperator;
            left = binary(operator, left, term());
        }
        return left;
    };
    const term = (): Node => {
        let left = unary();
        while (isOperator('*') || isOperator('/')) {
            const operator = next().text as BinaryOperator;
            left = binary(operator, left, unary());
        }
        return left;
    };
    const unary = (): Node => {
        if (isOperator('-') || isOperator('+')) {
            const token = next();
            return deeper(() => {
                const arg = unary();
                // + in front changes nothing, but it still takes a number
                return token.text === '-'
                    ? { kind: 'negate', arg, start: token.start, end: arg.end }
                    : {
                          kind: 'binary',
                          operator: '+',
                          left: { kind: 'number', value: 0, start: token.start, end: token.start },
                          right: arg,
                          start: token.start,
                          end: arg.end
                      };
            });
        }
        return primary();
    };
    const primary = (): Node => {
        const token = next();
        switch (token.kind) {
            case 'number':
                return { kind: 'number', value: Number(token.text), start: token.start, end: token.end };
            case 'text':
                return { kind: 'text', value: token.text, start: token.start, end: token.end };
            case 'field':
                return { kind: 'field', name: token.text, start: token.start, end: token.end };
            case 'name': {
                if (token.text === 'TRUE' || token.text === 'FALSE') {
                    return { kind: 'boolean', value: token.text === 'TRUE', start: token.start, end: token.end };
                }
                if (!isOperator('(')) {
                    return KEYWORDS.includes(token.text)
                        ? unexpected(token)
                        : fail('name', { name: token.text, position: token.start + 1 });
                }
                const spec = FUNCTIONS.get(token.text);
                if (!spec) {
                    fail('function', { name: token.text, position: token.start + 1, names: [...FUNCTIONS.keys()].join(', ') });
                }
                next();
                return deeper(() => {
                    const args: Node[] = [];
                    if (!isOperator(')')) {
                        args.push(or());
                        while (isOperator(',')) {
                            next();
                            args.push(or());
                        }
                    }
                    const end = peek().end;
                    expect(')');
                    if (args.length < spec.min || args.length > spec.max) {
                        fail('arguments', { name: token.text, usage: spec.usage, count: args.length });
                    }
                    return { kind: 'call', name: token.text, args, start: token.start, end };
                });
            }
            case 'operator':
                if (token.text === '(') {
                    return deeper(() => {
                        const inner = or();
                        expect(')');
                        return inner;
                    });
                }
                return unexpected(token);
            default:
                return unexpected(token);
        }
    };

    const node = or();
    if (peek().kind !== 'end') {
        unexpected(peek());
    }
    return node;
}

/** a token as the problems show it: a text in its quotes, a field in its braces */
function tokenText(token: Token): string {
    switch (token.kind) {
        case 'text':
            return `"${token.text}"`;
        case 'field':
            return `{${token.text}}`;
        default:
            return token.text;
    }
}

/** the most characters of a part the problems show */
const PART_LENGTH = 40;

/**
 * Checks the types of every part, the first problem throws. The types of the parts, by part, for
 * evaluate - the parts of the same formula
 * @param text the formula, the problems show its parts
 * @param typeOf what the formula knows of a field
 * @returns the type of the formula
 */
function check(node: Node, text: string, typeOf: (field: string) => FieldTypeResult, fields: string[]): FormulaType {
    /** the text of a part, for a problem */
    const part = (each: Node) => {
        const written = text.slice(each.start, each.end).trim();
        return written.length > PART_LENGTH ? `${written.slice(0, PART_LENGTH - 1)}…` : written;
    };
    const typed = (each: Node): FormulaType => check(each, text, typeOf, fields);
    /** a part of a type: else the problem of that type, `what` the operator or function */
    const must = (each: Node, type: 'number' | 'date' | 'boolean', what: string) => {
        const got = typed(each);
        if (got !== type) {
            fail(type, { what, part: part(each) }, { got });
        }
    };
    /** parts of one type: the first one's */
    const same = (parts: Node[], what: string): FormulaType => {
        const first = typed(parts[0]);
        for (const each of parts.slice(1)) {
            const got = typed(each);
            if (got !== first) {
                fail('same', { what, part: part(parts[0]), other: part(each) }, { got: first, expected: got });
            }
        }
        return first;
    };

    switch (node.kind) {
        case 'number':
            return 'number';
        case 'text':
            return 'text';
        case 'boolean':
            return 'boolean';
        case 'field': {
            const field = `{${node.name}}`;
            if (node.name.startsWith('__')) {
                fail('internal', { field });
            }
            const known = typeOf(node.name);
            if (!known) {
                fail('unknownField', { field });
            }
            if ('problem' in known) {
                throw new ProblemError(known.problem);
            }
            if (!fields.includes(node.name)) {
                fields.push(node.name);
            }
            return known.type;
        }
        case 'negate':
            must(node.arg, 'number', '-');
            return 'number';
        case 'not':
            must(node.arg, 'boolean', 'NOT');
            return 'boolean';
        case 'binary': {
            const { operator, left, right } = node;
            switch (operator) {
                case '+':
                case '-':
                case '*':
                case '/':
                    must(left, 'number', operator);
                    must(right, 'number', operator);
                    return 'number';
                case '&':
                    typed(left);
                    typed(right);
                    return 'text';
                case 'AND':
                case 'OR':
                    must(left, 'boolean', operator);
                    must(right, 'boolean', operator);
                    return 'boolean';
                case '=':
                case '<>':
                    same([left, right], operator);
                    return 'boolean';
                default:
                    if (same([left, right], operator) === 'boolean') {
                        fail('order', { what: operator, part: part(left) });
                    }
                    return 'boolean';
            }
        }
        case 'call': {
            const { name, args } = node;
            switch (name) {
                case 'IF':
                    must(args[0], 'boolean', name);
                    return same(args.slice(1), name);
                case 'ROUND': {
                    must(args[0], 'number', name);
                    if (args[1]) {
                        must(args[1], 'number', name);
                        // digits written as a number are checked now, the others in each row
                        const digits = constantNumber(args[1]);
                        if (digits !== undefined && !isDigits(digits)) {
                            fail('digits', { part: part(args[1]) });
                        }
                    }
                    return 'number';
                }
                case 'ABS':
                    must(args[0], 'number', name);
                    return 'number';
                case 'MIN':
                case 'MAX': {
                    const type = same(args, name);
                    if (type !== 'number' && type !== 'date') {
                        fail('number', { what: name, part: part(args[0]) }, { got: type });
                    }
                    return type;
                }
                case 'TODAY':
                    return 'date';
                case 'DAYS':
                    must(args[0], 'date', name);
                    must(args[1], 'date', name);
                    return 'number';
                case 'YEAR':
                case 'MONTH':
                    must(args[0], 'date', name);
                    return 'number';
                case 'CONCAT':
                    for (const each of args) {
                        typed(each);
                    }
                    return 'text';
                case 'COALESCE':
                    return same(args, name);
                case 'LEFT':
                case 'RIGHT':
                case 'MID':
                case 'SUBSTRING':
                    // the text of any type, as & takes it; the positions and counts numbers
                    typed(args[0]);
                    for (const each of args.slice(1)) {
                        must(each, 'number', name);
                    }
                    return 'text';
                case 'LEN':
                    typed(args[0]);
                    return 'number';
                case 'UPPER':
                case 'LOWER':
                case 'TRIM':
                    typed(args[0]);
                    return 'text';
                case 'CONTAINS':
                    typed(args[0]);
                    typed(args[1]);
                    return 'boolean';
                default:
                    // ISBLANK: any type
                    typed(args[0]);
                    return 'boolean';
            }
        }
    }
}

/** the number a part is written as - `2`, `-1` - undefined for another part */
function constantNumber(node: Node): number | undefined {
    if (node.kind === 'number') {
        return node.value;
    }
    return node.kind === 'negate' && node.arg.kind === 'number' ? -node.arg.value : undefined;
}

/** ROUND's digits: a whole number from -10 to 10 */
function isDigits(value: number): boolean {
    return Number.isInteger(value) && value >= -10 && value <= 10;
}

/** a problem in a row: thrown while the formula runs, caught by evaluate */
class RowError {
    constructor(readonly problem: FormulaProblem) {}
}

/**
 * The value of a field, as the type the formula has for it: a blank is null. A value of another type -
 * a text in a number field - is a problem of the row; a number or true / false in a text field is its
 * text, as the text formatter shows it
 */
function fieldValue(value: unknown, type: FormulaType, name: string): FormulaValue {
    if (value === null || value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value))) {
        return null;
    }
    switch (type) {
        case 'number':
            if (typeof value === 'number') {
                return value;
            }
            break;
        case 'boolean':
            if (typeof value === 'boolean') {
                return value;
            }
            break;
        case 'date':
            if (value instanceof Date) {
                return Number.isNaN(value.getTime()) ? null : value;
            }
            break;
        default:
            if (typeof value === 'string') {
                return value;
            }
            if (typeof value === 'number' || typeof value === 'boolean') {
                return String(value);
            }
    }
    throw new RowError({ id: 'value', values: { field: `{${name}}` }, types: { type } });
}

/** the day of a date, as a whole number: the days since 1970-01-01, on the local calendar */
function dayOf(date: Date): number {
    return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** a text made by `&` or CONCAT: `''` is blank, one longer than MAX_TEXT_LENGTH a problem of the row */
function joinedText(text: string): string | null {
    if (text.length > MAX_TEXT_LENGTH) {
        throw new RowError({ id: 'long', values: { max: MAX_TEXT_LENGTH } });
    }
    return text === '' ? null : text;
}

/** a value as text, for `&` and CONCAT: a blank `''`, a date `YYYY-MM-DD` (its day) */
function textOf(value: FormulaValue): string {
    if (value === null) {
        return '';
    }
    if (value instanceof Date) {
        const pad = (number: number) => String(number).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    return String(value);
}

/** compares two values of one type that are not blank: < 0, 0, > 0. A text ignores case, a date compares its day */
function compareValues(a: FormulaValue, b: FormulaValue): number {
    if (typeof a === 'string' && typeof b === 'string') {
        return a.localeCompare(b, undefined, { sensitivity: 'accent' });
    }
    if (a instanceof Date && b instanceof Date) {
        return dayOf(a) - dayOf(b);
    }
    return Number(a) - Number(b);
}

/**
 * a number computed: kept to 15 significant digits, as a spreadsheet keeps them - the noise of binary
 * numbers goes, `0.1 + 0.2` is 0.3 and `406.09 * 10` 4060.9. One too big (Infinity) is a problem of the row
 */
function finite(value: number): number {
    if (!Number.isFinite(value)) {
        throw new RowError({ id: 'overflow', values: {} });
    }
    return Number(value.toPrecision(15));
}

/**
 * ROUND: halves away from 0, as a spreadsheet rounds - `ROUND(2.5)` is 3, `ROUND(-2.5)` -3. The
 * scaled value is nudged by the smallest step, so 1.005 (1.00499999… as a binary number) rounds to 1.01
 */
function round(value: number, digits: number): number {
    const factor = 10 ** digits;
    const scaled = Math.abs(value) * factor;
    return (Math.sign(value) * Math.round(scaled * (1 + Number.EPSILON))) / factor;
}

/**
 * Runs a part of the formula on a row. The types were checked: a value is of its part's type or blank
 * @param fieldTypes the type of each field the formula reads
 */
function run(node: Node, read: (field: string) => unknown, fieldTypes: ReadonlyMap<string, FormulaType>): FormulaValue {
    const value = (each: Node) => run(each, read, fieldTypes);
    const truth = (each: Node) => value(each) === true;
    switch (node.kind) {
        case 'number':
        case 'boolean':
            return node.value;
        case 'text':
            return node.value === '' ? null : node.value;
        case 'field':
            return fieldValue(read(node.name), fieldTypes.get(node.name) ?? 'text', node.name);
        case 'negate': {
            const arg = value(node.arg);
            return arg === null ? null : -(arg as number);
        }
        case 'not':
            return !truth(node.arg);
        case 'binary': {
            const { operator } = node;
            if (operator === 'AND') {
                return truth(node.left) && truth(node.right);
            }
            if (operator === 'OR') {
                return truth(node.left) || truth(node.right);
            }
            const left = value(node.left);
            const right = value(node.right);
            switch (operator) {
                case '&':
                    return joinedText(textOf(left) + textOf(right));
                case '=':
                    return left === null || right === null ? left === right : compareValues(left, right) === 0;
                case '<>':
                    return left === null || right === null ? left !== right : compareValues(left, right) !== 0;
                case '<':
                case '<=':
                case '>':
                case '>=': {
                    if (left === null || right === null) {
                        return false;
                    }
                    const order = compareValues(left, right);
                    return operator === '<'
                        ? order < 0
                        : operator === '<='
                          ? order <= 0
                          : operator === '>'
                            ? order > 0
                            : order >= 0;
                }
            }
            if (left === null || right === null) {
                return null;
            }
            const [a, b] = [left as number, right as number];
            switch (operator) {
                case '+':
                    return finite(a + b);
                case '-':
                    return finite(a - b);
                case '*':
                    return finite(a * b);
                default:
                    if (b === 0) {
                        throw new RowError({ id: 'divide', values: {} });
                    }
                    return finite(a / b);
            }
        }
        case 'call':
            return call(node.name, node.args, value);
    }
}

/** runs a function of the language, see FUNCTIONS */
function call(name: string, args: Node[], value: (each: Node) => FormulaValue): FormulaValue {
    switch (name) {
        case 'IF':
            return value(args[0]) === true ? value(args[1]) : value(args[2]);
        case 'ROUND': {
            const x = value(args[0]);
            const digits = args[1] ? value(args[1]) : 0;
            if (digits !== null && !isDigits(digits as number)) {
                throw new RowError({ id: 'digits', values: { part: String(digits) } });
            }
            return x === null ? null : round(x as number, (digits as number | null) ?? 0);
        }
        case 'ABS': {
            const x = value(args[0]);
            return x === null ? null : Math.abs(x as number);
        }
        case 'MIN':
        case 'MAX': {
            const values = args.map(value).filter((each) => each !== null);
            if (!values.length) {
                return null;
            }
            return values.reduce((best, each) => {
                const order = compareValues(each, best);
                return (name === 'MIN' ? order < 0 : order > 0) ? each : best;
            });
        }
        case 'TODAY': {
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        case 'DAYS': {
            const from = value(args[0]);
            const to = value(args[1]);
            return from === null || to === null ? null : dayOf(to as Date) - dayOf(from as Date);
        }
        case 'YEAR':
        case 'MONTH': {
            const date = value(args[0]) as Date | null;
            return date === null ? null : name === 'YEAR' ? date.getFullYear() : date.getMonth() + 1;
        }
        case 'CONCAT':
            return joinedText(args.map((each) => textOf(value(each))).join(''));
        case 'COALESCE': {
            for (const each of args) {
                const found = value(each);
                if (found !== null) {
                    return found;
                }
            }
            return null;
        }
        case 'LEFT':
        case 'RIGHT': {
            const chars = charactersOf(value(args[0]));
            const count = countOf(value(args[1]));
            if (count === null) {
                return null;
            }
            const kept = name === 'LEFT' ? chars.slice(0, count) : count === 0 ? [] : chars.slice(-count);
            return joinedText(kept.join(''));
        }
        case 'MID':
        case 'SUBSTRING': {
            const chars = charactersOf(value(args[0]));
            const start = countOf(value(args[1]));
            const count = countOf(value(args[2]));
            if (start === null || count === null) {
                return null;
            }
            const from = Math.max(start, 1) - 1;
            return joinedText(chars.slice(from, from + count).join(''));
        }
        case 'LEN':
            return charactersOf(value(args[0])).length;
        case 'UPPER':
            return joinedText(textOf(value(args[0])).toUpperCase());
        case 'LOWER':
            return joinedText(textOf(value(args[0])).toLowerCase());
        case 'TRIM':
            return joinedText(textOf(value(args[0])).trim());
        case 'CONTAINS': {
            const fold = (each: FormulaValue) => textOf(each).toLocaleLowerCase();
            return fold(value(args[0])).includes(fold(value(args[1])));
        }
        default:
            // ISBLANK
            return value(args[0]) === null;
    }
}

/** a value as its characters, for the functions of text: a letter of two UTF-16 units is one */
function charactersOf(value: FormulaValue): string[] {
    return Array.from(textOf(value));
}

/** a count or a position of a function of text: a whole number, 0 at least - null for a blank */
function countOf(value: FormulaValue): number | null {
    return value === null ? null : Math.max(0, Math.trunc(value as number));
}

/** true when a part calls TODAY() */
function callsToday(node: Node): boolean {
    switch (node.kind) {
        case 'negate':
        case 'not':
            return callsToday(node.arg);
        case 'binary':
            return callsToday(node.left) || callsToday(node.right);
        case 'call':
            return node.name === 'TODAY' || node.args.some(callsToday);
        default:
            return false;
    }
}

/**
 * @internal
 * A formula read and checked, not made runnable: its parts (the tree), its type and the fields it reads -
 * for the SQL of a calculated column (sql/formulaSql.ts), which writes the tree as SQL. The first problem
 * is given, as by compileFormula
 */
export function readFormula(
    text: unknown,
    typeOf: (field: string) => FieldTypeResult
): { node: Node; type: FormulaType; fields: string[]; fieldTypes: Map<string, FormulaType> } | { problem: FormulaProblem } {
    if (typeof text !== 'string' || text.trim() === '') {
        return { problem: { id: 'empty', values: {} } };
    }
    if (text.length > MAX_FORMULA_LENGTH) {
        return { problem: { id: 'length', values: { max: MAX_FORMULA_LENGTH } } };
    }
    try {
        const node = parse(tokenize(text));
        const fields: string[] = [];
        // the field types once, for every row
        const fieldTypes = new Map<string, FormulaType>();
        const type = check(
            node,
            text,
            (field) => {
                const known = typeOf(field);
                if (known && 'type' in known) {
                    fieldTypes.set(field, known.type);
                }
                return known;
            },
            fields
        );
        return { node, type, fields, fieldTypes };
    } catch (error) {
        if (error instanceof ProblemError) {
            return { problem: error.problem };
        }
        throw error;
    }
}

/**
 * @internal
 * The problem of a formula that reads a field with `clobType` (FieldConfig.clobType): a long text no
 * formula reads, as SQL compares it with LIKE only - for the `typeOf` of readFormula and compileFormula
 */
export function clobFieldProblem(field: string): { problem: FormulaProblem } {
    return { problem: { id: 'clobField', values: { field: `{${field}}` } } };
}

/**
 * Reads and checks a formula: its syntax, its fields, the types of its parts. The first problem is
 * given, or the formula to run. Never throws, never runs code: any text is read as a formula or is a
 * problem
 * @param text the formula as written: `{price} * {qty}`
 * @param typeOf what the formula knows of a field: its type, the problem of a calculated column,
 * undefined for a field the grid does not know
 */
export function compileFormula(
    text: unknown,
    typeOf: (field: string) => FieldTypeResult
): { formula: Formula } | { problem: FormulaProblem } {
    const read = readFormula(text, typeOf);
    if ('problem' in read) {
        return read;
    }
    const { node, type, fields, fieldTypes } = read;
    return {
        formula: {
            type,
            fields,
            usesToday: callsToday(node),
            evaluate(row) {
                try {
                    return { value: run(node, row, fieldTypes) };
                } catch (error) {
                    if (error instanceof RowError) {
                        return { problem: error.problem };
                    }
                    throw error;
                }
            }
        }
    };
}

/**
 * @internal
 * The text of a problem of a formula: its text of the grid with its values, the types put in as their
 * texts
 * @param text a text of the grid with its values - `gridText` in the dialog, the English defaults in
 * a `TypeError`
 */
export function formulaProblemText(
    problem: FormulaProblem,
    text: (id: string, values: Record<string, unknown>) => string
): string {
    const types = Object.fromEntries(
        Object.entries(problem.types ?? {}).map(([name, type]) => [name, text(`columnSettings.formula.type.${type}`, {})])
    );
    return text(`columnSettings.formula.problem.${problem.id}`, { ...problem.values, ...types });
}
