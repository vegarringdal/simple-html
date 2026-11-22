import {
    type CellRenderer,
    Datasource,
    type FieldConfig,
    type FieldType,
    type Formatter,
    type GridConfig,
    type LayoutColumn,
    NumberFormatterDot,
    registerCellRenderer,
    registerFormatter,
    registerLookup
} from '@simple-html/grid';
import { COMPANIES, COUNTRIES, createStage, type DemoSample, FRUITS, mountGrid } from '../demoUtils';

/**
 * A grid to try everything in: 50 columns of every kind, as many rows as you add, editing on or off.
 * The grid is most of the page (fullPage): the source starts folded.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const TAGS = Array.from({ length: 9 }, (_, i) => `tag${i + 1}`);
const KPIS = Array.from({ length: 9 }, (_, i) => `kpi${i + 1}`);
const STATUSES = ['open', 'waiting', 'done'];
const CITIES = ['Oslo', 'Bergen', 'Stockholm', 'Copenhagen', 'Helsinki', 'Reykjavik', 'Berlin', 'Paris', 'Madrid', 'Rome'];
const COUNTRY_CODES = ['NO', 'SE', 'DK', 'FI', 'IS', 'DE', 'FR', 'ES', 'IT', 'PT'];

// money: a space between the thousands, edited as the plain number
const money: Formatter = {
    ...NumberFormatterDot,
    format: (value) => (typeof value === 'number' ? value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''),
    formatForEdit: (value) => NumberFormatterDot.format(value),
    parse: (text) => NumberFormatterDot.parse(text.replaceAll(' ', ''))
};
registerFormatter('full-grid-money', money);

// the status as a small badge, drawn with plain DOM
const status: CellRenderer = (host) => {
    const badge = document.createElement('span');
    badge.className = 'demo-full-badge';
    host.appendChild(badge);
    return {
        update({ value, text }) {
            badge.textContent = text;
            badge.dataset.status = String(value ?? '');
        }
    };
};
registerCellRenderer('full-grid-status', status);

/** the fields and their types: 50 in all */
function fields(): Record<string, FieldType | FieldConfig> {
    const result: Record<string, FieldType | FieldConfig> = {
        id: 'number',
        company: { validate: ['required'] },
        age: 'number',
        balance: { type: 'number', formatter: 'full-grid-money' },
        credit: { type: 'number', formatter: 'full-grid-money' },
        discount: {
            type: 'number',
            validate: [
                { id: 'min', value: 0 },
                { id: 'max', value: 50 }
            ]
        },
        orderDate: 'date',
        dueDate: 'date',
        updated: 'datetime',
        isActive: 'boolean',
        vip: 'boolean',
        notes: { multiline: true },
        total: 'number',
        approved: 'boolean'
    };
    for (const field of [...MONTHS, ...KPIS]) {
        result[field] = 'number';
    }
    return result;
}

/** the columns: id and company pinned left, total and approved pinned right, 46 in the middle */
function config(readonly: boolean): GridConfig {
    const column = (field: string, width = 100): LayoutColumn => ({ fields: [field], width });
    return {
        readonly,
        columns: {
            id: { readonly: true },
            company: { label: 'Company' },
            countryCode: { label: 'Country', editor: { type: 'select', lookup: 'full-grid-countries' } },
            status: { renderer: 'full-grid-status' },
            age: { aggregate: 'avg' },
            balance: { aggregate: ['sum', 'avg'] },
            // display formats: what the cells show, the value stays - right click a column label, Format ›
            credit: { format: { number: { decimals: 2, thousands: ' ', decimal: ',' } } },
            dueDate: { format: { date: 'weekIso' } },
            updated: { format: { date: 'norwegianTime' } },
            total: { readonly: true, aggregate: 'sum' },
            notes: { label: 'Notes' }
        },
        layout: {
            left: [column('id', 70), column('company', 160)],
            center: [
                column('countryCode', 110),
                column('city'),
                column('status', 90),
                column('age', 70),
                column('balance', 110),
                column('credit', 110),
                column('discount', 80),
                column('orderDate'),
                column('dueDate'),
                column('updated', 150),
                column('isActive', 70),
                column('vip', 60),
                column('fruit', 90),
                column('phone', 120),
                column('email', 180),
                column('notes', 160),
                ...MONTHS.map((month) => column(month, 80)),
                ...TAGS.map((tag) => column(tag, 90)),
                ...KPIS.map((kpi) => column(kpi, 80))
            ],
            right: [column('total', 110), column('approved', 80)]
        }
    };
}

