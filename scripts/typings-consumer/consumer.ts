/**
 * A user's code, compiled against the published typings in dist only: `npm run check:typings`.
 *
 * The build strips members tagged @internal from the .d.ts files. If a public signature still uses
 * a stripped type, the typings are broken for users while the library itself still compiles -
 * this file (with skipLibCheck: false, so every .d.ts is checked) is what catches that.
 * Add to it when the public API grows.
 */
import {
    and,
    BooleanFormatter,
    DataContainer,
    Datasource,
    type DatasourceEvents,
    type DatasourceOptions,
    type DateEvents,
    DateFormatterDDMMYYYY,
    DateFormatterYYYYMMDD,
    DateInterface,
    type Entity,
    type EventHandler,
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
    GridInterface,
    type GroupRow,
    type HTMLCellElement,
    isGroupRow,
    NumberFormatterComma,
    NumberFormatterDot,
    or,
    TextFormatter,
    TOOLTIPS,
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
const ageConfig: FieldConfig = { type: 'number', label: 'Age' };
const options: DatasourceOptions = {
    key: 'id',
    fields: {
        born: 'date',
        lastLogin: 'datetime',
        age: ageConfig,
        price: { type: 'number', formatter: money },
        name: { formatter: upperCase }
    },
    formatters: { date: DateFormatterDDMMYYYY, number: NumberFormatterComma, boolean: BooleanFormatter },
    selectionMode: 'multiple'
};
const datasource = new Datasource(options);
datasource.setData([{ id: 1, name: 'a', born: new Date() }]);
const born: Field = datasource.getField('born');
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

const config: GridConfig = {
    columnsCenter: [{ rows: ['name'], width: 100 }],
    // the type of a column comes from the datasource, the column label falls back to the field's
    attributes: [{ attribute: 'name', label: 'Name' }, { attribute: 'born' }],
    placeHolderRowCurrentEntityOnly: true
};
// @ts-expect-error the type is not on the column any more, it is in the datasource fields
const typedColumn: GridConfig['attributes'][number] = { attribute: 'born', type: 'date' };
console.log(typedColumn);
// the saved filter is a FilterExpression too
const withFilter: GridConfig = { ...config, filter: and(adult, where('name', 'BEGIN_WITH', 'a')) };
const headerOperator: FilterOperator | undefined = withFilter.attributes[0].operator;
console.log(headerOperator);
// the filter as text, with your own labels
const filterText: string = datasource.getFilterString((field) => field.toUpperCase());
console.log(filterText, datasource.getFilterTree()?.children);
const gridInterface = new GridInterface(config, datasource);
// the callbacks only get data rows, never a group row
gridInterface.readonlySetter((attribute: string, row: Entity) => (attribute === 'name' ? row.__rowState === 'D' : null));
gridInterface.readonlySetter(null);
gridInterface.cellAppendClassSetter(null);
// events: on() types the payload from the event map, and returns the unsubscribe function
const offCellClick: () => void = gridInterface.on('cell-click', (data) => {
    const cell: HTMLCellElement = data.cell;
    const row: Entity = data.rowData;
    const click: MouseEvent = data.originalEvent;
    console.log(cell, row, click, data.attribute.toUpperCase());
});
offCellClick();
gridInterface.on('filter-operator-change', (data) => {
    data.cellConfig.placeHolderFilter = data.cellConfig.operator;
    data.rebuildHeader();
});
gridInterface.on('grid-connected', () => gridInterface.autoResizeColumns());

const onFiltered: EventHandler<DatasourceEvents['collection-filtered']> = (data) => {
    const info: 'filter' | 'resetData' | 'markForDeletion' | '__internalUpdate, forced' = data.info;
    console.log(info);
};
datasource.on('collection-filtered', onFiltered)();
datasource.on('select', (data) => console.log(data.row.toFixed(), data.info));
datasource.on('selection-change', () => datasource.getSelectedRows());
datasource.on('current-entity', () => datasource.currentEntity);

// the header focus event sends the first displayed row: a group row when grouped, or undefined
gridInterface.on('cell-header-focus', (data) => {
    // @ts-expect-error can be a group row or undefined
    const row: Entity = data.rowData;
    if (data.rowData && !isGroupRow(data.rowData)) {
        const dataRow: Entity = data.rowData;
        console.log(row, dataRow);
    }
});

// group rows: getRows() mixes data rows and group rows, getRows(true) is data rows only
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
const names: string[] = people.getRows(true).map((row) => row.name);
// filtering the group rows out narrows the type too (TypeScript infers the predicate)
const shownNames: string[] = people
    .getRows()
    .filter((row) => !isGroupRow(row))
    .map((row) => row.name);
const groupRows: GroupRow[] = people.getRows().filter(isGroupRow);
console.log(shownNames, groupRows);
const selectedPeople: Person[] = people.getSelectedRows();
const flag = names.length > 0;
const rowsByFlag: (Person | GroupRow)[] = people.getRows(flag);
console.log(selectedPeople, rowsByFlag);
// @ts-expect-error a displayed row can be a group row, narrow it with isGroupRow() first
console.log(people.getRows()[0].name);
// @ts-expect-error getRow() can return a group row
const firstPerson: Person = people.getRow(0);
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
    monthHeader: [],
    startMonth: 0,
    startYear: 2026,
    weekHeader: [],
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

const element = document.createElement('simple-html-grid') as GridElement;
element.connectInterface(gridInterface);

console.log(TOOLTIPS);

// internals are not part of the typings any more
// @ts-expect-error
gridInterface.__getGridConfig();
// @ts-expect-error
datasource.__select(0);
