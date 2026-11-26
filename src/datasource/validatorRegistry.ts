import { fillText, findText } from '../texts';
import type { Entity } from './entity';
import { isBlank } from './isBlank';
import type { ValidationRule, ValidationRuleObject, Validator } from './validator';

/**
 * @internal
 * true when a value counts as missing for the `required` rule: what {@link isBlank} counts as blank
 * (null, undefined, '', an invalid Date), and 0 - like the filter's IS_BLANK, see "0 is blank" on
 * `FilterOperator`. An emptied number cell stores 0 (the number formatters parse '' as 0), so a
 * required number field must not take it. `false` is a value, the grid's checkbox has no other way
 * to be empty. The grid's stripes on a required cell use this too
 */
export function isMissingValue(value: unknown): boolean {
    return isBlank(value) || value === 0;
}

/**
 * the regular expressions of the `pattern` rules, made once per pattern
 */
const patterns = new Map<string, RegExp>();

function patternOf(source: string): RegExp {
    let pattern = patterns.get(source);
    if (!pattern) {
        // no flags: test() keeps no state between calls
        pattern = new RegExp(source);
        patterns.set(source, pattern);
    }
    return pattern;
}

/**
 * the problem with a rule's `value` when a built-in validator needs a number, null when it is one
 */
function checkNumber(rule: ValidationRuleObject): string | null {
    return typeof rule.value === 'number' && Number.isFinite(rule.value)
        ? null
        : `takes a number as its value: { id: '${rule.id}', value: 3 }`;
}

/**
 * the start of the day of a rule's date - `'2026-11-26'`, the day in local time as a date field holds it
 * - or null when the value is no such text
 */
function dayOf(text: unknown): Date | null {
    const match = typeof text === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text) : null;
    if (!match) {
        return null;
    }
    const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
    const date = new Date(year, month, day);
    // 2026-02-31 is no day
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

/**
 * the problem with the `value` of `min` / `max`: a number, or a day as `'YYYY-MM-DD'` for a date
 */
function checkLimit(rule: ValidationRuleObject): string | null {
    return (typeof rule.value === 'number' && Number.isFinite(rule.value)) || dayOf(rule.value)
        ? null
        : `takes a number or a day ('YYYY-MM-DD') as its value: { id: '${rule.id}', value: 0 } or { id: '${rule.id}', value: '2026-01-01' }`;
}

/**
 * true when a value is past a rule's limit: a number below (min) or above (max) it, a date before the
 * day (min) or after it (max) - a datetime on the day is within. Other values pass
 */
function pastLimit(value: unknown, limit: unknown, side: 'min' | 'max'): boolean {
    if (typeof value === 'number' && typeof limit === 'number') {
        return side === 'min' ? value < limit : value > limit;
    }
    const day = value instanceof Date && !Number.isNaN(value.getTime()) ? dayOf(limit) : null;
    if (!day) {
        return false;
    }
    if (side === 'min') {
        return (value as Date) < day;
    }
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return (value as Date) >= next;
}

/** a whole number of decimals from 0 to 20, the value of `decimals` */
function checkDecimals(rule: ValidationRuleObject): string | null {
    return Number.isInteger(rule.value) && (rule.value as number) >= 0 && (rule.value as number) <= 20
        ? null
        : `takes the number of decimals, 0 to 20, as its value: { id: 'decimals', value: 2 }`;
}

/**
 * true when a number has more decimals than `decimals`: rounded to them it is another number. A
 * difference of a few units of the last place is none - 0.1 + 0.2 is 0.30000000000000004, two decimals
 */
function hasMoreDecimals(value: number, decimals: number): boolean {
    const rounded = Number(value.toFixed(decimals));
    return Math.abs(rounded - value) > 4 * Number.EPSILON * Math.max(1, Math.abs(value));
}

