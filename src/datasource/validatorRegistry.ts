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
        {
            validate: (value, _row, rule) =>
                typeof value === 'number' && typeof rule.value === 'number' && value < rule.value ? 'validation.min' : null,
            check: checkNumber
        }
    ],
    [
        'max',
        {
            validate: (value, _row, rule) =>
                typeof value === 'number' && typeof rule.value === 'number' && value > rule.value ? 'validation.max' : null,
            check: checkNumber
        }
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
 * | `'min'` | it is a number below `value` | `'validation.min'` |
 * | `'max'` | it is a number above `value` | `'validation.max'` |
 * | `'minLength'` | it is text shorter than `value` | `'validation.minLength'` |
 * | `'maxLength'` | it is text longer than `value` | `'validation.maxLength'` |
 * | `'pattern'` | it is text the regular expression `value` (as text) does not find | `'validation.pattern'` |
 *
 * - **0 fails `required`**, like the filter's `IS_BLANK` takes 0 as blank: an emptied number cell
 *   stores 0 (the number formatters parse `''` as 0), so a required number must not take it. `false`
 *   passes, it is a value. For a number where 0 is a real value, register a rule of your own (below).
 * - **The other built-ins pass a blank value** (`null`, `undefined`, `''`): an optional field can be
 *   empty, add `'required'` to make it fail. They check only values of their kind - `min` / `max`
 *   numbers, the others text - and pass the rest.
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
 * @param field the field name, for the messages
 * @throws when `rules` is not a list, a rule is no id or object with an id, an id is not registered,
 * the `message` is not a text, or the options of a built-in rule are wrong
 */
export function resolveRules(rules: readonly ValidationRule[], field: string): ResolvedRule[] {
    // plain js and JSON can give anything: say so now, not on the first edit
    if (!Array.isArray(rules)) {
        throw new TypeError(
            `Datasource: field '${field}' takes a list of rules as validate, e.g. validate: ['required', { id: 'min', value: 0 }]`
        );
    }
    return rules.map((given: ValidationRule) => {
        const rule: ValidationRuleObject = typeof given === 'string' ? { id: given } : { ...given };
        if (typeof given !== 'string' && (typeof given !== 'object' || given === null || typeof rule.id !== 'string')) {
            throw new TypeError(
                `Datasource: field '${field}' has a rule that is no id or { id, ...options }: ${JSON.stringify(given)}`
            );
        }
        const registered = registry.get(rule.id);
        if (!registered) {
            const known = Array.from(registry.keys(), (key) => `'${key}'`).join(', ');
            throw new Error(
                `Datasource: field '${field}' has the unknown validator '${rule.id}', register it with registerValidator() before the datasource is made. Registered: ${known}`
            );
        }
        if (rule.message !== undefined && typeof rule.message !== 'string') {
            throw new TypeError(`Datasource: field '${field}' has the rule '${rule.id}' with a message that is not a text`);
        }
        const problem = registered.check?.(rule);
        if (problem) {
            throw new TypeError(`Datasource: field '${field}' has the rule '${rule.id}', which ${problem}`);
        }
        return { rule, validate: registered.validate };
    });
}

/**
 * @internal
 * The message for what a validator returned: the rule's own `message`, else what the validator
 * returned. Either is a text id or the message itself: the text of the id (setTexts(), else TEXTS)
 * when there is one. `{name}` is replaced by the rule's option `name`, a name the rule does not have
 * is left as it is
 */
export function errorMessage(result: string, rule: ValidationRuleObject): string {
    const message = rule.message ?? result;
    return fillText(findText(message) ?? message, rule);
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
