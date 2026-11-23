/**
 * A user's code, compiled against the published typings in dist only: `npm run check:typings`.
 *
 * The build strips members tagged @internal from the .d.ts files. If a public signature still uses
 * a stripped type, the typings are broken for users while the library itself still compiles -
 * this file (with skipLibCheck: false, so every .d.ts is checked) is what catches that.
 * Add to it when the public API grows.
 */

import { type SqlOptions, type SqlWhere, toSqlWhere } from '@simple-html/grid/sql';
import {
    and,
    type CalculatedColumn,
    type CalculatedType,
    type CellClass,
    type CellRange,
    type CellRenderContext,
    type CellRenderer,
    type CellRendererInstance,
    type Changes,
    type CheckboxFormat,
    type ColorRule,
    type ColumnConfig,
    type ColumnEditor,
    type ColumnFormat,
    type CreateGridOptions,
    type CsvOptions,
    type CsvSeparator,
    createGrid,
    DATE_PRESETS,
    DataContainer,
    Datasource,
    type DatasourceEvents,
    type DatasourceOptions,
    type DateEvents,
    type DateFormat,
    DateFormatterYYYYMMDD,
    DateInterface,
    type DatePreset,
    type DetailForm,
    type EditPermissions,
    type Entity,
    type EventHandler,
    type ExcelOptions,
    type Field,
    type FieldConfig,
    type FieldType,
    type FilterCondition,
    type FilterExpression,
    type FilterGroup,
    type FilterOperator,
    type Formatter,
    type GridCellEventData,
    type GridConfig,
    type GridElement,
    type GridEvents,
    type GridHooks,
    GridInterface,
    type GridLayout,
    type GridMenus,
    type GridState,
    type GroupArgument,
    type GroupRow,
    type HeaderFilter,
    type HTMLCellElement,
    type IDateConfig,
    isGroupRow,
    type LayoutColumn,
    type LinkFormat,
    type Lookup,
    type LookupFromDatasource,
    type LookupFromGridInterface,
    MENU_IDS,
    type MenuBlock,
    type MenuContext,
    type MenuEntry,
    type MenuItem,
    type MenuPosition,
    type MenuSection,
    type MenuSeparator,
    type MenuSubmenu,
    type ModifiedEntity,
    type NumberFormat,
    NumberFormatterComma,
    NumberFormatterDot,
    or,
    type PaletteColor,
    type RuleColor,
    type RuleCondition,
    registerCellRenderer,
    registerFormatter,
    registerLookup,
    registerValidator,
    type SortArgument,
    setTexts,
    TEXTS,
    TextFormatter,
    type TextId,
    type Texts,
    type ValidationError,
    type ValidationOption,
    type ValidationRule,
    type ValidationRuleObject,
    type Validator,
    where
} from '../../dist/index';

// a formatter of your own: format (value -> text) and parse (typed text -> value)
const money: Formatter = {
    format: (value) => (typeof value === 'number' ? value.toFixed(2) : ''),
    parse: (text) => (text.trim() === '' ? null : Number(text)),
    placeholder: '0.00'
};
// the built-ins are plain objects, a variant is a spread away
const upperCase: Formatter = { ...TextFormatter, format: (value) => TextFormatter.format(value).toUpperCase() };
// the options name a formatter by its id: register it, a built-in object too under an id of your own
registerFormatter('money', money);
registerFormatter('upperCase', upperCase);
registerFormatter('comma', NumberFormatterComma);
const ageConfig: FieldConfig = { type: 'number', label: 'Age' };
const options: DatasourceOptions = {
    key: 'id',
    fields: {
        born: 'date',
        lastLogin: 'datetime',
        age: ageConfig,
        price: { type: 'number', formatter: 'money' },
        name: { formatter: 'upperCase' },
        amount: { type: 'number', formatter: 'comma' }
    },
    // the built-ins are registered from the start
    formatters: { date: 'dateDDMMYYYY', number: 'numberComma', boolean: 'boolean', datetime: 'datetimeDDMMYYYY' },
    selectionMode: 'multiple'
};
// @ts-expect-error a field names its formatter by id, register the object with registerFormatter()
const formatterObject: FieldConfig = { type: 'number', formatter: NumberFormatterComma };
// @ts-expect-error the default of a type is an id too
const formatterObjects: DatasourceOptions = { formatters: { number: NumberFormatterComma } };
// @ts-expect-error registerFormatter takes a formatter, format and parse
registerFormatter('nothing', { format: () => '' });
console.log(formatterObject, formatterObjects);
const datasource = new Datasource(options);
datasource.setData([{ id: 1, name: 'a', born: new Date() }]);
// getField() and getFormatter() give the formatter object
const born: Field = datasource.getField('born');
const bornFormatter: Formatter = born.formatter;
console.log(bornFormatter);
const bornType: FieldType = born.type;
const label: string = born.label;
const text: string = datasource.getFormatter('price').format(12.5);
const parsed: unknown = datasource.getFormatter('value', 'number').parse('12,5');
const filterValue: unknown = born.formatter.parseFilter?.('2026-11-20');
const placeholder: string | undefined = born.formatter.placeholder;
console.log(bornType, label, text, parsed, filterValue, placeholder);
// the built-ins take more than text when called directly: a Date passes through
const passed: Date | '' | null | undefined = DateFormatterYYYYMMDD.parse(new Date());
const number: number | null = NumberFormatterDot.parse('12.5');
console.log(passed, number);
// the data container, to share rows between datasources
const container = new DataContainer('id');
const shared = new Datasource({ container });
const containerKey: string | undefined = shared.getDataContainer().getKeyAttribute();
console.log(containerKey, new Datasource());
// @ts-expect-error v5 constructor: the container goes in the options now
new Datasource(container);
// @ts-expect-error the formatter setters are gone, set formatters in the options
datasource.setDateFormatter(DateFormatterYYYYMMDD);
// @ts-expect-error not a field type
const wrongType: FieldType = 'bool';
console.log(wrongType);
datasource.setLocaleCompare('nb');
datasource.deselectAll();
datasource.resetSort('name');

