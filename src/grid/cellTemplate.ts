import type { Entity } from '../datasource/entity';
import type { Formatter } from '../datasource/formatter';

/**
 * The templates of a text column's format (`ColumnFormat`, columnFormat.ts): `text`, what its cells show
 * - `'{firstname} {lastname}'`, `'{value} kg'` - and `link.url`, the address its cells link to -
 * `'https://crm.example.com/customer/{id}'`, `'mailto:{email}'`, `'{website}'`.
 *
 * **Templates, not code.** A format is part of the state, and a state can come from storage, a backend
 * or another user: a template runs nothing. It is text with placeholders, `{field}` - the value of a
 * field of the row as text - and nothing else: no expressions, no `eval`, no `new Function`, no html.
 * What a template gives is text: the grid puts it in the page as text (lit-html escapes it, `textContent`),
 * never as html.
 *
 * - **A placeholder** is `{`, a name of one or more characters that are not braces, and `}`: `{id}`,
 *   `{first name}`. A brace that is not part of one is text: `{}`, `{a` and `}` stay as they are.
 * - **Its value** is the field's value as text, as the field's formatter writes it (its `format`):
 *   `2026-11-22` for a date, `1234.5` for a number - not a display format, not a lookup's label. A field
 *   the row does not have (not an own property of it) is empty, `''`.
 * - **`{value}`** is the cell's own value: a template that can be given to any column. A field named
 *   `value` can not be reached from another column.
 * - **A name that starts with `__`** is no placeholder of a valid template (urlTemplateProblem,
 *   templateProblem): those are the grid's own properties of a row.
 *
 * The address of a link (linkOf):
 *
 * - **It starts with its scheme, written out**: `https://`, `http://`, `mailto:` or `tel:` - or the
 *   template is one placeholder, `{website}`, a field that holds the whole address. Anything else is no
 *   valid template: `javascript:...`, `data:...`, `/customer/{id}` (relative), `{scheme}://...`.
 * - **The values are encoded** (`encodeURIComponent`): a value can not end the path, add a query or
 *   change the host - `a/b?c` is `a%2Fb%3Fc`. In a `mailto:` and a `tel:` address the `@` and the `+` of
 *   the address stay as they are (`mailto:ann@example.com`, `tel:+4712345678`): they add no header and no
 *   parameter, those need `?`, `&`, `=` and `;`, which are encoded. A value that is `.` or `..` is no
 *   link: the browser would read it as a step up the path.
 * - **A whole address from a field** is taken as it is (trimmed).
 * - **Then it is checked**: read with `new URL()` - it is an absolute address - and its scheme (after
 *   the browser's own clean up of the text: spaces, tabs and line breaks taken out, the case) is one of
 *   LINK_PROTOCOLS. The address linked to is the one `new URL()` gives (`url.href`): what was checked.
 * - **A placeholder that is empty** in a row gives no link for the row: the cell shows its text.
 */

/** a piece of a template: text as it is, or a placeholder of a field */
export type TemplatePart = { text: string } | { field: string };

/**
 * the value of a field of the row as text, `''` for none: what a placeholder is filled with
 */
export type FieldText = (field: string) => string;

/** the placeholder of the cell's own value */
export const VALUE_PLACEHOLDER = 'value';

/** the schemes a link may have, as `URL.protocol` gives them */
export const LINK_PROTOCOLS: readonly string[] = ['https:', 'http:', 'mailto:', 'tel:'];

/**
 * a placeholder: `{`, one or more characters that are not braces, `}`. Global, for matchAll
 */
const PLACEHOLDER = /\{([^{}]+)\}/g;

/**
 * the scheme at the start of an address, as RFC 3986 writes it: a letter, then letters, digits, `+`,
 * `-` and `.`, then `:`
 */
const SCHEME = /^([a-z][a-z\d+.-]*):/i;

/**
 * A template in its pieces, in order: the text between the placeholders, and the placeholders.
 * `'{name} ({id})'` is `[{ field: 'name' }, { text: ' (' }, { field: 'id' }, { text: ')' }]`
 */
export function parseTemplate(template: string): TemplatePart[] {
    const parts: TemplatePart[] = [];
    let last = 0;
    for (const match of template.matchAll(PLACEHOLDER)) {
        if (match.index > last) {
            parts.push({ text: template.slice(last, match.index) });
        }
        parts.push({ field: match[1] });
        last = match.index + match[0].length;
    }
    if (last < template.length) {
        parts.push({ text: template.slice(last) });
    }
    return parts;
}

