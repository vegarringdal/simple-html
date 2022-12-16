import { Grid } from '../grid';
import { getFont } from './getFont';

/**
 * helper for autoresize columns
 */
export function getTextWidth(ctx: Grid, text: string) {
    // if given, use cached canvas for better performance
    // else, create new canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = getFont(ctx);
    const metrics = context.measureText(text);
    return Math.floor(metrics.width + 5);
}