// options objects, no positional booleans
datasource.setData([{ id: 2, name: 'b' }], { add: true });
datasource.setData([{ id: 3, name: 'c' }], { add: true, refilter: true });
datasource.sort({ attribute: 'name', ascending: true }, { add: true });
datasource.setOrderBy({ attribute: 'name', ascending: true }, { add: false });
datasource.group([{ attribute: 'name', title: 'Name' }], { add: true });
datasource.select(1, { notify: true });
datasource.deselectAll({ notify: true });
datasource.addNewEmpty({ name: 'new' }, { scrollTo: false });
datasource.addNewEmpty();
datasource.markForDeletion(datasource.getSelectedRows());
datasource.markAllForDeletion();
const removedRows: Entity[] = datasource.removeData(datasource.getSelectedRows(), { refilter: false });
const removedAll: Entity[] = datasource.removeAllData();
console.log(removedRows, removedAll);
const containerRows: Entity[] = container.setData([{ id: 4 }], { add: true, isNew: true });
container.markForDeletion(containerRows);
container.markAllForDeletion();
console.log(container.removeData(containerRows), container.removeAllData());
// @ts-expect-error v5 positional add: setData(rows, { add: true })
datasource.setData([], true);
// @ts-expect-error v5 positional add, reRunFilter: setData(rows, { add, refilter })
datasource.setData([], false, true);
// @ts-expect-error v5 positional add: sort(args, { add: true })
datasource.sort({ attribute: 'name', ascending: true }, true);
// @ts-expect-error v5 positional add: setOrderBy(args, { add: true })
datasource.setOrderBy({ attribute: 'name', ascending: true }, true);
// @ts-expect-error v5 positional add: group(groups, { add: true })
datasource.group([], true);
// @ts-expect-error v5 positional triggerSelect: select(row, { notify: true })
datasource.select(1, true);
// @ts-expect-error v5 positional triggerEvent: deselectAll({ notify: true })
datasource.deselectAll(true);
// @ts-expect-error v5 positional scrollto: addNewEmpty(row, { scrollTo: false })
datasource.addNewEmpty({}, false);
// @ts-expect-error v5 all flag: markAllForDeletion()
datasource.markForDeletion(null, true);
// @ts-expect-error v5 all flag: removeAllData()
datasource.removeData(null, true);
// @ts-expect-error v5 positional rerunFilters: removeData(rows, { refilter: false })
datasource.removeData([], false, false);
// @ts-expect-error v5 positional add, tagAsNew: setData(rows, { add, isNew })
container.setData([], true, true);
// @ts-expect-error v5 all flag: markAllForDeletion()
container.markForDeletion(null, true);
// @ts-expect-error v5 all flag: removeAllData()
container.removeData(null, true);

// filters: a condition or a group of them, built with where / and / or or written out
const adult: FilterCondition = where('age', 'GREATER_THAN_OR_EQUAL_TO', 18);
const blankEmail: FilterCondition = where('email', 'IS_BLANK');
const nordic: FilterGroup = or(where('country', 'EQUAL', 'Norway'), where('country', 'EQUAL', 'Sweden'));
const operator: FilterOperator = 'NOT_IN';
const written: FilterExpression = {
    group: 'AND',
    children: [adult, { field: 'country', operator, value: ['Denmark'] }, { group: 'OR', children: [nordic, blankEmail] }]
};
datasource.filter(and(adult, nordic));
datasource.filter(written);
// a single condition at the root, and one that compares with another field of the row
datasource.filter(adult);
datasource.setFilter({ field: 'lastLogin', operator: 'GREATER_THAN', valueField: 'born' });
datasource.filter();
datasource.filter(null);
const filter: FilterExpression | null = datasource.getFilter();
if (filter) {
    datasource.filter(filter);
}
// @ts-expect-error the v5 FilterArgument shape is gone: field, not attribute
datasource.filter({ attribute: 'age', operator: 'EQUAL', value: 1 });
// @ts-expect-error no attributeType, the type comes from the datasource's fields
datasource.filter({ field: 'age', operator: 'EQUAL', value: 1, attributeType: 'number' });
// @ts-expect-error no valueType, compare with another field with valueField
datasource.filter({ field: 'age', operator: 'EQUAL', value: 'born', valueType: 'ATTRIBUTE' });
// @ts-expect-error a group is { group, children }, not logicalOperator / filterArguments
datasource.filter({ logicalOperator: 'AND', filterArguments: [adult] });
// @ts-expect-error the array form of filter() is gone, use and()
datasource.filter([adult]);
// @ts-expect-error a condition needs an operator
const noOperator: FilterCondition = { field: 'age' };
// @ts-expect-error not an operator
where('age', 'GREATER', 18);
console.log(noOperator);

// the options of a column by field name, and the layout referencing the fields
const nameColumn: ColumnConfig = { label: 'Name', operator: 'CONTAINS', placeholderFilter: 'search', placeholderRow: 'name' };
const stacked: LayoutColumn = { fields: ['born', 'lastLogin'], width: 120 };
const layout: GridLayout = { left: [{ fields: ['name'], width: 100 }], center: [stacked] };
const config: GridConfig = {
    // the type of a column comes from the datasource, the column label falls back to the field's.
    // born has no entry: a field in the layout without one gets the defaults
    columns: { name: nameColumn },
    layout,
    placeholderRowCurrentEntityOnly: true,
    // the state the grid starts in, and resetState() goes back to
    initialState: {
        sorting: [{ attribute: 'name', ascending: true }],
        filter: and(adult, where('name', 'BEGIN_WITH', 'a')),
        headerFilters: { name: { value: 'a', operator: 'BEGIN_WITH' } }
    }
};
const onlyLayout: GridConfig = { layout: { center: [{ fields: ['name'], width: 100 }] } };
console.log(onlyLayout);
// @ts-expect-error the type is not on the column any more, it is in the datasource fields
const typedColumn: ColumnConfig = { type: 'date' };
// @ts-expect-error a column has no attribute, the key in columns is the field
const keyedColumn: ColumnConfig = { attribute: 'born' };
// @ts-expect-error the header filter value is state: GridState.headerFilters
const filterValueColumn: ColumnConfig = { currentFilterValue: 'a' };
// @ts-expect-error v5 casing: placeholderFilter
const v5Placeholder: ColumnConfig = { placeHolderFilter: 'search' };
console.log(typedColumn, keyedColumn, filterValueColumn, v5Placeholder);
// @ts-expect-error attributes is gone: columns, keyed by field
const withAttributes: GridConfig = { layout, attributes: [{ attribute: 'name' }] };
// @ts-expect-error columnsCenter is gone: layout.center
const withColumnsCenter: GridConfig = { columnsCenter: [{ rows: ['name'], width: 100 }] };
// @ts-expect-error a layout column has fields, not rows
const withRows: LayoutColumn = { rows: ['name'], width: 100 };
// @ts-expect-error sorting is state, it goes in initialState
const withSorting: GridConfig = { layout, sorting: [] };
// @ts-expect-error the datasource owns the selection mode: new Datasource({ selectionMode })
const withSelectionMode: GridConfig = { layout, selectionMode: 'single' };
// @ts-expect-error mandatoryOnlyIfEmpty is gone
const onlyIfEmpty: ColumnConfig = { mandatoryOnlyIfEmpty: true };
// @ts-expect-error mandatory is gone: the required rule of the datasource field, validate: ['required']
const mandatoryColumn: ColumnConfig = { mandatory: true };
console.log(mandatoryColumn);
// the date picker takes only the fields to change, the rest are defaults
const weeksFromSunday: GridConfig = { layout, datePickerConfig: { weekStart: 0, isoWeek: false } };
console.log(withAttributes, withColumnsCenter, withRows, withSorting, withSelectionMode, onlyIfEmpty, weeksFromSunday);
const headerOperator: FilterOperator | undefined = config.columns?.name?.operator;
console.log(headerOperator);
// the filter as text, with your own labels
const filterText: string = datasource.getFilterString((field) => field.toUpperCase());
console.log(filterText, datasource.getFilterTree()?.children);
const gridInterface = new GridInterface(config, datasource);

