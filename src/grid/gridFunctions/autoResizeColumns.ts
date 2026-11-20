import type { Grid } from '../grid';
import { getColumnLabel } from './getColumnLabel';
import { getTextWidth } from './getTextWidth';

/**
 * resizes columns
 * @param onlyResizeAttribute null = all
 */
export function autoResizeColumns(ctx: Grid, onlyResizeAttribute?: string) {
    const attributes = ctx.gridInterface.__getGridConfig().__attributes;
    const attributeKeys = onlyResizeAttribute ? [onlyResizeAttribute] : Object.keys(attributes);
    const datasource = ctx.gridInterface.getDatasource();

    let widths: number[] = attributeKeys.map((key) => getColumnLabel(ctx, key).length + 4);

    const text: string[] = attributeKeys.map((key) => {
        const currAtt = attributes[key];
        const { type, formatter } = datasource.getField(key);
        const isDate = type === 'date' || type === 'datetime';
        const placeholderFormat = formatter.placeholder;
        // a label that was given, on the column or the field. A missing one never counts as shorter
        const givenLabel = currAtt?.label || datasource.__getFieldConfig(key)?.label;

        if (isDate && currAtt?.placeHolderFilter) {
            if (givenLabel !== undefined && givenLabel.length < currAtt.placeHolderFilter.length) {
                return givenLabel;
            }
            return currAtt?.placeHolderFilter;
        }

        if (isDate && !currAtt?.placeHolderFilter && placeholderFormat) {
            if (givenLabel !== undefined && givenLabel.length < placeholderFormat.length) {
                return givenLabel;
            }
            return placeholderFormat;
        }

        if (isDate && givenLabel !== undefined && givenLabel.length < 5) {
            return '19.19.2000 A';
        }
        return `${getColumnLabel(ctx, key)}< > < <`;
    });

    const data = ctx.gridInterface.getDatasource().getAllData();
    data.forEach((row: any) => {
        attributeKeys.forEach((key, i) => {
            const att = attributes[key];

            if (row && typeof row[att.attribute] === 'string') {
                if (widths[i] < row[att.attribute].length) {
                    widths[i] = row[att.attribute].length;
                    text[i] = row[att.attribute];
                }
            }
            if (row && typeof row[att.attribute] === 'number') {
                if (widths[i] < `${row[att.attribute]}`.length) {
                    widths[i] = `${row[att.attribute]}`.length;
                    text[i] = row[att.attribute];
                }
            }
        });
    });

    widths = widths.map((e: number) => (e ? e * 2 : 100));

    const left = ctx.gridInterface.__getGridConfig().columnsPinnedLeft || [];
    const right = ctx.gridInterface.__getGridConfig().columnsPinnedRight || [];
    const center = ctx.gridInterface.__getGridConfig().columnsCenter || [];

    center
        .concat(left)
        .concat(right)
        .forEach((g) => {
            let x = 0;
            g?.rows.forEach((rowAttribute) => {
                if (x < 750) {
                    if (attributeKeys.indexOf(rowAttribute) !== -1) {
                        const xx = widths[attributeKeys.indexOf(rowAttribute)];
                        if (xx > x) {
                            x = getTextWidth(ctx, text[attributeKeys.indexOf(rowAttribute)]) + 15;
                        }
                    }
                }
            });
            if (x) {
                g.width = x > 750 ? 750 : x;
            }
        });

    ctx.rebuild();
}
