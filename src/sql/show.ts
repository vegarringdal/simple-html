/**
 * @internal
 * A value for an error message of toSqlWhere: as JSON, cut to 40 characters. A message never echoes a
 * large input back, nor fails on one (a BigInt, an object that refers to itself).
 */
export function show(value: unknown): string {
    let text: string;
    if (value instanceof Date) {
        text = Number.isNaN(value.getTime()) ? 'an invalid Date' : `Date(${value.toISOString()})`;
    } else {
        try {
            text = JSON.stringify(value) ?? String(value);
        } catch {
            text = Object.prototype.toString.call(value);
        }
    }
    return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}
