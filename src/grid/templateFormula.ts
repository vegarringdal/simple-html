import { BooleanFormatter } from '../datasource/booleanFormatter';
import { DateFormatterYYYYMMDD } from '../datasource/DateFormatterYYYYMMDD';
import type { FieldType } from '../datasource/field';
import type { Formatter } from '../datasource/formatter';
import { NumberFormatterDot } from '../datasource/numberFormatterDot';
import { TextFormatter } from '../datasource/textFormatter';
import { parseTemplate, VALUE_PLACEHOLDER } from './cellTemplate';

/**
 * A column's text template (`ColumnFormat.text`, `{first} {last}`) as a formula of the calculated columns'
 * language (formula.ts): the formula gives the text the template shows, so a backend can compare it -
 * `toSqlWhere({ shown })` writes it as SQL. `'order {value}'` on the field `order` is
 * `CONCAT("order ", {order})`.
 *
 * Only where the formula writes each field as the template does: a placeholder is its field as the
 * field's formatter writes it, a formula writes a text as it is, a number as `String()`, a date as
 * `YYYY-MM-DD`, true / false as `true` / `false` - the default formatters of text, number, date and
 * boolean fields. A field with another formatter (`numberComma`, `DDMMYYYY`, one of your own) or a
 * `datetime` field (a formula's date is its day) makes no formula: null. So does a field the grid does
 * not know.
 *
 * @param field the column's field: `{value}` is it
 * @param fieldOf the type and formatter of a field, undefined for one the grid does not know
 */
export function templateFormula(
    template: string,
    field: string,
    fieldOf: (name: string) => { type: FieldType; formatter: Formatter } | undefined
): string | null {
    const parts: string[] = [];
    for (const part of parseTemplate(template)) {
        if ('text' in part) {
            // a text of the formula: its quote doubled
            parts.push(`"${part.text.replace(/"/g, '""')}"`);
            continue;
        }
        const name = part.field === VALUE_PLACEHOLDER ? field : part.field;
        const known = fieldOf(name);
        if (!known || !writtenAsFormula(known.type, known.formatter)) {
            return null;
        }
        parts.push(`{${name}}`);
    }
    // CONCAT: text, also of one number field alone, and '' (blank) for a template of no parts
    return parts.length ? `CONCAT(${parts.join(', ')})` : null;
}

/** the formatter of a type that writes its values as a formula's text does */
const FORMULA_FORMATTERS: Partial<Record<FieldType, Formatter>> = {
    text: TextFormatter,
    number: NumberFormatterDot,
    date: DateFormatterYYYYMMDD,
    boolean: BooleanFormatter
};

function writtenAsFormula(type: FieldType, formatter: Formatter): boolean {
    return FORMULA_FORMATTERS[type] === formatter;
}