/**
 * The fields a template names, once each, in order - `{value}` too
 */
export function templateFields(template: string): string[] {
    const fields: string[] = [];
    for (const part of parseTemplate(template)) {
        if ('field' in part && !fields.includes(part.field)) {
            fields.push(part.field);
        }
    }
    return fields;
}

/**
 * The text of a template: every placeholder replaced with the text of its field. Plain text, for the
 * grid to show as text
 */
export function fillTemplate(template: string, fieldText: FieldText): string {
    return parseTemplate(template)
        .map((part) => ('field' in part ? fieldText(part.field) : part.text))
        .join('');
}

/**
 * true for a placeholder of the grid's own properties of a row: a name that starts with `__`
 * (`__rowState`, `__controller` ...). No template may name one
 */
export function isInternalField(field: string): boolean {
    return field.startsWith('__');
}

/**
 * What is wrong with a template of the text a cell shows (`ColumnFormat.text`): a placeholder of the
 * grid's own properties. null when it is fine
 */
export function templateProblem(template: string): { problem: 'internal'; field: string } | null {
    const field = templateFields(template).find(isInternalField);
    return field === undefined ? null : { problem: 'internal', field };
}

/**
 * What is wrong with the template of an address (`ColumnFormat.link.url`), before a row fills it in:
 * - `empty` - no address, or only spaces
 * - `start` - it does not start with its scheme (`https://`, `mailto:` ...) and is not one placeholder
 *   (`{website}`): a relative address, text before the scheme, a scheme from a value
 * - `protocol` - its scheme is not one of LINK_PROTOCOLS: `javascript:`, `data:`, `ftp:` ...
 * - `internal` - a placeholder of the grid's own properties (`{__rowState}`)
 *
 * null when it is fine
 */
export type UrlTemplateProblem =
    | { problem: 'empty' }
    | { problem: 'start' }
    | { problem: 'protocol'; protocol: string }
    | { problem: 'internal'; field: string };

/**
 * see UrlTemplateProblem
 */
export function urlTemplateProblem(template: string): UrlTemplateProblem | null {
    if (template.trim() === '') {
        return { problem: 'empty' };
    }
    const internal = templateProblem(template);
    if (internal) {
        return internal;
    }
    // the whole address from a field: its scheme is checked in each row
    if (isWholeAddress(template)) {
        return null;
    }
    const protocol = schemeOf(template);
    if (protocol === null) {
        return { problem: 'start' };
    }
    return LINK_PROTOCOLS.includes(protocol) ? null : { problem: 'protocol', protocol };
}

/**
 * true for the template of an address that is one placeholder, `{website}`: the field holds the whole
 * address
 */
export function isWholeAddress(template: string): boolean {
    const parts = parseTemplate(template);
    return parts.length === 1 && 'field' in parts[0];
}

/**
 * The scheme a template starts with, written out before any placeholder, in lower case and with its
 * `:` as `URL.protocol` gives it - `'https:'`. null when it starts with no scheme
 */
function schemeOf(template: string): string | null {
    const scheme = SCHEME.exec(template);
    // a scheme is letters, digits and + - . : no brace, so a placeholder can not be part of it
    return scheme ? `${scheme[1].toLowerCase()}:` : null;
}

/**
 * The address of a row, or why the row has none:
 * - `href` - the address, as `new URL()` gives it
 * - `blank` - the field of a placeholder is empty in the row
 * - `invalid` - the template is not valid (see urlTemplateProblem), or what the row fills in is no
 *   absolute address (`new URL()` throws for it), or a value is `.` or `..`
 * - `protocol` - the address a field holds has a scheme that is not allowed: `javascript:` ...
 */
export type LinkResult =
    | { href: string }
    | { problem: 'blank'; field: string }
    | { problem: 'invalid' }
    | { problem: 'protocol'; protocol: string };

/**
 * The address of a link for a row, see the top of this file
 * @param template the address, `ColumnFormat.link.url`
 * @param fieldText the text of a field in the row
 */