// one call: the element, sized to fill the host, connected and added to it
const host = document.createElement('div');
const createOptions: CreateGridOptions<unknown> = { config, datasource };
const created: GridInterface<unknown> = createGrid(host, createOptions);
// the functions are hooks, next to the config. They only get data rows - never a group row
const negative: CellClass = { input: 'negative-text', background: 'negative-background' };
const hooks: GridHooks = {
    isReadonly: (row: Entity, field: string, readonlyByConfig: boolean) =>
        field === 'name' ? row.__rowState === 'D' : readonlyByConfig,
    cellClass: (row, field) => (field === 'price' && row.price < 0 ? negative : null)
};
const withHooks: GridInterface<unknown> = createGrid(host, { config, datasource, hooks });
const withHooksByHand = new GridInterface(config, datasource, hooks);
withHooks.updateHooks({ isReadonly: () => null, cellClass: () => undefined });
withHooks.updateHooks({ isReadonly: undefined, cellClass: () => ({ input: 'only-input' }) });
withHooksByHand.updateHooks({});
// @ts-expect-error isReadonly is a hook, not part of the config
const readonlyInConfig: GridConfig = { layout, isReadonly: () => null };
// @ts-expect-error cellClass is a hook, not part of the config
const cellClassInConfig: GridConfig = { layout, cellClass: () => null };
// @ts-expect-error menus is a hook, not part of the config
const menusInConfig: GridConfig = { layout, menus: {} };
// @ts-expect-error updateConfig() takes no hooks: updateHooks()
withHooks.updateConfig({ cellClass: undefined });
console.log(readonlyInConfig, cellClassInConfig, menusInConfig);
// options while the grid is shown, the layout now, the initial state for a later resetState()
created.updateConfig({ readonly: false, hideLabels: true, hideFilter: true, cellHeight: 30, tooltips: false });
created.updateConfig({ columns: { name: nameColumn }, layout: { center: [stacked] }, initialState: { sorting: [] } });
created.refresh();
created.rebuild();
created.autoResizeColumns();
// the sizes: columns fitted to their content or to cells, rows to their multiline cells, and back
created.fitColumns();
created.fitColumns(['name'], { rows: created.getDatasource().getDataRows().slice(0, 1) });
created.resetColumnWidths(['name']);
created.resetColumnWidths();
created.fitRows();
created.fitRows(created.getDatasource().getDataRows());
created.resetRowHeights(created.getDatasource().getDataRows()[0]);
created.resetRowHeights();
// @ts-expect-error the fields are a list
created.fitColumns('name');
created.updateConfig({ multilineTooltipLines: 10 });
created.updateConfig({ cellHeight: 28, multilineLineHeight: 18 });
created.openFilterEditor();
const layoutFields: string[] = created.getLayoutFields();
const selectedFields: string[] = created.getLayoutFields({ selectedOnly: true });
const hiddenFields: string[] = created.getHiddenFields();
console.log(layoutFields, selectedFields, hiddenFields);
// export: the text, or a file. The options are plain JSON
const separator: CsvSeparator = ';';
const csvOptions: CsvOptions = {
    rows: 'selected',
    fields: ['name', 'born'],
    header: true,
    formatted: false,
    separator,
    bom: true,
    escapeFormulas: false
};
const csvText: string = created.getCsv();
const selectedCsv: string = created.getCsv(csvOptions);
created.downloadCsv();
created.downloadCsv('selected.csv', { rows: 'selected', separator: ';' });
console.log(csvText, selectedCsv);
// the cells of the selected range
const rangeCsv: string = created.getCsv({ rows: 'range' });
// @ts-expect-error rows is 'all', 'selected' or 'range'
created.getCsv({ rows: 'some' });
// the ranges of cells: plain JSON, field names and displayed rows
const cellRange: CellRange = { fromRow: 0, fromField: 'name', toRow: 2, toField: 'born' };
created.setRanges([cellRange]);
const ranges: CellRange[] = created.getRanges();
created.clearRanges();
const offRanges: () => void = created.on('range-change', (data) => console.log(data.ranges.length));
offRanges();
// the columns selected with the column numbers: 1 based, across the pinned sections
created.selectColumns([1, 2]);
const selectedColumns: number[] = created.getSelectedColumns();
const offColumns: () => void = created.on('column-selection-change', (data) => {
    const columns: number[] = data.columns;
    const columnFields: string[] = data.fields;
    console.log(columns, columnFields);
});
offColumns();
// @ts-expect-error the columns are numbers, not fields: getLayoutFields({ selectedOnly: true }) gives those
created.selectColumns(['name']);
console.log(selectedColumns);
// @ts-expect-error a range has its rows and fields, not cells
created.setRanges([{ from: 0, to: 2 }]);
console.log(rangeCsv, ranges);
// @ts-expect-error the separators are ',', ';' and '\t'
const pipe: CsvOptions = { separator: '|' };
// @ts-expect-error the filename comes first: downloadCsv('export.csv', { rows: 'selected' })
created.downloadCsv({ rows: 'selected' });
console.log(pipe);
// Excel: a Blob, or a file. Async, the options are plain JSON
const excelOptions: ExcelOptions = { rows: 'selected', fields: ['name', 'born'], sheetName: 'People' };
const excelFile: Promise<Blob> = created.getExcel();
const selectedExcel: Promise<Blob> = created.getExcel(excelOptions);
const downloaded: Promise<void> = created.downloadExcel();
created.downloadExcel('selected.xlsx', { rows: 'selected' });
created.downloadExcel('range.xlsx', { rows: 'range' });
console.log(excelFile, selectedExcel, downloaded);
// @ts-expect-error the header row is always there: no header option
created.getExcel({ header: false });
// @ts-expect-error the CSV options are not Excel's
const formattedExcel: ExcelOptions = { formatted: false };
// @ts-expect-error the filename comes first: downloadExcel('export.xlsx', { rows: 'selected' })
created.downloadExcel({ rows: 'selected' });
console.log(formattedExcel);
created.destroy();
withHooks.destroy();
// @ts-expect-error readonlySetter is gone: the isReadonly hook
gridInterface.readonlySetter(null);
// @ts-expect-error cellAppendClassSetter is gone: the cellClass hook
gridInterface.cellAppendClassSetter(null);
// @ts-expect-error triggerScrollEvent is refresh()
gridInterface.triggerScrollEvent();
// @ts-expect-error triggerRebuild is rebuild()
gridInterface.triggerRebuild();
// @ts-expect-error getAttributeColumns is getLayoutFields({ selectedOnly })
gridInterface.getAttributeColumns(false);
// @ts-expect-error getOptionalAttributes is getHiddenFields()
gridInterface.getOptionalAttributes();
// @ts-expect-error no positional boolean: getLayoutFields({ selectedOnly: true })
gridInterface.getLayoutFields(true);
// menus as data: the menus hook changes the grid's own menus, openMenu() opens one of your own
const logRow: MenuItem = {
    id: 'my.logRow',
    label: 'Log row',
    hint: 'console',
    action: (context: MenuContext) => {
        const menu: 'row' | 'header' | 'filter' | 'column' | 'custom' = context.menu;
        const field: string = context.field;
        const index: number = context.rowIndex;
        const cell: HTMLElement | undefined = context.cell;
        const grid: GridInterface<unknown> = context.gridInterface;
        const rows: Entity[] = context.datasource.getDataRows();
        if (context.row && !isGroupRow(context.row)) {
            const row: Entity = context.row;
            console.log(row.name);
        }
        console.log(menu, field, index, cell, grid, rows);
    },
    visible: (context) => context.field !== '',
    disabled: (context) => context.datasource.getSelectedRows().length === 0,
    selected: () => false
};
const mySection: MenuSection = { type: 'section', id: 'my.section', label: 'Mine:' };
const mySeparator: MenuSeparator = { type: 'separator', id: 'my.separator', visible: () => true };
const myBlock: MenuBlock = { type: 'block', id: 'my.block', element: document.createElement('div') };
const mySubmenu: MenuSubmenu = {
    type: 'submenu',
    id: 'my.more',
    label: 'More',
    entries: [logRow, mySeparator],
    visible: () => true
};
const menus: GridMenus = {
    row: (defaults, context) => [
        // an entry of a submenu: changed in the submenu's entries
        ...defaults.map((entry) =>
            entry.type === 'submenu' && entry.id === 'row.copy'
                ? { ...entry, entries: entry.entries.filter((inner) => inner.id !== 'row.copy.cell') }
                : entry
        ),
        mySection,
        logRow,
        mySubmenu,
        context.row ? mySeparator : myBlock
    ],
    header: (defaults) =>
        defaults.map((entry) => (entry.id === 'header.column.hide' ? { ...entry, label: 'Hide column' } : entry)),
    filter: (defaults) => [...defaults.filter((entry) => entry.id === 'filter.values'), ...defaults],
    // the menu of a column number: without the copies of the selected columns
    column: (defaults) => defaults.filter((entry) => !entry.id.startsWith('column.copy.selected'))
};
const withMenus: GridHooks = { menus };
gridInterface.updateHooks({ menus: { row: (defaults) => defaults.slice(1) } });
gridInterface.updateHooks({ menus: undefined });
const builtInRowIds: readonly string[] = MENU_IDS.row;
console.log(withMenus, builtInRowIds, MENU_IDS.header[0], MENU_IDS.filter.includes('filter.values'), MENU_IDS.column[0]);
const pickEntries: MenuEntry[] = [mySection, { id: 'pick.a', label: 'A', action: () => {} }, mySeparator, myBlock, mySubmenu];
const position: MenuPosition = { x: 10, y: 20 };
gridInterface.openMenu(new MouseEvent('click'), pickEntries);
gridInterface.openMenu(position, pickEntries);
gridInterface.openMenu(document.createElement('div'), [
    { type: 'block', id: 'dropdown', element: document.createElement('simple-html-grid') }
]);
gridInterface.closeMenu();
// @ts-expect-error an item needs an action
const noAction: MenuItem = { id: 'a', label: 'a' };
// @ts-expect-error a section has no action
const sectionWithAction: MenuSection = { type: 'section', id: 'a', label: 'a', action: () => {} };
// @ts-expect-error every entry has an id
const noId: MenuEntry = { label: 'a', action: () => {} };
console.log(noAction, sectionWithAction, noId);
// @ts-expect-error contextMenuCustom is gone: openMenu()
gridInterface.contextMenuCustom(new MouseEvent('click'), [], document.createElement('div'), () => {});
// @ts-expect-error getContextMenuElement is gone: openMenu() with a block, closeMenu()
gridInterface.getContextMenuElement();
// @ts-expect-error setContextMenuElement is gone: openMenu() with a block
gridInterface.setContextMenuElement(document.createElement('div'));
// @ts-expect-error removeContextMenuElement is gone: closeMenu()
gridInterface.removeContextMenuElement();
// @ts-expect-error the v5 names: input and background
const v5Classes: CellClass = { inputClass: 'a', dimmedClass: 'b' };
// @ts-expect-error isReadonly returns a boolean, null or undefined
const wrongReadonly: GridHooks = { isReadonly: () => 'yes' };
console.log(v5Classes, wrongReadonly);
// events: on() types the payload from the event map, and returns the unsubscribe function
const offCellClick: () => void = gridInterface.on('cell-click', (data) => {
    const cell: HTMLCellElement = data.cell;
    const row: Entity = data.rowData;
    const click: MouseEvent = data.originalEvent;
    console.log(cell, row, click, data.attribute.toUpperCase());
});
offCellClick();
gridInterface.on('filter-operator-change', (data) => {
    const field: string = data.field;
    const picked: FilterOperator = data.operator;
    data.column.placeholderFilter = `${field} ${picked}`;
    data.rebuildHeader();
});
// the state: what the user changed. getState() returns a copy
const state: GridState = gridInterface.getState();
const center: LayoutColumn[] = state.layout.center;
const pinnedLeft: LayoutColumn[] | undefined = state.layout.left;
const sorting: SortArgument[] = state.sorting;
const grouping: GroupArgument[] = state.grouping;
const expanded: string[] = state.expandedGroups;
const stateFilter: FilterExpression | null = state.filter;
const nameFilter: HeaderFilter | undefined = state.headerFilters.name;
const nameFilterValue: unknown = nameFilter?.value;
const nameFilterOperator: FilterOperator | undefined = nameFilter?.operator;
console.log(center, pinnedLeft, sorting, grouping, expanded, stateFilter, nameFilterValue, nameFilterOperator);
gridInterface.setState(state);
// a partial state: the rest is kept
gridInterface.setState({ sorting: [{ attribute: 'name', ascending: false }] });
gridInterface.setState({ filter: null, headerFilters: {} });
const savedState: Partial<GridState> = JSON.parse('{}');
gridInterface.setState(savedState);
gridInterface.resetState();
// @ts-expect-error saveConfig is gone: getState()
gridInterface.saveConfig();
// @ts-expect-error loadConfig is gone: setState()
gridInterface.loadConfig(config);
// @ts-expect-error loadInitConfig is gone: resetState()
gridInterface.loadInitConfig();
// @ts-expect-error updateInitConfig is gone: GridConfig.initialState
gridInterface.updateInitConfig(config);
// @ts-expect-error the event has the column's options in column, the operator in operator
console.log(gridInterface.on('filter-operator-change', (data) => data.cellConfig));
// @ts-expect-error a layout column has fields, not rows
gridInterface.setState({ layout: { center: [{ rows: ['name'], width: 100 }] } });
gridInterface.on('grid-connected', () => gridInterface.fitColumns());