/** the list of `oneOf`: texts, numbers or booleans, at least one */
function checkList(rule: ValidationRuleObject): string | null {
    const list = rule.value;
    return Array.isArray(list) &&
        list.length > 0 &&
        list.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
        ? null
        : `takes a list of the values allowed as its value: { id: 'oneOf', value: ['Norway', 'Sweden'] }`;
}

/** an email address: something, @, something with a dot in it - no spaces. Not every rule of RFC 5322 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * what the registry keeps per id: the validator, and for a built-in one the check of the rule's
 * options. A validator registered under a built-in id has no check: its options are its own
 */
interface RegisteredValidator {
    validate: Validator;
    /** the problem with the rule's options, null when there is none. Run when the datasource is made */
    check?: (rule: ValidationRuleObject) => string | null;
}

/**
 * The validators by id, the built-in ones registered from the start. One registry for the page:
 * every datasource looks its ids up here. The built-ins other than `required` pass a blank value
 * (isBlank), and check only the values of their kind: numbers for min/max, text for the rest
 */
const registry = new Map<string, RegisteredValidator>([
    ['required', { validate: (value) => (isMissingValue(value) ? 'validation.required' : null) }],
    [
        'min',
        { validate: (value, _row, rule) => (pastLimit(value, rule.value, 'min') ? 'validation.min' : null), check: checkLimit }
    ],
    [
        'max',
        { validate: (value, _row, rule) => (pastLimit(value, rule.value, 'max') ? 'validation.max' : null), check: checkLimit }
    ],
    [
        'integer',
        {
            validate: (value) =>
                typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value) ? 'validation.integer' : null
        }
    ],
    [
        'decimals',
        {
            validate: (value, _row, rule) =>
                typeof value === 'number' && Number.isFinite(value) && hasMoreDecimals(value, rule.value as number)
                    ? 'validation.decimals'
                    : null,
            check: checkDecimals
        }
    ],
    [
        'oneOf',
        {
            // a blank passes, as the others; a value is compared as text: 3 is '3'
            validate: (value, _row, rule) =>
                isBlank(value) || !Array.isArray(rule.value) || rule.value.some((item) => String(item) === String(value))
                    ? null
                    : 'validation.oneOf',
            check: checkList
        }
    ],
    [
        'email',
        { validate: (value) => (typeof value === 'string' && value !== '' && !EMAIL.test(value) ? 'validation.email' : null) }
    ],
    [
        'minLength',
        {
            validate: (value, _row, rule) =>
                typeof value === 'string' && value !== '' && typeof rule.value === 'number' && value.length < rule.value
                    ? 'validation.minLength'
                    : null,
            check: checkNumber
        }
    ],
    [
        'maxLength',
        {
            validate: (value, _row, rule) =>
                typeof value === 'string' && typeof rule.value === 'number' && value.length > rule.value
                    ? 'validation.maxLength'
                    : null,
            check: checkNumber
        }
    ],
    [
        'pattern',
        {
            validate: (value, _row, rule) =>
                typeof value === 'string' && value !== '' && typeof rule.value === 'string' && !patternOf(rule.value).test(value)
                    ? 'validation.pattern'
                    : null,
            check: (rule) => {
                if (typeof rule.value !== 'string') {
                    return `takes a regular expression as text as its value: { id: 'pattern', value: '^[A-Z]{2}$' }`;
                }
                try {
                    patternOf(rule.value);
                    return null;
                } catch (error) {
                    return `has a value that is no regular expression: ${error instanceof Error ? error.message : String(error)}`;
                }
            }
        }
    ]
]);

