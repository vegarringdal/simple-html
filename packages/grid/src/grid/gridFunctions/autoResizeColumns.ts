import { Grid } from '../grid';
import { getTextWidth } from './getTextWidth';

/**
 * resizes columns
 * @param onlyResizeAttribute null = all
 */
export function autoResizeColumns(ctx: Grid, onlyResizeAttribute?: string) {
    const attributes = ctx.gridInterface.__getGridConfig().__attributes;
    const attributeKeys = onlyResizeAttribute ? [onlyResizeAttribute] : Object.keys(attributes);
    const valueFormater = ctx.gridInterface.getDatasource().getValueFormater();

    let widths: number[] = attributeKeys.map((key) => {
        const attribute = attributes[key];
        const length = attribute?.label?.length || attribute.attribute?.length;
        return length + 4;
    });

    const text: string[] = attributeKeys.map((key) => {
        const currAtt = attributes[key];
        const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[currAtt.attribute];
        const placeholderFormat = valueFormater.placeholder(cellConfig.type, currAtt.attribute, true);

        if (currAtt.type === 'date' && currAtt?.placeHolderFilter) {
            if (currAtt?.label?.length < currAtt.placeHolderFilter.length) {
                return currAtt?.label;
            }
            return currAtt?.placeHolderFilter;
        }

        if (currAtt.type === 'date' && !currAtt?.placeHolderFilter && placeholderFormat) {
            if (currAtt?.label?.length < placeholderFormat.length) {
                return currAtt?.label;
            }
            return placeholderFormat;
        }

        if (currAtt.type === 'date' && currAtt?.label?.length < 5) {
            return '19.19.2000 A';
        }
        return (currAtt?.label || currAtt.attribute) + '< > < <';
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