const onFiltered: EventHandler<DatasourceEvents['collection-filtered']> = (data) => {
    const info: 'filter' | 'resetData' | 'markForDeletion' | 'unmarkForDeletion' | 'acceptChanges' | '__internalUpdate, forced' =
        data.info;
    console.log(info);
};
datasource.on('collection-filtered', onFiltered)();
datasource.on('select', (data) => console.log(data.row.toFixed(), data.info));
datasource.on('selection-change', () => datasource.getSelectedRows());
datasource.on('current-entity', () => datasource.currentEntity);
datasource.on('validate', (data) => {
    const sent: ValidationError[] = data.errors;
    console.log(sent.map((error) => error.messages.join(', ')));
});

// validation: the rules are in the fields, as JSON; the validators are registered by id
const oneOf: Validator = (value, row, rule) => {
    const values: ValidationOption | undefined = rule.values;
    const other: unknown = row.anything; // the row's other fields
    console.log(other);
    return Array.isArray(values) && !values.includes(String(value)) ? 'Must be one of {values}' : null;
};
registerValidator('oneOf', oneOf);
registerValidator('present', (value) => (value === null || value === undefined ? 'validation.required' : null));
// @ts-expect-error a validator is a function, not an object
registerValidator('object', { validate: () => null });
// @ts-expect-error a validator returns a message or null
registerValidator('boolean', (value) => value === 1);
const minRule: ValidationRuleObject = { id: 'min', value: 0, message: 'at least {value}' };
// @ts-expect-error a rule needs its id
const ruleWithoutId: ValidationRuleObject = { value: 0 };
// @ts-expect-error an option is JSON: no function
const withFunction: ValidationRuleObject = { id: 'min', value: () => 0 };
const ageRules: ValidationRule[] = [
    'required',
    minRule,
    { id: 'oneOf', values: ['a', 'b'] },
    { id: 'pattern', value: '^[0-9]+$' }
];
const validated = new Datasource<Person>({
    key: 'id',
    fields: { name: { validate: ['required', { id: 'maxLength', value: 50 }] }, age: { type: 'number', validate: ageRules } }
});
const validationErrors: ValidationError<Person>[] = validated.validate();
const someErrors: ValidationError<Person>[] = validated.validate(validated.getSelectedRows());
const firstError = validationErrors[0];
const errorName: string | undefined = firstError?.row.name;
const errorField: string | undefined = firstError?.field;
const errorMessages: string[] | undefined = firstError?.messages;
const currentErrors: ValidationError<Person>[] = validated.getErrors();
const ofRow: ValidationError<Person>[] = validated.getErrors(validated.getDataRows()[0]);
const invalid: boolean = validated.hasErrors();
const rulesOfName: readonly ValidationRuleObject[] = validated.getField('name').validate;
// the default messages are texts
const requiredText: string = TEXTS['validation.required'];
console.log(
    ruleWithoutId,
    withFunction,
    someErrors,
    errorName,
    errorField,
    errorMessages,
    currentErrors,
    ofRow,
    invalid,
    rulesOfName,
    requiredText
);
// @ts-expect-error the rules are a list
const notAList: FieldConfig = { validate: 'required' };
// @ts-expect-error getField().validate is the datasource's own list
validated.getField('name').validate.push({ id: 'required' });
console.log(notAList);