/**
 * Registers a validator under an id, for the fields' rules to name it: a field's `validate` lists
 * rules by id (`validate: ['required', { id: 'min', value: 0 }]`), so the fields are plain JSON and
 * can be stored, e.g. in a backend. The validator itself is code: register it when the page loads,
 * before the datasource that names it is made.
 *
 * The built-in validators are registered from the start. They take their option as `value`:
 *
 * | id | the value fails when | message id |
 * | --- | --- | --- |
 * | `'required'` | it is `null`, `undefined`, `''`, an invalid Date or 0 | `'validation.required'` |
 * | `'min'` | it is a number below `value`, or a date before the day `value` (`'2026-01-01'`) | `'validation.min'` |
 * | `'max'` | it is a number above `value`, or a date after the day `value` | `'validation.max'` |
 * | `'integer'` | it is a number with decimals | `'validation.integer'` |
 * | `'decimals'` | it is a number with more decimals than `value` (0 to 20) | `'validation.decimals'` |
 * | `'oneOf'` | it is not in the list `value` (`['Norway', 'Sweden']`), compared as text | `'validation.oneOf'` |
 * | `'email'` | it is text that is no email address (something `@` something with a dot, no spaces) | `'validation.email'` |
 * | `'minLength'` | it is text shorter than `value` | `'validation.minLength'` |
 * | `'maxLength'` | it is text longer than `value` | `'validation.maxLength'` |
 * | `'pattern'` | it is text the regular expression `value` (as text) does not find | `'validation.pattern'` |
 *
 * - **0 fails `required`**, like the filter's `IS_BLANK` takes 0 as blank: an emptied number cell
 *   stores 0 (the number formatters parse `''` as 0), so a required number must not take it. `false`
 *   passes, it is a value. For a number where 0 is a real value, register a rule of your own (below).
 * - **The other built-ins pass a blank value** (`null`, `undefined`, `''`): an optional field can be
 *   empty, add `'required'` to make it fail. They check only values of their kind - `min` / `max`
 *   numbers and dates (a datetime on the day of `max` is within it), `integer` / `decimals` numbers,
 *   `oneOf` any value, the others text - and pass the rest.
 * - **`pattern` is not anchored**: `'[0-9]'` finds a digit anywhere, write `'^[0-9]+$'` for the whole
 *   text. It is a `RegExp` without flags.
 * - **The messages are texts**: the built-ins return the ids `validation.*` of {@link TEXTS}, changed
 *   with {@link setTexts}. A rule's `message` replaces what the validator returns. Either is the
 *   message itself or a text id: an id of your own gets its text from `setTexts()`, so it is translated
 *   like the built-ins' (`'validation.phoneNO'` below).
 *
 * Registering an id again replaces the validator - a built-in one too, for the fields that name
 * it (its options are not checked then, and the grid's stripes for `required` still mark what the
 * built-in takes as missing). **A datasource looks its ids up when it is made** and keeps the validators it found, like the
 * formatters. There is one registry for the page, shared by every datasource.
 *
 * @param id the name the rules use, e.g. `'phone'`. Any text but `''`
 * @param validator the function that checks a value, see {@link Validator}
 * @throws a `TypeError` when the id is not a text, or the validator is not a function
 *
 * @sample validation
 * @example
 * ```ts
 * import { Datasource, registerValidator, setTexts } from '@simple-html/grid';
 *
 * // a Norwegian phone number: 8 digits, spaces allowed. Returns a text id, its text is set below
 * registerValidator('phoneNO', (value) =>
 *     typeof value === 'string' && value !== '' && !/^(\d\s*){8}$/.test(value) ? 'validation.phoneNO' : null
 * );
 * setTexts({ 'validation.phoneNO': 'Must be 8 digits' });
 * // a number that must be there, 0 included (the built-in required takes 0 as missing)
 * registerValidator('present', (value) => (value === null || value === undefined ? 'validation.required' : null));
 *
 * // the fields name them: plain JSON, they can come from a backend
 * const datasource = new Datasource({
 *     fields: {
 *         name: { validate: ['required', { id: 'maxLength', value: 50 }] },
 *         age: { type: 'number', validate: ['required', { id: 'min', value: 0 }, { id: 'max', value: 150, message: 'too old' }] },
 *         phone: { validate: ['phoneNO'] },
 *         discount: { type: 'number', validate: ['present'] }
 *     }
 * });
 * ```
 */
