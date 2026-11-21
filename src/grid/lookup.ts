import type { Datasource } from '../datasource/dataSource';
import type { Entity } from '../datasource/entity';
import type { GridConfig } from './gridConfig';
import type { GridInterface } from './gridInterface';

/**
 * A list to pick a cell's value from, for a column's `editor` ({@link ColumnEditor}): the rows to pick
 * from, the field of a row that is stored in the cell, and the field the user sees. Register it with
 * {@link registerLookup} under an id, the column names the id.
 *
 * Either a datasource of its own - the rows, and for the dropdown grid (`type: 'grid'`) the
 * {@link GridConfig} of the grid in it - or a {@link GridInterface} you made, shown as it is.
 *
 * @sample lookups
 * @example
 * ```ts
 * import { Datasource, GridInterface, type Lookup } from '@simple-html/grid';
 *
 * const countries = new Datasource();
 * countries.setData([{ code: 'NO', name: 'Norway' }, { code: 'SE', name: 'Sweden' }]);
 *
 * // the cell stores 'NO' and shows 'Norway'
 * const fromRows: Lookup = { datasource: countries, valueField: 'code', labelField: 'name' };
 *
 * // a dropdown grid with these columns
 * const withColumns: Lookup = {
 *     datasource: countries,
 *     valueField: 'code',
 *     labelField: 'name',
 *     config: { layout: { center: [{ fields: ['code'], width: 60 }, { fields: ['name'], width: 160 }] } }
 * };
 *
 * // a grid interface of your own: its config, its hooks
 * const customers = new GridInterface({ layout: { center: [{ fields: ['name'], width: 200 }] } }, new Datasource());
 * const fromInterface: Lookup = { gridInterface: customers, valueField: 'id', labelField: 'name' };
 * ```
 */
export type Lookup = LookupFromDatasource | LookupFromGridInterface;

/**
 * A {@link Lookup} of the rows of a datasource.
 *
 * @sample lookups
 * @example
 * ```ts
 * import { Datasource, type LookupFromDatasource } from '@simple-html/grid';
 *
 * const customers = new Datasource({ fields: { id: 'number' } });
 * const lookup: LookupFromDatasource = {
 *     datasource: customers,
 *     valueField: 'id',
 *     labelField: 'name',
 *     config: {
 *         layout: { center: [{ fields: ['id'], width: 60 }, { fields: ['name'], width: 180 }, { fields: ['city'], width: 120 }] }
 *     }
 * };
 * ```
 */
export interface LookupFromDatasource {
    /**
     * the rows to pick from. The select shows the rows it displays (`getDataRows()`: its filter and
     * sort). The dropdown grid filters and sorts it: give the lookup a datasource of its own, or one
     * that shares the rows of another through a `DataContainer`
     */
    datasource: Datasource<any>;
    /** the field of the picked row that is stored in the cell, e.g. `'id'` or `'code'` */
    valueField: string;
    /** the field the cell and the list show, e.g. `'name'`. Default `valueField` */
    labelField?: string;
    /**
     * the dropdown grid (`type: 'grid'`): its columns and options, plain JSON. Default one column of
     * `labelField`, or `valueField` and `labelField` when they differ. Left out of it: no grouping
     * panel (`panelHeight: 0`), no footer, no row state, and the header filters search anywhere in the
     * text (`operator: 'CONTAINS'` for a column without an operator). The select does not use it
     */
    config?: GridConfig;
    /** a lookup of a datasource has no grid interface */
    gridInterface?: never;
}

/**
 * A {@link Lookup} that shows a grid interface of your own as the dropdown grid: its config, its hooks
 * and its datasource. The select shows the rows of its datasource.
 *
 * **Show it in the dropdown only**: an interface shows one grid at a time. While the dropdown is open
 * the interface is connected to it, and disconnected when it closes - a grid on the page with the same
 * interface would stop following its datasource. Each time the dropdown opens, the interface goes back
 * to the state it started in (`resetState()`): the filter typed the last time is gone.
 *
 * @sample lookups
 * @example
 * ```ts
 * import { Datasource, GridInterface, type LookupFromGridInterface } from '@simple-html/grid';
 *
 * const customers = new Datasource({ fields: { id: 'number' } });
 * const picker = new GridInterface(
 *     {
 *         columns: { name: { operator: 'CONTAINS' } },
 *         layout: { center: [{ fields: ['name'], width: 200 }] },
 *         panelHeight: 0
 *     },
 *     customers,
 *     { cellClass: (row) => (row.blocked ? { input: 'blocked' } : null) }
 * );
 * const lookup: LookupFromGridInterface = { gridInterface: picker, valueField: 'id', labelField: 'name' };
 * ```
 */