// the header focus event sends the first displayed row: a group row when grouped, or undefined
gridInterface.on('cell-header-focus', (data) => {
    // @ts-expect-error can be a group row or undefined
    const row: Entity = data.rowData;
    if (data.rowData && !isGroupRow(data.rowData)) {
        const dataRow: Entity = data.rowData;
        console.log(row, dataRow);
    }
});

// group rows: getRows() mixes data rows and group rows, getDataRows() is data rows only
interface Person {
    id: number;
    name: string;
}
const people = new Datasource<Person>({ key: 'id' });
people.setData([{ id: 1, name: 'a' }]);
for (const row of people.getRows()) {
    if (isGroupRow(row)) {
        const group: GroupRow = row;
        const label: string = row.__groupName;
        const children: number = row.__groupChildren.length + row.__groupTotal + row.__groupLvl;
        console.log(group, label, children, row.__groupID, row.__groupExpanded);
    } else {
        const name: string = row.name;
        console.log(name);
    }
}
const names: string[] = people.getDataRows().map((row) => row.name);
// createGrid takes the row type from the datasource, the hooks get typed rows
const peopleHooks: GridHooks<Person> = {
    isReadonly: (row) => (row.name === '' ? true : null),
    cellClass: (row) => (row.id < 0 ? { input: 'new-row' } : null)
};
const peopleGrid: GridInterface<Person> = createGrid(host, { config, datasource: people, hooks: peopleHooks });
peopleGrid.updateHooks({ cellClass: (row) => (row.name.length > 10 ? { input: 'long' } : null) });
// @ts-expect-error the row is a Person: name is a string
peopleGrid.updateHooks({ isReadonly: (row) => row.name.toFixed() === '' });
// hooks written without the row type fit any grid
const untypedHooks: GridHooks = { isReadonly: (row) => (row.locked ? true : null) };
peopleGrid.updateHooks(untypedHooks);
const peopleByHand: GridInterface<Person> = new GridInterface(config, people, peopleHooks);
const peopleRows: Person[] = peopleGrid.getDatasource().getDataRows();
console.log(peopleRows, peopleByHand);
// filtering the group rows out narrows the type too (TypeScript infers the predicate)
const shownNames: string[] = people
    .getRows()
    .filter((row) => !isGroupRow(row))
    .map((row) => row.name);
const groupRows: GroupRow[] = people.getRows().filter(isGroupRow);
console.log(shownNames, groupRows);
const selectedPeople: Person[] = people.getSelectedRows();

// getChanges() is typed with the row type: the key and the changed fields of an edited row
const changes: Changes<Person> = people.getChanges();
const addedPeople: Person[] = changes.newEntities;
const deletedPeople: Person[] = changes.deletedEntities;
const edited: ModifiedEntity<Person> | undefined = changes.modifiedEntities[0];
const editedName: string | undefined = edited?.name;
const generatedKey: string | number | undefined = edited?.__KEY;
console.log(addedPeople, deletedPeople, editedName, generatedKey);
// @ts-expect-error a modified entry has the changed fields only, a field can be missing
const fullPerson: Person = changes.modifiedEntities[0];
// @ts-expect-error not a field of Person
console.log(fullPerson, edited?.age);
const untyped: Changes = container.getChanges();
console.log(untyped.modifiedEntities[0]?.anything);