/** rows from id `start`, the same every time (a seeded random) */
function makeRows(count: number, start: number) {
    let seed = start;
    const rnd = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };
    const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)];
    return Array.from({ length: count }, (_, i) => {
        const id = start + i;
        const company = pick(COMPANIES);
        const row: Record<string, unknown> = {
            id,
            company,
            countryCode: pick(COUNTRY_CODES),
            city: pick(CITIES),
            status: pick(STATUSES),
            age: 20 + Math.floor(rnd() * 45),
            balance: Math.round(rnd() * 5_000_000) / 100,
            credit: Math.round(rnd() * 1_000_000) / 100,
            discount: Math.floor(rnd() * 30),
            orderDate: new Date(2026, 0, 1 + Math.floor(rnd() * 365)),
            dueDate: rnd() > 0.1 ? new Date(2026, 3, 1 + Math.floor(rnd() * 365)) : null,
            updated: new Date(2026, 10, 1 + Math.floor(rnd() * 20), Math.floor(rnd() * 24), Math.floor(rnd() * 60)),
            isActive: rnd() > 0.3,
            vip: rnd() > 0.85,
            fruit: pick(FRUITS),
            phone: `+47 ${10000000 + Math.floor(rnd() * 89999999)}`,
            email: `${company.toLowerCase().replaceAll(' ', '.')}${id}@example.com`,
            notes:
                rnd() > 0.8
                    ? `Call before delivery\nGate code ${1000 + Math.floor(rnd() * 9000)}\nAsk for ${pick(['Ann', 'Bob', 'Cid'])}`
                    : '',
            approved: rnd() > 0.5
        };
        let total = 0;
        for (const month of MONTHS) {
            const sales = Math.floor(rnd() * 1000);
            row[month] = sales;
            total += sales;
        }
        row.total = total;
        for (const tag of TAGS) {
            row[tag] = `${tag.toUpperCase()}-${Math.floor(rnd() * 100)}`;
        }
        for (const kpi of KPIS) {
            row[kpi] = Math.round(rnd() * 10000) / 100;
        }
        return row;
    });
}

/** the badge's look: the grid's colours, so light and dark */
const STYLE = `
.demo-full-badge { padding: 0 6px; border: 1px solid currentColor; line-height: 14px; }
.demo-full-badge[data-status='open'] { color: var(--simple-html-grid-conflict-color); }
.demo-full-badge[data-status='waiting'] { color: var(--simple-html-grid-edited-color); }
.demo-full-badge[data-status='done'] { color: var(--simple-html-grid-new-color); }
`;

export const fullGrid: DemoSample = {
    id: 'full-grid',
    title: 'Full grid: try everything',
    group: 'Getting started',
    fullPage: true,
    description:
        '50 columns of every kind - text, numbers (money edited as the plain number), dates, a date and time, checkboxes, a lookup, a badge, notes of several lines, monthly sales with aggregates - pinned left and right. Credit, Due Date and Updated have display formats (Format › in the header menu: weeks, days until, Norwegian separators...). Add 5 000 rows at a time, turn editing on and off, group, filter, sort, select ranges, export to Excel (gridInterface.downloadExcel), Ctrl+F, Ctrl+D, Ctrl+Z, right click for the menus.',
    run(stage) {
        const style = document.createElement('style');
        style.textContent = STYLE;
        stage.appendChild(style);
        const ui = createStage(stage);

        // the countries of the lookup column: a datasource of its own
        const countries = new Datasource();
        countries.setData(COUNTRY_CODES.map((code, i) => ({ code, name: COUNTRIES[i] })));
        registerLookup('full-grid-countries', { datasource: countries, valueField: 'code', labelField: 'name' });

        let readonly = false;
        let next = 1;
        const first = makeRows(5000, next);
        next += first.length;
        const { datasource, gridInterface } = mountGrid(ui.gridHost, config(readonly), first, { key: 'id', fields: fields() });

        ui.button('Add 5 000 rows', () => {
            const rows = makeRows(5000, next);
            next += rows.length;
            datasource.setData(rows, { add: true });
        });
        ui.button('Add 50 000 rows', () => {
            const rows = makeRows(50000, next);
            next += rows.length;
            datasource.setData(rows, { add: true });
        });
        ui.button('Remove all rows', () => {
            datasource.removeAllData();
        });
        const editButton = ui.button('Editing: on', () => {
            readonly = !readonly;
            gridInterface.updateConfig({ readonly });
            editButton.textContent = readonly ? 'Editing: off' : 'Editing: on';
        });
        ui.button('Group by country, status', () => {
            datasource.group([
                { attribute: 'countryCode', title: 'Country' },
                { attribute: 'status', title: 'Status' }
            ]);
        });
        ui.button('Remove grouping', () => {
            datasource.removeGroup();
        });
        ui.button('Totals row', () => {
            gridInterface.updateConfig({ totalsRow: !gridInterface.getState().totalsRow });
        });
        // the display formats are state: a view setting of the user, kept by getState()
        ui.button('Formats: Norwegian', () => {
            gridInterface.setState({
                formats: {
                    ...gridInterface.getState().formats,
                    orderDate: { date: 'norwegian' },
                    dueDate: { date: 'daysUntil' },
                    balance: { number: { decimals: 2, thousands: ' ', decimal: ',' } },
                    kpi1: { number: { decimals: 1, decimal: ',' } }
                }
            });
        });
        ui.button('Formats: reset', () => {
            gridInterface.setState({ formats: {} });
        });
        ui.button('Undo', () => datasource.undo());
        ui.button('Redo', () => datasource.redo());
        // the API the row menu's Export › uses: getExcel() gives the .xlsx as a Blob, downloadExcel() saves it
        ui.button('Excel (all rows)', () => {
            gridInterface.downloadExcel('full-grid.xlsx');
        });
        ui.button('Excel (selected rows)', () => {
            gridInterface.downloadExcel('full-grid-selected.xlsx', { rows: 'selected', sheetName: 'Selected' });
        });
        ui.button('Show changes', () => {
            const changes = datasource.getChanges();
            window.alert(
                `${changes.modifiedEntities.length} edited, ${changes.newEntities.length} new, ${changes.deletedEntities.length} marked for deletion`
            );
        });
        ui.button('Reset changes', () => {
            datasource.resetData();
        });
    }
};
