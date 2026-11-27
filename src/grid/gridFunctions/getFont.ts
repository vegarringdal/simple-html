import type { Grid } from '../grid';

/**
 * helper for autoresize columns
 */
export function getFont(ctx: Grid | null | undefined) {
    const ele = ctx?.element;
    // the grid knows its element before it is in the dom (connectInterface first): the css only
    // applies once it is, so until then the fixed font below. attach() measures again after
    if (ele?.isConnected) {
        return (
            window.getComputedStyle(ele).getPropertyValue('font-size') +
            ' ' +
            window.getComputedStyle(ele).getPropertyValue('font-family')
        );
    } else {
        return '12px Arial';
    }
}