// delete is a tag: unmark undoes it. After a save, acceptChanges() - the server's keys for the new rows
people.markForDeletion(people.getSelectedRows());
people.unmarkForDeletion(people.getSelectedRows());
people.unmarkForDeletion(selectedPeople[0]);
people.markAllForDeletion();
people.unmarkAllForDeletion();
const unsaved: boolean = people.hasChanges() || container.hasChanges();
// a new row's temporary key: in its key field, or __KEY without a key field
const temporaryKey: string | number | undefined = changes.newEntities[0]?.__KEY ?? changes.newEntities[0]?.id;
console.log(unsaved, temporaryKey);
const serverIds: { temporaryId: number; id: number }[] = [{ temporaryId: -1, id: 7 }];
people.acceptChanges();
people.acceptChanges({ rows: people.getSelectedRows() });
people.acceptChanges({ rows: selectedPeople[0], newKeys: new Map(serverIds.map((row) => [row.temporaryId, row.id])) });
people.acceptChanges({ newKeys: new Map([['-1', 'a-uuid']]) });
// keys from the keys of a JSON object
people.acceptChanges({ newKeys: new Map(Object.entries({ '-1': 7 })) });
container.acceptChanges({ newKeys: new Map([[-1, 7]]) });
container.unmarkForDeletion(containerRows);
container.unmarkAllForDeletion();
// @ts-expect-error the rows go in the options: acceptChanges({ rows })
people.acceptChanges(people.getSelectedRows());
// @ts-expect-error newKeys is a Map
people.acceptChanges({ newKeys: { '-1': 7 } });
// @ts-expect-error a key is text or a number
people.acceptChanges({ newKeys: new Map([[-1, null]]) });
const flag = names.length > 0;
const rowsByFlag: (Person | GroupRow)[] = flag ? people.getDataRows() : people.getRows();
const dataRowCount: number = people.getDataRows().length + people.length();
console.log(selectedPeople, rowsByFlag, dataRowCount);
// @ts-expect-error v5 getRows(true) is getDataRows()
people.getRows(true);
// @ts-expect-error v5 length(true) is getDataRows().length
people.length(true);
// @ts-expect-error a displayed row can be a group row, narrow it with isGroupRow() first
console.log(people.getRows()[0].name);
// @ts-expect-error getRow() can return a group row
const firstPerson: Person = people.getRow(0);
// @ts-expect-error getRow() is undefined out of range, rule that out first
const shownRow: Person | GroupRow = people.getRow(0);
console.log(shownRow);
const firstShown = people.getRow(0);
if (firstShown && !isGroupRow(firstShown)) {
    console.log(firstShown.name);
}
// @ts-expect-error currentEntity can be a group row
console.log(firstPerson, people.currentEntity?.name);
const current = people.currentEntity;
if (current && !isGroupRow(current)) {
    console.log(current.name);
}
const firstRow = people.getRow(0);
if (isGroupRow(firstRow)) {
    people.expandGroup(firstRow.__groupID);
    // @ts-expect-error a group row is not an entity, editing and selection take entities only
    people.markForDeletion(firstRow);
    // @ts-expect-error a group row is not an entity
    const asEntity: Entity = firstRow;
    console.log(asEntity);
}
// @ts-expect-error an entity never has __group
const fakeGroup: Entity = { __group: true };
console.log(fakeGroup, isGroupRow(null), isGroupRow(undefined));

const cellData: GridCellEventData | null = null;
const paste: GridEvents['paste'] | null = null;
console.log(cellData, paste);

const dateInterface = new DateInterface({
    monthsToShow: 1,
    monthColumns: 1,
    startMonth: 0,
    startYear: 2026,
    weekStart: 1,
    showWeek: true,
    isoWeek: true,
    rowHeight: 22,
    monthWidth: 230,
    monthMargin: 10,
    hideDimmedDates: false,
    showYearInMonth: false,
    headerTitle: '',
    datepicker: true
});
const onDate: EventHandler<DateEvents['date-select']> = (date) => console.log(date?.getTime());
dateInterface.on('date-select', onDate);
// the selected days are timestamps, set from dates
dateInterface.setSelected([new Date(2026, 10, 20, 14, 30)]);
const selectedDays: number[] = dateInterface.getSelected();
console.log(selectedDays.map((time) => new Date(time)));

// a range picker: From and To, an end can be open (null). range-select sends them, null for Clear
const rangeInterface = new DateInterface({
    ...dateInterface.config,
    rangepicker: true,
    datepickerRange: [new Date(2026, 10, 22), null]
});
const onRange: EventHandler<DateEvents['range-select']> = (range) => {
    const ends: [Date | null, Date | null] | null = range;
    console.log(ends?.[0]?.getTime(), ends?.[1]?.getTime());
};
rangeInterface.on('range-select', onRange);
// @ts-expect-error a range is two ends: From and To
const oneEnd: IDateConfig['datepickerRange'] = [new Date()];
console.log(oneEnd);

// the element, placed by hand
const element = document.createElement('simple-html-grid') as GridElement;
element.connectInterface(gridInterface);
// @ts-expect-error the enableCleanup test flag is gone
element.enableCleanup = true;

// texts: every text by id, the page's with setTexts(), a grid's in its config. Plain JSON
const copyText: string = TEXTS['row.copy'];
const tooltipId: TextId = 'filterEditor.addCondition.tooltip';
const norwegian: Texts = {
    'row.copy': 'Kopier:',
    'footer.summary.count': 'Antall: {count}',
    [tooltipId]: 'Legg til betingelse',
    // an id of your own, for a validator's message
    'validation.phoneNO': 'Må være 8 siffer'
};
setTexts(norwegian);
setTexts({});
const translatedGrid: GridConfig = { layout, texts: norwegian };
gridInterface.updateConfig({ texts: { 'footer.clear': 'Tøm' } });
gridInterface.updateConfig({ texts: undefined });
// a translation that has every id: the compiler names the ones missing
const everyText: Record<TextId, string> = { ...TEXTS };
setTexts(everyText);
// the date picker's texts, for a DateInterface of your own
const dateTexts: IDateConfig['texts'] = { 'datePicker.month.january': 'Januar', 'datePicker.day.monday': 'Ma' };
console.log(copyText, translatedGrid, dateTexts);
// @ts-expect-error tooltipText is gone, the tooltips are texts: texts: { 'filterEditor.close.tooltip': 'Lukk' }
const withTooltipText: GridConfig = { layout, tooltipText: { 'filterEditor.close': 'Lukk' } };
// @ts-expect-error a text is a string
const notAText: Texts = { 'row.copy': 1 };
// @ts-expect-error the defaults stay as they are, setTexts() changes the texts
TEXTS['row.copy'] = 'Kopier:';
// @ts-expect-error the names of the months are texts, datePicker.month.*
const withMonthHeader: Partial<IDateConfig> = { monthHeader: ['Januar'] };
console.log(withTooltipText, notAText, withMonthHeader);

