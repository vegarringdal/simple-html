import type { Grid } from '../grid';
import { getFont } from './getFont';

/**
 * helper for autoresize columns
 */
export function getTextWidth(ctx: Grid | null | undefined, text: string) {
    // if given, use cached canvas for better performance
    // else, create new canvas
    const canvas = document.createElement('canvas');
    // a new canvas has no other context yet, so getContext('2d') does not return null
    const context = canvas.getContext('2d')!;
    context.font = getFont(ctx);
    const metrics = context.measureText(text);
    return Math.floor(metrics.width + 5);
}
