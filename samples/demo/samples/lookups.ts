import { Datasource, type GridConfig, registerLookup } from '@simple-html/grid';
import { COMPANIES, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

const COUNTRY_CODES = [
    { code: 'NO', name: 'Norway' },
    { code: 'SE', name: 'Sweden' },
    { code: 'DK', name: 'Denmark' },
    { code: 'FI', name: 'Finland' },
    { code: 'IS', name: 'Iceland' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'ES', name: 'Spain' },
    { code: 'IT', name: 'Italy' },
    { code: 'PT', name: 'Portugal' }
];

const CITIES = ['Oslo', 'Bergen', 'Stockholm', 'Copenhagen', 'Helsinki'];

export const lookups: DemoSample = {
    id: 'lookups',
    title: 'Lookups: select and dropdown grid',
    group: 'Editing',
    description:
        'Three columns pick their value from a lookup (registerLookup). Country stores a code (NO) and shows the name (Norway): a select with a search on top. Customer stores the customer id and shows the name: a dropdown grid of the customers, and picking one also copies its name and city into the row (set) - one undo step, Ctrl+Z. Product is a select over 10 000 products: it shows the first 500, the search finds the rest. Open a list with the button at the right of the cell, Alt+ArrowDown, F4, Space, or by typing; Delete empties the cell. Sorting a lookup column sorts on the names, its header filter finds the names (type nor in Country), the CSV export writes the names.',
    run(stage) {
        const ui = createStage(stage);

        // the lookups: a datasource each, registered once when the page loads
        const countries = new Datasource();
        countries.setData(COUNTRY_CODES);
        registerLookup('countries', { datasource: countries, valueField: 'code', labelField: 'name' });

        const customers = new Datasource({ fields: { id: 'number' } });
        customers.setData(
            Array.from({ length: 60 }, (_, i) => ({
                id: 1001 + i,
                name: `${COMPANIES[i % COMPANIES.length]} ${Math.floor(i / COMPANIES.length) + 1}`,
                city: CITIES[i % CITIES.length]
            }))
        );
        registerLookup('customers', {
            datasource: customers,
            valueField: 'id',
            labelField: 'name',
            config: {
                layout: {
                    center: [
                        { fields: ['id'], width: 60 },
                        { fields: ['name'], width: 190 },
                        { fields: ['city'], width: 110 }
                    ]
                }
            }
        });

        const products = new Datasource();
        products.setData(
            Array.from({ length: 10_000 }, (_, i) => ({ sku: `P${String(i + 1).padStart(5, '0')}`, name: `Product ${i + 1}` }))
        );
        registerLookup('products', { datasource: products, valueField: 'sku', labelField: 'name' });

        // the config names the lookups by id: plain JSON
        const config: GridConfig = {
            readonly: false,
            columns: {
                countryCode: { label: 'Country', editor: { type: 'select', lookup: 'countries' } },
                customerId: {
                    label: 'Customer',
                    editor: { type: 'grid', lookup: 'customers', set: { customerName: 'name', customerCity: 'city' } }
                },
                customerName: { label: 'Customer name', readonly: true },
                customerCity: { label: 'City', readonly: true },
                product: { label: 'Product', editor: { type: 'select', lookup: 'products' } }
            },
            layout: {
                center: [
                    { fields: ['countryCode'], width: 120 },
                    { fields: ['customerId'], width: 170 },
                    { fields: ['customerName'], width: 170 },
                    { fields: ['customerCity'], width: 100 },
                    { fields: ['product'], width: 140 },
                    { fields: ['age'], width: 70 }
                ]
            }
        };

        const rows = generateRows(200).map((row, i) => {
            const customer = customers.getAllData()[(i * 7) % 60];
            return {
                age: row.age,
                countryCode: COUNTRY_CODES[i % COUNTRY_CODES.length].code,
                customerId: customer.id,
                customerName: customer.name,
                customerCity: customer.city,
                product: `P${String((i * 37) % 10_000 + 1).padStart(5, '0')}`
            };
        });
        const { datasource, gridInterface } = mountGrid(ui.gridHost, config, rows, {
            fields: { age: 'number', customerId: 'number' }
        });

        datasource.on('rows-changed', ({ rows: changed, fields }) => {
            for (const row of changed) {
                ui.log(`${[...(fields.get(row) ?? [])].join(', ')}: ${row.countryCode} / ${row.customerId} ${row.customerName} / ${row.product}`);
            }
        });

        let readonly = false;
        ui.button('Toggle readonly', () => {
            readonly = !readonly;
            gridInterface.updateConfig({ readonly });
            ui.log(`grid readonly: ${readonly}`);
        });
        ui.button('Undo', () => datasource.undo());
        ui.button('CSV of the first rows', () => {
            ui.log(gridInterface.getCsv().split('\n').slice(0, 3).join(' | '));
        });
    }
};