// the config, the state and the datasource's fields + formatters are plain data: no function
// anywhere in them, nested types included (a Date is data). The hooks are where the functions are.
// Depth: a filter group holds filters, the check stops after a few levels of them
type HasFunction<T, Depth extends unknown[] = []> = Depth['length'] extends 12
    ? false
    : T extends (...args: never[]) => unknown
      ? true
      : T extends Date
        ? false
        : T extends readonly (infer Item)[]
          ? HasFunction<Item, [...Depth, unknown]>
          : T extends object
            ? { [K in keyof T]-?: HasFunction<T[K], [...Depth, unknown]> }[keyof T]
            : false;
const configIsData: HasFunction<GridConfig> extends false ? true : never = true;
const stateIsData: HasFunction<GridState> extends false ? true : never = true;
const fieldsAreData: HasFunction<Pick<DatasourceOptions, 'fields' | 'formatters'>> extends false ? true : never = true;
const csvOptionsAreData: HasFunction<CsvOptions> extends false ? true : never = true;
const excelOptionsAreData: HasFunction<ExcelOptions> extends false ? true : never = true;
// boolean: true for the hooks, false for an optional hook left out (undefined)
const hooksAreFunctions: HasFunction<GridHooks> extends false ? never : true = true;
console.log(configIsData, stateIsData, fieldsAreData, csvOptionsAreData, excelOptionsAreData, hooksAreFunctions);

// internals are not part of the typings any more
// @ts-expect-error
gridInterface.__getGridConfig();
// @ts-expect-error
datasource.__select(0);

// lookups: a list to pick a cell's value from, registered by id - the column names it in plain JSON
const countryRows = new Datasource();
countryRows.setData([{ code: 'NO', name: 'Norway' }]);
const countryLookup: LookupFromDatasource = {
    datasource: countryRows,
    valueField: 'code',
    labelField: 'name',
    config: { layout: { center: [{ fields: ['name'], width: 160 }] } }
};
registerLookup('countries', countryLookup);
const pickerInterface = new GridInterface({ layout: { center: [{ fields: ['name'], width: 200 }] } }, new Datasource());
const customerLookup: LookupFromGridInterface = { gridInterface: pickerInterface, valueField: 'id', labelField: 'name' };
const anyLookup: Lookup = customerLookup;
registerLookup('customers', anyLookup);
const countryEditor: ColumnEditor = { type: 'select', lookup: 'countries' };
const lookupColumns: Record<string, ColumnConfig> = {
    country: { editor: countryEditor },
    customerId: { editor: { type: 'grid', lookup: 'customers', set: { customerName: 'name' } } }
};
// @ts-expect-error a lookup has a datasource or a grid interface, not both
const bothLookup: Lookup = { datasource: countryRows, gridInterface: pickerInterface, valueField: 'code' };
// @ts-expect-error the editor is a select or a grid
const badEditor: ColumnEditor = { type: 'list', lookup: 'countries' };
console.log(lookupColumns, bothLookup, badEditor);

// custom cells: a renderer registered by id - the column names it in plain JSON. Called once per cell
// element with its host, update() on every render, destroy() when the cell is done with it
interface Task {
    id: number;
    status: string;
}
const badgeRenderer: CellRenderer<Task> = (cellHost) => {
    const span = document.createElement('span');
    cellHost.appendChild(span);
    const instance: CellRendererInstance<Task> = {
        update(context: CellRenderContext<Task>) {
            // the row is typed by the renderer's T
            const status: string = context.row.status;
            const text: string = context.text;
            const type: FieldType = context.type;
            const readonly: boolean = context.readonly;
            const rowIndex: number = context.rowIndex;
            const grid: GridInterface<Task> = context.gridInterface;
            span.textContent = `${status} ${text} ${type} ${readonly} ${rowIndex} ${grid ? '' : '-'}`;
            if (!readonly) {
                context.row.status = 'seen';
            }
        },
        destroy: () => span.remove(),
        edit: (typed?: string) => console.log(typed)
    };
    return instance;
};
registerCellRenderer('badge', badgeRenderer);
// a renderer of the default T, update() only
registerCellRenderer('plain', (cellHost) => ({
    update: ({ value }) => {
        cellHost.textContent = String(value);
    }
}));
const rendererColumns: Record<string, ColumnConfig> = { status: { renderer: 'badge' } };
// @ts-expect-error a renderer returns an instance with update()
registerCellRenderer('nothing', () => ({}));
// @ts-expect-error the column names the renderer by its id
const rendererObject: ColumnConfig = { renderer: badgeRenderer };
console.log(rendererColumns, rendererObject);

// display formats: how a column shows its values, one object per column with a part per kind - plain JSON
const week: DateFormat = 'weekIso';
const norwegianMoney: NumberFormat = { decimals: 2, thousands: ' ', decimal: ',' };
const formatColumns: Record<string, ColumnConfig> = {
    due: { format: { date: week } },
    balance: { format: { number: norwegianMoney } }
};
const stateFormats: Record<string, ColumnFormat> = gridInterface.getState().formats;
gridInterface.setState({ formats: { ...stateFormats, due: { date: 'daysUntil' } } });
// @ts-expect-error a format is an object with a part per kind, not a bare id
const bareFormat: ColumnConfig = { format: 'weekIso' };
// @ts-expect-error no such date format
const unknownDate: ColumnFormat = { date: 'week' };
// @ts-expect-error 0 to 4 decimals
const tooManyDecimals: NumberFormat = { decimals: 5 };
// @ts-expect-error a thousands separator is one of ' ', ',', '.', "'"
const underscore: NumberFormat = { thousands: '_' };
console.log(formatColumns, bareFormat, unknownDate, tooManyDecimals, underscore);

// a text column: a template of its text and a link, templates - text with {field} placeholders
const customerLink: LinkFormat = { url: 'https://crm.example.com/customer/{id}', newTab: true };
const linkColumns: Record<string, ColumnConfig> = {
    company: { format: { text: '{company} ({id})', link: customerLink } },
    email: { format: { link: { url: 'mailto:{email}' } } }
};
gridInterface.updateConfig({ settingsButton: false });
gridInterface.openColumnSettings('company');
// @ts-expect-error a link is an object with its address, not the address
const bareLink: ColumnFormat = { link: 'https://x.com' };
// @ts-expect-error the label of a link is the text of the column, ColumnFormat.text
const linkLabel: LinkFormat = { url: 'https://x.com', label: '{name}' };
console.log(linkColumns, bareLink, linkLabel);

