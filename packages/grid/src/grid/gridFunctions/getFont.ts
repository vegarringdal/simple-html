import { Grid } from '../grid';

/**
 * helper for autoresize columns
 */
export function getFont(ctx: Grid) {
    const ele = ctx?.element;
    if (ele) {
        return (
            window.getComputedStyle(ele).getPropertyValue('font-size') +
            ' ' +
            window.getComputedStyle(ele).getPropertyValue('font-family')
        );
    } else {
        return '12px Arial';
    }
}
