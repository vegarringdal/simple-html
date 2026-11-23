/**
 * The parts of a text filter value, the one reading of it that the grid's filter (objectFilter.ts) and
 * the SQL of it (sql/buildWhere.ts) share, so both match the same rows.
 *
 * - `*` and `%` are wildcards: any text, none too
 * - `_` is a wildcard: one character, any
 * - `\` before `*`, `%`, `_` or `\` makes that character plain: `S\_\_den` is the text `S__den`,
 *   `50\%*` starts with `50%`, `a\\*` starts with `a\`
 * - a `\` before anything else, or at the end, is a plain `\`: `C:\temp` is `C:\temp`
 *
 * With `literal` (FilterCondition.literal) all of the value is plain, `\` too: it is the text as it is.
 */
export type TextPatternPart =
    /** plain text, without `*`, `%` or `_` in it */
    | { type: 'text'; text: string }
    /** `*` or `%`: any text, `_`: one character */
    | { type: 'wildcard'; wildcard: '*' | '%' | '_' }
    /** a `*`, `%` or `_` that is a plain character: escaped with `\`, or the value is `literal` */
    | { type: 'char'; char: '*' | '%' | '_' };

/** the character that makes the next `*`, `%`, `_` or `\` a plain one */
export const PATTERN_ESCAPE = '\\';

const WILDCARDS = '*%_';

/**
 * the parts of a text filter value, in order. Plain text next to each other is one part
 * @param literal FilterCondition.literal: no wildcards and no escapes, the value as it is
 * @example
 * textPatternParts('S\\_\\_den*', false);
 * // [{ type: 'text', text: 'S' }, { type: 'char', char: '_' }, { type: 'char', char: '_' },
 * //  { type: 'text', text: 'den' }, { type: 'wildcard', wildcard: '*' }]
 */
export function textPatternParts(value: string, literal = false): TextPatternPart[] {
    const parts: TextPatternPart[] = [];
    let text = '';
    const flush = () => {
        if (text) {
            parts.push({ type: 'text', text });
            text = '';
        }
    };
    for (let index = 0; index < value.length; index++) {
        const char = value[index];
        if (WILDCARDS.includes(char)) {
            flush();
            parts.push(literal ? { type: 'char', char: char as '*' } : { type: 'wildcard', wildcard: char as '*' });
            continue;
        }
        const next = value[index + 1];
        if (!literal && char === PATTERN_ESCAPE && next !== undefined && (WILDCARDS.includes(next) || next === PATTERN_ESCAPE)) {
            index++;
            if (next === PATTERN_ESCAPE) {
                text += next;
            } else {
                flush();
                parts.push({ type: 'char', char: next as '*' });
            }
            continue;
        }
        text += char;
    }
    flush();
    return parts;
}

/**
 * a text as a filter value that matches it as it is: `*`, `%`, `_` and `\` escaped with `\`.
 * For a value put into a header filter, where the user can see and change it
 * @example
 * import { escapeTextPattern } from '@simple-html/grid';
 *
 * escapeTextPattern('50% off'); // '50\\% off'
 */
export function escapeTextPattern(text: string): string {
    return text.replace(/[*%_\\]/g, '\\$&');
}
