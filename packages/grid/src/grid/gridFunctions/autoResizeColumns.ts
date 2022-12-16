import { Grid } from '../grid';

/**
 * resizes columns
 * @param onlyResizeAttribute null = all
 */
export function autoResizeColumns(ctx: Grid, onlyResizeAttribute?: string) {
    const attributes = ctx.gridInterface.__getGridConfig().__attributes;
    const attributeKeys = onlyResizeAttribute ? [onlyResizeAttribute] : Object.keys(attributes);

    let widths: number[] = attributeKeys.map((key) => {
        const attribute = attributes[key];
        const length = attribute?.label?.length || attribute.attribute?.length;
        return length + 4;
    });

    const text: string[] = attributeKeys.map((key) => {
        const attribute = attributes[key];
        if (attribute.type === 'date' && attribute?.label?.length < 5) {
            return '19.19.2000 A';
        }
        return (attribute?.label || attribute.attribute) + '< > < <';
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
                if (widths[i] < (row[att.attribute] + '').length) {
                    widths[i] = (row[att.attribute] + '').length;
                    text[i] = row[att.attribute];
                }
            }
        });
    });

    widths = widths.map((e: number) => (e ? e * 8 : 100));

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
                            x = ctx.getTextWidth(text[attributeKeys.indexOf(rowAttribute)]) + 20;
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