export function registerValidator(id: string, validator: Validator): void {
    // plain js can pass anything: say so now, not when a value is checked
    if (typeof id !== 'string' || id === '') {
        throw new TypeError(`registerValidator: the id must be a text, got ${JSON.stringify(id)}`);
    }
    if (typeof validator !== 'function') {
        throw new TypeError(
            `registerValidator: the validator of '${id}' must be a function (value, row, rule) => message or null, got ${typeof validator}`
        );
    }
    registry.set(id, { validate: validator });
}

/**
 * @internal
 * A rule as the datasource keeps it: written out as an object, with its validator looked up
 */
export interface ResolvedRule {
    rule: ValidationRuleObject;
    validate: Validator;
}

/**
 * @internal
 * The rules of a field, written out and with their validators looked up - once, when the datasource
 * is made.
 * @param rules the field's `validate`
 * @param field the field name
 * @param where how the messages name the rules: the datasource's field, a grid's column
 * @throws when `rules` is not a list, a rule is no id or object with an id, an id is not registered,
 * the `message` is not a text, or the options of a built-in rule are wrong
 */
export function resolveRules(
    rules: readonly ValidationRule[],
    field: string,
    where = `Datasource: field '${field}'`
): ResolvedRule[] {
    // plain js and JSON can give anything: say so now, not on the first edit
    if (!Array.isArray(rules)) {
        throw new TypeError(`${where} takes a list of rules as validate, e.g. validate: ['required', { id: 'min', value: 0 }]`);
    }
    return rules.map((given: ValidationRule) => {
        const rule: ValidationRuleObject = typeof given === 'string' ? { id: given } : { ...given };
        if (typeof given !== 'string' && (typeof given !== 'object' || given === null || typeof rule.id !== 'string')) {
            throw new TypeError(`${where} has a rule that is no id or { id, ...options }: ${JSON.stringify(given)}`);
        }
        const registered = registry.get(rule.id);
        if (!registered) {
            const known = Array.from(registry.keys(), (key) => `'${key}'`).join(', ');
            throw new Error(
                `${where} has the unknown validator '${rule.id}', register it with registerValidator() before the datasource (or the grid) is made. Registered: ${known}`
            );
        }
        if (rule.message !== undefined && typeof rule.message !== 'string') {
            throw new TypeError(`${where} has the rule '${rule.id}' with a message that is not a text`);
        }
        const problem = registered.check?.(rule);
        if (problem) {
            throw new TypeError(`${where} has the rule '${rule.id}', which ${problem}`);
        }
        return { rule, validate: registered.validate };
    });
}

/**
 * @internal
 * The message for what a validator returned: the rule's own `message`, else what the validator
 * returned. Either is a text id or the message itself: the text of the id (setTexts(), else TEXTS)
 * when there is one. `{name}` is replaced by the rule's option `name` - a list as its items with `, ` -
 * a name the rule does not have is left as it is
 */
export function errorMessage(result: string, rule: ValidationRuleObject): string {
    const message = rule.message ?? result;
    // a list option is its items with a comma and a space: `Norway, Sweden`
    const options = Object.fromEntries(
        Object.entries(rule).map(([name, option]) => [name, Array.isArray(option) ? option.join(', ') : option])
    );
    return fillText(findText(message) ?? message, options);
}

/**
 * @internal
 * The messages of the rules a value fails, in the order of the rules. [] when it passes every one
 * @throws a `TypeError` when a validator returns something that is not a message or null (plain js)
 */
export function runRules(rules: readonly ResolvedRule[], value: unknown, row: Entity): string[] {
    const messages: string[] = [];
    for (const { rule, validate } of rules) {
        const result: unknown = validate(value, row, rule);
        // '' is no message either
        if (result === null || result === undefined || result === '') {
            continue;
        }
        if (typeof result !== 'string') {
            throw new TypeError(
                `the validator '${rule.id}' returned ${JSON.stringify(result)}: return null when the value is valid, else the message`
            );
        }
        messages.push(errorMessage(result, rule));
    }
    return messages;
}
