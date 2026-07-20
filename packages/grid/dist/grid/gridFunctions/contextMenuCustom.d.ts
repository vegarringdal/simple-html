import type { Grid } from '../grid';
/**
 * ctx is part of filter editor
 * @param cell
 * @param callback
 */
export declare function contextMenuCustom(ctx: Grid, event: MouseEvent, cell: HTMLElement, callback: (attribute: string) => boolean | void, options: {
    label: string;
    value: string;
    isHeader?: boolean;
}[]): void;
//# sourceMappingURL=contextMenuCustom.d.ts.map