import { type Formatter, NumberFormatterComma } from '@simple-html/grid';

/**
 * custom number formatter sample: a comma as decimal separator, always two decimals.
 * `12.5` -> `'12,50'`. Built from NumberFormatterComma, only format is replaced.
 */
export const NumberFormatterCustom: Formatter = {
    ...NumberFormatterComma,
    format(value: unknown): string {
        return typeof value === 'number' ? value.toFixed(2).replace('.', ',') : NumberFormatterComma.format(value);
    }
};