// the rest of the column settings: a label, the empty cells' placeholder, blank / 0, checkboxes
const yesNo: CheckboxFormat = { checked: 'Y', unchecked: 'N' };
const settingsColumns: Record<string, ColumnConfig> = {
    company: { format: { label: 'Firm', placeholderRowLabel: true } },
    city: { format: { placeholderRow: 'Name of the city' } },
    discount: { format: { numberOverride: 'NONE' } },
    newsletter: { format: { checkbox: {} } },
    approved: { format: { checkbox: yesNo } }
};
// @ts-expect-error numberOverride is one of three texts
const zeroOverride: ColumnFormat = { numberOverride: 'ZERO' };
// @ts-expect-error the values of a checkbox are text, also for a number field
const numberChecked: CheckboxFormat = { checked: 1 };
console.log(settingsColumns, zeroOverride, numberChecked);

// the detail form: collapsed or expanded, its width between a least and a most - plain JSON, state
const collapsedForm: DetailForm = {
    show: true,
    fields: ['name', 'notes'],
    width: 320,
    expanded: false,
    minWidth: 200,
    maxWidth: 600
};
gridInterface.setState({ detailForm: collapsedForm });
const formExpanded: boolean | undefined = gridInterface.getState().detailForm.expanded;
// @ts-expect-error expanded is true or false
const expandedText: DetailForm = { show: true, fields: [], expanded: 'yes' };
// @ts-expect-error the least width is a number of px
const minWidthText: DetailForm = { show: true, fields: [], minWidth: '200px' };
console.log(formExpanded, expandedText, minWidthText);
// the edit permissions: what the user may do in an editable grid, each left out is allowed
const addOnly: EditPermissions = { add: true, change: false, delete: false };
const permissionsConfig: GridConfig = { layout, readonly: false, edit: addOnly };
gridInterface.updateConfig({ edit: { delete: false } });
gridInterface.updateConfig({ edit: undefined });
// @ts-expect-error a permission is true or false
const permissionText: EditPermissions = { delete: 'no' };
// @ts-expect-error add, change and delete only
const permissionTypo: EditPermissions = { chnage: false };
// @ts-expect-error the permissions are no state: the user can not give them to themselves
gridInterface.setState({ edit: addOnly });
console.log(permissionsConfig, permissionText, permissionTypo);
// colour rules: a condition as the header filter has it, a colour of the palette - the first that matches wins
const negativeRed: ColorRule = { operator: 'LESS_THAN', value: '0', color: 'red' };
const warmColour: PaletteColor = 'orange';
const ruleColumns: Record<string, ColumnConfig> = {
    balance: { format: { rules: [negativeRed, { operator: 'BETWEEN', value: ['0', '100'], background: 'yellow', bold: true }] } },
    status: {
        format: {
            rules: [
                { operator: 'EQUAL', value: 'waiting', background: warmColour },
                { operator: 'IS_BLANK', background: 'grey' }
            ]
        }
    }
};
// a custom colour is #rrggbb: the grid keeps it readable in dark
const hexColour: ColorRule = { operator: 'EQUAL', value: '1', color: '#ff0000' };
const customBackground: RuleColor = '#0f766e';
// @ts-expect-error a colour is a name of the palette or starts with #
const namedColour: ColorRule = { operator: 'EQUAL', value: '1', color: 'magenta' };
// @ts-expect-error the value is text as typed in the header filter
const numberValue: ColorRule = { operator: 'EQUAL', value: 1, color: 'red' };
// conditions on other fields of the row, and a formula
const lateCondition: RuleCondition = { field: 'status', operator: 'EQUAL', value: 'late' };
const multiField: ColorRule = {
    conditions: [lateCondition, { field: 'balance', operator: 'GREATER_THAN', value: '0' }],
    combine: 'OR',
    background: customBackground
};
const formulaRule: ColorRule = { expression: 'DAYS({due}, TODAY()) > 7', color: 'pink', bold: true };
// @ts-expect-error combine is AND or OR
const badCombine: ColorRule = { conditions: [lateCondition], combine: 'XOR', color: 'red' };
console.log(ruleColumns, hexColour, namedColour, numberValue, multiField, formulaRule, badCombine);

// calculated columns: a formula over the fields of the row, in the config and the state
const totalColumn: CalculatedColumn = { formula: '{price} * {qty}', label: 'Total', type: 'number' };
const resultType: CalculatedType = 'date';
const calculatedConfig: GridConfig = {
    calculatedColumns: { total: totalColumn, due: { formula: 'TODAY()', type: resultType } },
    layout: { center: [{ fields: ['total'], width: 90 }] }
};
const savedCalculated: Record<string, CalculatedColumn> = gridInterface.getState().calculatedColumns;
gridInterface.setState({ calculatedColumns: { ...savedCalculated, total: totalColumn } });
// @ts-expect-error the formula is text
const formulaNumber: CalculatedColumn = { formula: 2 };
// @ts-expect-error a type of the language: number, text, date, boolean
const datetimeType: CalculatedColumn = { formula: 'TODAY()', type: 'datetime' };
console.log(calculatedConfig, formulaNumber, datetimeType);
// quick dates: the ids a column offers, the one a header filter keeps - relative, computed from today
const quickDate: DatePreset = 'thisMonth';
const quickDateColumns: Record<string, ColumnConfig> = {
    dueDate: { datePresets: [...DATE_PRESETS] },
    orderDate: { datePresets: ['today', 'last7Days', quickDate] },
    born: { datePresets: false }
};
gridInterface.setState({ headerFilters: { orderDate: { value: null, datePreset: 'overdue' } } });
gridInterface.refreshDatePresets();
// @ts-expect-error a quick date the grid does not have
const tomorrow: DatePreset = 'tomorrow';
// @ts-expect-error true is no list: every one but Overdue is the default, left out
const allQuickDates: ColumnConfig = { datePresets: true };
// @ts-expect-error DATE_PRESETS is read only: copy it
DATE_PRESETS.push('today');
console.log(quickDateColumns, tomorrow, allQuickDates);

// the sql entry, through the package's "exports" (bundler resolution here, node16 in tsconfig.sql.json):
// a filter of the grid is a filter toSqlWhere takes
const sqlFilter: FilterExpression = and(where('age', 'GREATER_THAN', 18), where('name', 'IN', ['Ann', 'NULL']));
const sqlOptions: SqlOptions = { dialect: 'sqlite', columns: { age: { column: 'age', type: 'number' }, name: 'name' } };
const sqlWhere: SqlWhere = toSqlWhere(sqlFilter, sqlOptions);
console.log(sqlWhere.sql, sqlWhere.params);
