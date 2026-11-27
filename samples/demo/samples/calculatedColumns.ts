// calculated columns: a column whose value a formula computes from the other fields of the row - the
// total of an order, the days it is late. Read only, sorted, filtered, grouped, summed, coloured and
// exported like any column; the user adds and changes them in the grid config dialog (the gear). The
// colour rules can look at several fields, or be a formula
import { createGrid, Datasource, type GridConfig } from '@simple-html/grid';
import { COMPANIES, createStage, type DemoSample } from '../demoUtils';

interface Order {
    id: number;
    customer: string;
    price: number;
    qty: number;
    due: Date;
    status: 'open' | 'done' | 'waiting';
}

const STATUSES: Order['status'][] = ['open', 'done', 'waiting'];

/**
 * deterministic orders, due from three weeks ago to three weeks from today
 */
function orders(count: number): Order[] {
    let seed = 11;
    const rnd = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };
    const today = new Date();
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        customer: COMPANIES[Math.floor(rnd() * COMPANIES.length)],
        price: Math.round(rnd() * 50_000) / 100,
        qty: 1 + Math.floor(rnd() * 20),
        due: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 21 + Math.floor(rnd() * 42)),
        status: STATUSES[Math.floor(rnd() * STATUSES.length)]
    }));
}

export const calculatedColumns: DemoSample = {
    id: 'calculated-columns',
    title: 'Calculated columns',
    group: 'Formatting',
    description:
        'Total ({price} * {qty}) and Days late (a formula with IF, MAX, DAYS and TODAY) are calculated columns: computed from the row each time they are read, never stored - an edit of a price updates the total, undo too, and they are not in getChanges(). Sort, filter, group or sum them as any column. The colour rules: Days late on its value, Customer on two fields (late and a total over 2000), Total on a formula with a custom colour. Open the gear, Columns tab, to add your own with Add calculated column.',
    run(stage) {
        const ui = createStage(stage);

        const datasource = new Datasource<Order>({
            key: 'id',
            fields: { id: 'number', price: 'number', qty: 'number', due: 'date' }
        });
        datasource.setData(orders(300));

        const config: GridConfig = {
            readonly: false,
            calculatedColumns: {
                total: { formula: '{price} * {qty}', label: 'Total' },
                daysLate: { formula: 'IF({status} = "done", 0, MAX(0, DAYS({due}, TODAY())))', label: 'Days late' }
            },
            columns: {
                id: { readonly: true },
                customer: {
                    label: 'Customer',
                    format: {
                        rules: [
                            {
                                conditions: [
                                    { field: 'daysLate', operator: 'GREATER_THAN', value: '0' },
                                    { field: 'total', operator: 'GREATER_THAN', value: '2000' }
                                ],
                                color: 'red',
                                bold: true
                            }
                        ]
                    }
                },
                total: {
                    aggregate: 'sum',
                    format: {
                        number: { decimals: 2 },
                        rules: [{ expression: '{qty} >= 15 AND {status} = "waiting"', background: '#c4b5fd' }]
                    }
                },
                daysLate: {
                    aggregate: 'max',
                    format: {
                        rules: [
                            { operator: 'GREATER_THAN', value: '7', background: 'red' },
                            { operator: 'GREATER_THAN', value: '0', background: 'amber' }
                        ]
                    }
                }
            },
            layout: {
                left: [{ fields: ['customer'], width: 160 }],
                center: [
                    { fields: ['price'], width: 90 },
                    { fields: ['qty'], width: 60 },
                    { fields: ['total'], width: 110 },
                    { fields: ['due'], width: 100 },
                    { fields: ['status'], width: 90 },
                    { fields: ['daysLate'], width: 90 },
                    { fields: ['id'], width: 60 }
                ]
            },
            totalsRow: true,
            initialState: { sorting: [{ attribute: 'daysLate', ascending: false }] }
        };
        const gridInterface = createGrid(ui.gridHost, { config, datasource });

        ui.button('Prices +10% (from code)', () => {
            // the totals follow: they are computed from the price each time they are read
            for (const row of datasource.getDataRows()) {
                row.price = Math.round(row.price * 110) / 100;
            }
        });
        ui.button('Undo', () => datasource.undo());
        ui.button('Log changes', () => {
            // the calculated columns are never an edit: only the prices are sent
            const { modifiedEntities } = datasource.getChanges();
            ui.log(`${modifiedEntities.length} rows changed, e.g. ${JSON.stringify(modifiedEntities[0] ?? null)}`);
        });
        ui.button('Log calculated columns', () => {
            ui.log(JSON.stringify(gridInterface.getState().calculatedColumns));
        });
        ui.button('Open the grid config dialog', () => gridInterface.openColumnSettings('total'));
    }
};
