import type { FilterArgument } from '../datasource/filterArgument';
import type { FilterComparisonOperator } from '../datasource/filterComparisonOperator';
import type { GroupArgument } from '../datasource/groupArgument';
import type { IDateConfig } from '../date/interfaces';

export type GridConfig = {
    cellHeight?: number;
    panelHeight?: number;
    /**
     * useful for when you have long header text and need to wrap in in 2-3 height
     * this will not work well with auto resize
     */
    cellHeaderLabelHeight?: number;
    footerHeight?: number;
    selectSizeHeight?: number;
    hideLabels?: boolean;
    hideFilter?: boolean;
    readonly?: boolean;
    attributes: Attribute[];
    selectionMode?: 'multiple' | 'single';
    columnsPinnedLeft?: Columns[];
    columnsCenter: Columns[];
    columnsPinnedRight?: Columns[];

    /**
     * if its a small screen you might not want this enabled
     */
    autoRemoveContextMenuOnScrollEvent?: boolean;

    /**
     * dims a cell when it repeats the value of the row above, so only the first row of a
     * run of equal values reads at full strength. Default = false.
     *
     * A cell always shows at full strength again at the start of a group, and blanks are
     * never dimmed. Can be toggled from the row context menu.
     */
    dimRepeatedValues?: boolean;

    /**
     * renders the built in tooltip on buttons/icons, default = true
     *
     * the `data-tooltip` attribute is always written to the elements, also when this is
     * false, so you can hook up your own tooltip library instead
     */
    tooltips?: boolean;

    /**
     * override the built in tooltip texts, keyed by tooltip id.
     * import `TOOLTIPS` to see the ids and their default text
     */
    tooltipText?: Record<string, string>;

    /**
     * datepicker
     * not all is passed on to intenal picker
     */
    datePickerConfig?: IDateConfig;

    /**
     * displays only placeholder on current focused cell row/current entity row
     * default = true, so you need to set this to false to display on all rows
     */
    placeHolderRowCurrentEntityOnly?: boolean;

    /**
     * sorting added when loading config, unless grouping overrides it
     */
    sorting?: Sort[] | null;
    /**
     * grouping added when loading config
     */
    grouping?: GroupArgument[] | null;
    /**
     * expandedGroups added when loading config
     */
    expandedGroups?: string[] | null;
    /**
     * filter added when loading config
     */
    filter?: FilterArgument | null;

    /**
     * @internal not exported in save config
     */
    __attributes?: Record<string, Attribute>;
    /**
     * @internal not exported in save config
     */
    __rowHeight?: number;
    /**
     * @internal not exported in save config
     */
    __rowHeaderHeight?: number;
    /**
     * @internal not exported in save config
     */
    __columnCells?: number;
    /**
     * @internal not exported in save config
     */
    __leftWidth?: number;
    /**
     * @internal not exported in save config
     */
    __rightWidth?: number;
    /**
     * @internal not exported in save config
     */
    __scrollbarSize?: number;
    /**
     * @internal not exported in save config
     */
    __selectSizeWidth?: number;
};

/**
 * @internal
 * The config as the grid works with it, after `GridInterface.__parseConfig()`: every default
 * is filled in and the internal sizes are computed, so these are never undefined.
 */
export type ParsedGridConfig = GridConfig &
    Required<
        Pick<
            GridConfig,
            | 'cellHeight'
            | 'cellHeaderLabelHeight'
            | 'panelHeight'
            | 'footerHeight'
            | 'selectSizeHeight'
            | 'readonly'
            | 'selectionMode'
            | 'tooltips'
            | 'placeHolderRowCurrentEntityOnly'
            | 'columnsPinnedLeft'
            | 'columnsPinnedRight'
            | '__attributes'
            | '__rowHeight'
            | '__rowHeaderHeight'
            | '__columnCells'
            | '__leftWidth'
            | '__rightWidth'
            | '__scrollbarSize'
            | '__selectSizeWidth'
        >
    >;

export type Sort = {
    attribute: string;
    ascending: boolean;
};

export type Grouping = keyof Attribute[];

export type Columns = {
    rows: string[];
    width: number;
};

/**
 * A column of the grid. Its type comes from the datasource (`datasource.getField(attribute).type`),
 * set it in the datasource's `fields`, not here.
 */
export type Attribute = {
    attribute: string;
    /**
     * the column's header text. Left out, the label of the datasource field (`FieldConfig.label`) is
     * used, and without that the attribute name
     */
    label?: string;
    placeHolderRow?: string;
    placeHolderFilter?: string;
    operator?: FilterComparisonOperator;
    /**
     * the name of another column whose value in the row is the type of this cell -
     * `'text' | 'number' | 'boolean' | 'date' | 'datetime'`. A number/text/date etc in the same
     * column, for property/value style data. Only for a `text` field (the default), and a value that
     * is no type leaves the cell `text`.
     * PS! sorting, grouping and filtering still use the field's own type
     */
    dynamicCellTypeColumn?: string;

    /**
     * sets cell to readonly, usefull if you need it to stay readonly if grid is not readonly
     */
    readonly?: boolean;

    /**
     * @internal
     * current filter value, this is really more of a internal state..
     */
    currentFilterValue?: string | number | boolean | Date | null;

    /**
     * like the name says, default it to display value it have recived, but you might have other needs
     */
    numberOverride?: 'ZERO_TO_BLANK' | 'BLANK_TO_ZERO';

    /**
     * like the name says, shows a focus button, you need to use the gridinterface event to do anythnig useful with it
     * like dialog, dropdown etc
     */
    focusButton?: 'SHOW_IF_GRID_NOT_READONLY' | 'SHOW_IF_GRID_AND_CELL_NOT_READONLY' | 'ALWAYS';

    /**
     * adds a blue ish color in background, highlighting cell, you can override color with css
     */
    mandatory?: boolean;

    /**
     * only show blue ish color in background if its empty
     */
    mandatoryOnlyIfEmpty?: boolean;

    /**
     * usefull for fields where you have dropdown etc, but want to allow user to update using copy/paste/clear + the dropdown
     */
    allowPasteClearOnly?: boolean;
};