export interface LookupFromGridInterface {
    /** the grid interface the dropdown grid shows, made with `new GridInterface()` */
    gridInterface: GridInterface<any>;
    /** the field of the picked row that is stored in the cell */
    valueField: string;
    /** the field the cell and the list show. Default `valueField` */
    labelField?: string;
    /** the interface has its own datasource */
    datasource?: never;
    /** the interface has its own config */
    config?: never;
}

/**
 * @internal
 * A lookup as the registry keeps it: what was registered, its datasource, and the rows by value
 */
export class RegisteredLookup {
    readonly datasource: Datasource<any>;
    readonly valueField: string;
    readonly labelField: string;
    readonly config: GridConfig | undefined;
    readonly gridInterface: GridInterface<any> | undefined;

    /** the first row of each value, made when it is first needed: see rowOf */
    private rowsByValue: Map<unknown, Entity> | null = null;

    /** unsubscribes from the datasource, see dispose */
    private unsubscribe: (() => void)[];

    constructor(
        readonly id: string,
        lookup: Lookup
    ) {
        this.datasource = lookup.gridInterface ? lookup.gridInterface.getDatasource() : (lookup.datasource as Datasource<any>);
        this.valueField = lookup.valueField;
        this.labelField = lookup.labelField ?? lookup.valueField;
        this.config = lookup.config;
        this.gridInterface = lookup.gridInterface;

        // rows added, removed or replaced, and values set: the rows by value are made again when they
        // are needed next. The labels are read from the rows, they are never out of date
        const forget = () => {
            this.rowsByValue = null;
        };
        this.unsubscribe = [this.datasource.on('collection-changed', forget), this.datasource.on('rows-changed', forget)];
    }

    /**
     * The row whose value field has this value (`===`, a number 17 is not the text '17'): the first one
     * when several have it. undefined for a blank value, and a value no row has
     */
    public rowOf(value: unknown): Entity | undefined {
        if (value === null || value === undefined || value === '') {
            return undefined;
        }
        if (!this.rowsByValue) {
            this.rowsByValue = new Map();
            for (const row of this.datasource.getAllData()) {
                const key = row[this.valueField];
                if (!this.rowsByValue.has(key)) {
                    this.rowsByValue.set(key, row);
                }
            }
        }
        return this.rowsByValue.get(value);
    }

    /**
     * the label of a row: its label field, as the lookup's datasource formats it
     */
    public labelOf(row: Entity): string {
        // a formatter of plain JavaScript can give something else than text
        return String(this.datasource.getFormatter(this.labelField).format(row[this.labelField]) ?? '');
    }

    /**
     * the rows of the select: what the datasource displays, its filter and sort
     */
    public rows(): Entity[] {
        return this.datasource.getDataRows();
    }

    /**
     * The first row whose label is this text, ignoring case - for a pasted label. undefined when none is
     */
    public rowOfLabel(text: string): Entity | undefined {
        const wanted = text.trim().toLocaleLowerCase();
        return this.datasource.getAllData().find((row) => this.labelOf(row).toLocaleLowerCase() === wanted);
    }

    /**
     * stops following the datasource: the id was registered again
     */
    public dispose() {
        for (const unsubscribe of this.unsubscribe) {
            unsubscribe();
        }
        this.unsubscribe = [];
    }
}

/**
 * The lookups by id, one registry for the page: every grid looks its ids up here
 */
const registry = new Map<string, RegisteredLookup>();