export function linkOf(template: string, fieldText: FieldText): LinkResult {
    const templateError = urlTemplateProblem(template);
    if (templateError) {
        return templateError.problem === 'protocol' ? templateError : { problem: 'invalid' };
    }
    const parts = parseTemplate(template);

    // one placeholder: the field holds the whole address
    if (isWholeAddress(template) && 'field' in parts[0]) {
        const field = parts[0].field;
        const address = fieldText(field).trim();
        return address === '' ? { problem: 'blank', field } : checkedAddress(address);
    }

    // the template starts with an allowed scheme (urlTemplateProblem): the values go in encoded
    const protocol = schemeOf(template);
    let address = '';
    for (const part of parts) {
        if ('text' in part) {
            address += part.text;
            continue;
        }
        const value = fieldText(part.field);
        if (value === '') {
            return { problem: 'blank', field: part.field };
        }
        const encoded = encodeValue(value, protocol);
        if (encoded === null) {
            return { problem: 'invalid' };
        }
        address += encoded;
    }
    return checkedAddress(address);
}

/**
 * A value as it goes into an address, see the top of this file: encodeURIComponent, the `@` of a
 * mailto: and the `+` of a tel: address kept. null for what can not be put in an address: `.` and `..`,
 * and text with a lone surrogate (half of an emoji) - encodeURIComponent throws a URIError for it
 */
function encodeValue(value: string, protocol: string | null): string | null {
    if (value === '.' || value === '..') {
        return null;
    }
    let encoded: string;
    try {
        encoded = encodeURIComponent(value);
    } catch (error) {
        if (error instanceof URIError) {
            return null;
        }
        throw error;
    }
    // encodeURIComponent writes the hex digits in upper case
    if (protocol === 'mailto:') {
        return encoded.replaceAll('%40', '@');
    }
    if (protocol === 'tel:') {
        return encoded.replaceAll('%2B', '+');
    }
    return encoded;
}

/**
 * An address read with `new URL()`: absolute, of an allowed scheme. The browser's clean up is in what
 * it gives (`href`): the spaces at the ends, tabs and line breaks taken out, the scheme and host in
 * lower case, an international host as punycode - what is checked is what is linked to
 */
function checkedAddress(address: string): LinkResult {
    let url: URL;
    try {
        url = new URL(address);
    } catch (error) {
        // the URL constructor throws a TypeError for what is no absolute address
        if (error instanceof TypeError) {
            return { problem: 'invalid' };
        }
        throw error;
    }
    return LINK_PROTOCOLS.includes(url.protocol) ? { href: url.href } : { problem: 'protocol', protocol: url.protocol };
}

/**
 * The text of a field of a row for a placeholder: the field's value through its formatter - `''` for a
 * field the row does not have as its own property (also a name of the grid's own, `__...`), and for a
 * formatter of plain JavaScript that gives no text
 * @param formatterOf the field's formatter, `datasource.getFormatter`
 */
export function fieldTextOf(row: Entity, formatterOf: (field: string) => Formatter): FieldText {
    return (field) => {
        if (isInternalField(field) || !Object.hasOwn(row, field)) {
            return '';
        }
        return String(formatterOf(field).format(row[field]) ?? '');
    };
}

/**
 * The text of a placeholder in a column's template: `{value}` and the column's own field are the
 * value given (the cell's own), the other fields the row's
 * @param field the column's field
 * @param value the cell's value - its own, or another (the original value of an edited cell)
 * @param formatter the formatter of the column's field
 * @param rowText the text of the other fields, fieldTextOf
 */
export function cellFieldText(field: string, value: unknown, formatter: Formatter, rowText: FieldText): FieldText {
    return (name) => (name === VALUE_PLACEHOLDER || name === field ? String(formatter.format(value) ?? '') : rowText(name));
}

/**
 * The formatter a cell of a column with a text template (`ColumnFormat.text`) is shown with: the field's
 * formatter, its `format` the template filled in for the row - `{value}` is the value it is given -
 * and `formatForEdit` the field's (its `format` when it has none): a cell that is edited shows the value,
 * not the template. `parse`, `parseFilter` and `placeholder` stay the field's.
 * @param rowText the text of the fields of the row, fieldTextOf
 */
export function templateFormatter(fieldFormatter: Formatter, field: string, template: string, rowText: FieldText): Formatter {
    return {
        ...fieldFormatter,
        format: (value) => fillTemplate(template, cellFieldText(field, value, fieldFormatter, rowText)),
        // called on the formatter, so one that uses `this` works
        formatForEdit: (value) =>
            fieldFormatter.formatForEdit ? fieldFormatter.formatForEdit(value) : fieldFormatter.format(value)
    };
}
