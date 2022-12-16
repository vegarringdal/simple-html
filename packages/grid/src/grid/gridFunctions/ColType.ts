import {
    GROUP_COLTYPE,
    SELECTOR_COLTYPE,
    LEFT_PINNED_COLTYPE,
    MIDDLE_PINNED_COLTYPE,
    RIGH_PINNED_COLTYPE
} from './GROUP_COLTYPE';

export type ColumnCache = { column: number; left: number; refID: number };
export type ColType =
    | typeof GROUP_COLTYPE
    | typeof SELECTOR_COLTYPE
    | typeof LEFT_PINNED_COLTYPE
    | typeof MIDDLE_PINNED_COLTYPE
    | typeof RIGH_PINNED_COLTYPE;
export type RowCache = { id: string; row: number; top: number };