/**
 * Registers a lookup under an id, for a column's `editor` to name it: `editor: { type: 'select',
 * lookup: 'countries' }`. The config stays plain JSON - it can be stored, e.g. in a backend - and the
 * lookup, which holds a datasource or a grid interface, is code: register it when the page loads,
 * before the grid that names it is made.
 *
 * - **A grid looks its ids up when it is made** (and when `updateConfig()` is given `columns`): an id
 *   that is not registered throws a `TypeError` then. It keeps the lookups it found: registering an id
 *   again changes the grids made after, not the ones made before.
 * - **The lookup follows its datasource**: rows added, removed, replaced or changed show in the cells
 *   on their own - load the rows after the grid is made, if you like.
 * - There is one registry for the page, shared by every grid.
 *
 * @param id the name the columns use, e.g. `'countries'`. Any text but `''`
 * @param lookup the rows to pick from, see {@link Lookup}
 * @throws a `TypeError` when the id is not a text, the lookup has neither or both of `datasource` and
 * `gridInterface`, `valueField` or `labelField` is not a text, or `config` is given with a
 * `gridInterface` (it has its own)
 *
 * @sample lookups
 * @example
 * ```ts
 * import { createGrid, Datasource, registerLookup } from '@simple-html/grid';
 *
 * const countries = new Datasource();
 * countries.setData([
 *     { code: 'NO', name: 'Norway' },
 *     { code: 'SE', name: 'Sweden' },
 *     { code: 'DK', name: 'Denmark' }
 * ]);
 * registerLookup('countries', { datasource: countries, valueField: 'code', labelField: 'name' });
 *
 * const customers = new Datasource({ fields: { id: 'number' } });
 * customers.setData([{ id: 1, name: 'ACME CORP', city: 'Oslo' }]);
 * registerLookup('customers', {
 *     datasource: customers,
 *     valueField: 'id',
 *     labelField: 'name',
 *     config: { layout: { center: [{ fields: ['name'], width: 180 }, { fields: ['city'], width: 100 }] } }
 * });
 *
 * // the config names them: plain JSON
 * const gridInterface = createGrid(host, {
 *     datasource,
 *     config: {
 *         readonly: false,
 *         columns: {
 *             country: { editor: { type: 'select', lookup: 'countries' } },
 *             // picking a customer stores its id, and copies its name into the row's customerName
 *             customerId: { label: 'Customer', editor: { type: 'grid', lookup: 'customers', set: { customerName: 'name' } } }
 *         },
 *         layout: { center: [{ fields: ['country'], width: 120 }, { fields: ['customerId'], width: 180 }] }
 *     }
 * });
 * ```
 */
export function registerLookup(id: string, lookup: Lookup): void {
    // plain js can pass anything: say so now, not when a cell is rendered
    if (typeof id !== 'string' || id === '') {
        throw new TypeError(`registerLookup: the id must be a text, got ${JSON.stringify(id)}`);
    }
    assertLookup(id, lookup);
    registry.get(id)?.dispose();
    registry.set(id, new RegisteredLookup(id, lookup));
}

/**
 * @throws a `TypeError` naming what is wrong with the lookup
 */
function assertLookup(id: string, lookup: unknown): asserts lookup is Lookup {
    const where = `registerLookup('${id}')`;
    if (typeof lookup !== 'object' || lookup === null || Array.isArray(lookup)) {
        throw new TypeError(`${where}: the lookup is an object { datasource, valueField, labelField }`);
    }
    const { datasource, gridInterface, valueField, labelField, config } = lookup as Record<string, unknown>;
    const hasDatasource = datasource !== undefined;
    const hasInterface = gridInterface !== undefined;
    if (hasDatasource === hasInterface) {
        throw new TypeError(`${where}: the lookup has a datasource or a gridInterface, one of them`);
    }
    // a duck check: a Datasource and a GridInterface from another copy of the package would fail an instanceof
    if (hasDatasource && typeof (datasource as Datasource<any>)?.getAllData !== 'function') {
        throw new TypeError(`${where}: datasource is not a Datasource`);
    }
    if (hasInterface && typeof (gridInterface as GridInterface<any>)?.getDatasource !== 'function') {
        throw new TypeError(`${where}: gridInterface is not a GridInterface`);
    }
    if (typeof valueField !== 'string' || valueField === '') {
        throw new TypeError(
            `${where}: valueField is the name of the field stored in the cell, got ${JSON.stringify(valueField)}`
        );
    }
    if (labelField !== undefined && (typeof labelField !== 'string' || labelField === '')) {
        throw new TypeError(`${where}: labelField is the name of the field shown, got ${JSON.stringify(labelField)}`);
    }
    if (config !== undefined && hasInterface) {
        throw new TypeError(`${where}: config is for a lookup of a datasource, a gridInterface has its own`);
    }
    if (config !== undefined && (typeof config !== 'object' || config === null || Array.isArray(config))) {
        throw new TypeError(`${where}: config is a GridConfig`);
    }
}

/**
 * @internal
 * The lookup registered under an id, for a column's editor
 * @param where the column, for the message: `columns.country.editor`
 * @throws a `TypeError` when the id is not registered, or not a text
 */
export function getRegisteredLookup(id: unknown, where: string): RegisteredLookup {
    const lookup = typeof id === 'string' ? registry.get(id) : undefined;
    if (!lookup) {
        const known = Array.from(registry.keys(), (key) => `'${key}'`).join(', ') || 'none';
        throw new TypeError(
            `GridConfig: ${where}.lookup is ${JSON.stringify(id)}, the id of a lookup: register it with registerLookup() before the grid is made. Registered: ${known}`
        );
    }
    return lookup;
}
