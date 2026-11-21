import type { Entity } from './entity';

/**
 * The value of an option of a {@link ValidationRuleObject}: plain JSON - text, a number, `true` /
 * `false`, `null`, or a list or an object of them. So the rules can be stored, e.g. in a backend.
 *
 * @example
 * ```ts
 * import type { ValidationOption } from '@simple-html/grid';
 *
 * const values: ValidationOption = ['Norway', 'Sweden'];
 * ```
 */
export type ValidationOption = string | number | boolean | null | ValidationOption[] | { [key: string]: ValidationOption };

/**
 * A validation rule written out: the id of its validator, its options, and a message of its own.
 * The validator gets it as its `rule` argument - a rule given as text (`'required'`) is
 * `{ id: 'required' }` there.
 *
 * The built-in validators take their option as `value` (see {@link registerValidator}). A validator
 * of your own can take any options: they are what the rule has besides `id` and `message`.
 *
 * @sample validation
 * @example
 * ```ts
 * import type { ValidationRuleObject } from '@simple-html/grid';
 *
 * const atLeastZero: ValidationRuleObject = { id: 'min', value: 0 };
 * const notTooOld: ValidationRuleObject = { id: 'max', value: 150, message: 'too old, at most {value}' };
 * ```
 */
export interface ValidationRuleObject {
    /** the id of the validator: a built-in one (`'required'`, `'min'` ...) or one registered with {@link registerValidator} */
    id: string;

    /**
     * the message when the value fails the rule, instead of the validator's: the message itself, or a
     * text id - a text set with `setTexts()`, so it can be translated. `{name}` in it is replaced by
     * the rule's option `name`: `'at most {value}'` is `'at most 150'` for `{ id: 'max', value: 150 }`
     */
    message?: string;

    /** the rule's options, plain JSON: `value` for the built-in validators */
    [option: string]: ValidationOption | undefined;
}

/**
 * A validation rule of a field, in `FieldConfig.validate`: the id of a validator as text, for a rule
 * without options (`'required'`), or a {@link ValidationRuleObject} with the options
 * (`{ id: 'min', value: 0 }`).
 *
 * @sample validation
 * @example
 * ```ts
 * import { Datasource, type ValidationRule } from '@simple-html/grid';
 *
 * const ageRules: ValidationRule[] = ['required', { id: 'min', value: 0 }, { id: 'max', value: 150, message: 'too old' }];
 * const datasource = new Datasource({ fields: { age: { type: 'number', validate: ageRules } } });
 * ```
 */
export type ValidationRule = string | ValidationRuleObject;

/**
 * Checks one value of a field: returns `null` when the value is valid (`''` counts as valid too),
 * else the error. Register it under an id with {@link registerValidator}, and name it in a field's
 * rules.
 *
 * The error is a text id - a `validation.*` id of {@link TEXTS}, like the built-ins return, or an id
 * of your own given a text with `setTexts()` - or the message itself. The rule's own `message` is used
 * instead when it has one, and `{name}` in the message is replaced by the rule's option `name`.
 *
 * - `value` - the field's value in the row
 * - `row` - the row, to compare with its other fields. Such a validator runs when its own field is
 *   edited, and on `validate()`
 * - `rule` - the rule written out, with its options: `{ id, ...options, message? }`
 *
 * A blank value (`null`, `undefined`, `''`) should pass, the way the built-ins other than
 * `required` do: an optional field can be empty, the `required` rule makes it fail. Do not use
 * `this`, keep it fast (it runs on every key the user types), and do not change the row.
 *
 * @sample validation
 * @example
 * ```ts
 * import { registerValidator, type Validator } from '@simple-html/grid';
 *
 * // { id: 'oneOf', values: ['Norway', 'Sweden'] }
 * const oneOf: Validator = (value, _row, rule) => {
 *     if (value === null || value === undefined || value === '') {
 *         return null; // an empty value is the required rule's job
 *     }
 *     return Array.isArray(rule.values) && rule.values.includes(String(value)) ? null : 'Must be one of {values}';
 * };
 * registerValidator('oneOf', oneOf);
 * ```
 */
export type Validator = (value: unknown, row: Entity, rule: ValidationRuleObject) => string | null;

/**
 * The validation errors of one field of one row, what `datasource.validate()` and `getErrors()`
 * return a list of.
 *
 * @typeParam T the type of your rows, the `T` of `Datasource<T>`
 *
 * @sample validation
 * @example
 * ```ts
 * import type { ValidationError } from '@simple-html/grid';
 *
 * const errors: ValidationError[] = datasource.validate();
 * for (const { row, field, messages } of errors) {
 *     console.log(row.__KEY, datasource.getField(field).label, messages.join(', '));
 * }
 * ```
 */
export interface ValidationError<T = unknown> {
    /** the row itself, not a copy */
    row: Entity & T;
    /** the field */
    field: string;
    /** a message per rule the value fails, in the order of the field's rules */
    messages: string[];
}
