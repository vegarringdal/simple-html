// a column's `aggregate` sums it up in each group row and in the totals row under the rows. The
// datasource computes the values - datasource.aggregate() - and the grid shows them, formatted with
// the field's formatter, updated on every edit, undo, filter and upsert
import {
    createGrid,
    Datasource,
    type Formatter,
    type GridConfig,
    NumberFormatterDot,
    registerFormatter,
    where
} from '@simple-html/grid';
import { COMPANIES, COUNTRIES, createStage, type DemoSample } from '../demoUtils';

interface Account {
    id: number;
    company: string;
    country: string;
    email: string | null;
    age: number;
    balance: number | null;
}

/**
 * the aggregates are not rounded, the formatter shows them: money with two decimals and spaces
 * between the thousands, 1234567.8 -> '1 234 567.80'
 */
const money: Formatter = {
    ...NumberFormatterDot,
    format: (value) => (typeof value === 'number' ? value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''),
    parse: (text) => NumberFormatterDot.parse(text.replaceAll(' ', ''))
};

/**
 * a whole number as it is, the average of the ages with one decimal: 34 -> '34', 34.567 -> '34.6'
 */
const oneDecimal: Formatter = {
    ...NumberFormatterDot,
    format: (value) => (typeof value === 'number' ? (Number.isInteger(value) ? String(value) : value.toFixed(1)) : '')
};

// ids of its own: the registry is one for the page, and the formatters sample has a 'money' too
registerFormatter('moneyDot', money);
registerFormatter('oneDecimal', oneDecimal);

/**
 * deterministic rows: some without an email, some without a balance
 */
function accounts(count: number): Account[] {
    let seed = 7;
    const rnd = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };
    return Array.from({ length: count }, (_, i) => {
        const company = COMPANIES[Math.floor(rnd() * COMPANIES.length)];
        return {
            id: i + 1,
            company,
            country: COUNTRIES[Math.floor(rnd() * COUNTRIES.length)],
            email: rnd() > 0.3 ? `${company.toLowerCase().replaceAll(' ', '.')}.${i + 1}@example.com` : null,
            age: 20 + Math.floor(rnd() * 45),
            balance: rnd() > 0.1 ? Math.round(rnd() * 5_000_000) / 100 : null
        };
    });
}

export const aggregates: DemoSample = {
    id: 'aggregates',
    title: 'Aggregates',
    group: 'Datasource',
    description:
        "A column's aggregate (sum, avg, min, max or count) is shown in its place in every group row, over the group's rows - collapsed ones included - and in the totals row under the rows (totalsRow: true), over the rows the filter lets through. Here: count of emails, average age, sum and average of balances, grouped by country. Right click a column label to turn them on and off. Edit a balance, undo it (Ctrl+Z), filter, or start the live updates: the group rows and the totals follow. Scroll sideways: the totals row follows the columns.",
    run(stage) {
        const ui = createStage(stage);

        const datasource = new Datasource<Account>({
            key: 'id',
            fields: {
                age: { type: 'number', formatter: 'oneDecimal' },
                balance: { type: 'number', formatter: 'moneyDot' }
            }
        });
        datasource.setData(accounts(400));

        const config: GridConfig = {
            readonly: false,
            columns: {
                id: { readonly: true },
                email: { aggregate: 'count' },
                age: { aggregate: 'avg' },
                balance: { aggregate: ['sum', 'avg'] }
            },
            layout: {
                left: [{ fields: ['company'], width: 170 }],
                center: [
                    { fields: ['country'], width: 110 },
                    { fields: ['age'], width: 90 },
                    { fields: ['balance'], width: 150 },
                    { fields: ['id'], width: 70 }
                ],
                right: [{ fields: ['email'], width: 230 }]
            },
            // the totals row is off by default, the group rows show the aggregates by default
            totalsRow: true,
            initialState: {
                grouping: [{ attribute: 'country', title: 'Country' }],
                expandedGroups: ['Norway']
            }
        };
        const gridInterface = createGrid(ui.gridHost, { config, datasource });

        ui.button('Log the totals', () => {
            // the same numbers from code: the rows the filter lets through, or a group's rows
            const sum = datasource.aggregate('balance', 'sum');
            ui.log(`balance sum ${money.format(sum)}, average age ${oneDecimal.format(datasource.aggregate('age', 'avg'))}`);
        });
        ui.button('Balances +10% (from code)', () => {
            // values set from code: the group rows and the totals show them in the next frame
            for (const row of datasource.getDataRows()) {
                if (row.balance !== null) {
                    row.balance = Math.round(row.balance * 110) / 100;
                }
            }
        });
        ui.button('Filter: age >= 40', () => {
            datasource.filter(where('age', 'GREATER_THAN_OR_EQUAL_TO', 40));
        });
        ui.button('No filter', () => {
            datasource.filter(null);
        });

        // a server pushes new balances every second: upsert() merges them by key
        let timer: ReturnType<typeof setInterval> | null = null;
        const liveButton = ui.button('Start live updates', () => {
            if (timer) {
                clearInterval(timer);
                timer = null;
                liveButton.textContent = 'Start live updates';
                return;
            }
            liveButton.textContent = 'Stop live updates';
            timer = setInterval(() => {
                // the sample's page was left
                if (!stage.isConnected && timer) {
                    clearInterval(timer);
                    return;
                }
                const rows = datasource.getAllData();
                const changes = Array.from({ length: 20 }, () => {
                    const row = rows[Math.floor(Math.random() * rows.length)];
                    return { id: row.id, balance: Math.round(Math.random() * 5_000_000) / 100 };
                });
                datasource.upsert(changes);
            }, 1000);
        });

        let totalsRow = true;
        ui.button('Totals row on/off', () => {
            totalsRow = !totalsRow;
            gridInterface.updateConfig({ totalsRow });
        });
        let groupAggregates = true;
        ui.button('Group row aggregates on/off', () => {
            groupAggregates = !groupAggregates;
            gridInterface.updateConfig({ groupAggregates });
        });
    }
};
