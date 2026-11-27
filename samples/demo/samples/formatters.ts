// built in, by id: 'numberDot' 1234.56 (the default for number), 'numberComma' 1234,56,
// 'dateYYYYMMDD' 2026-12-31 (the default for date), 'dateDDMMYYYY' 31.12.2026
import { type DatasourceOptions, type Formatter, NumberFormatterComma, registerFormatter } from '@simple-html/grid';
import { baseFields, baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

/**
 * your own: an object with format (value -> text) and parse (typed text -> value).
 * Two decimals, comma, space as thousand separator. 12345.6 -> '12 345,60'. While a cell is edited it
 * shows formatForEdit: the plain number, '12345,6' - no spaces to type around
 */
const money: Formatter = {
    format: (value) =>
        typeof value === 'number'
            ? value
                  .toFixed(2)
                  .replace('.', ',')
                  .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
            : '',
    formatForEdit: (value) => NumberFormatterComma.format(value),
    // take the spaces out, then the built-in parser: '12 345,60' -> 12345.6
    parse: (text) => NumberFormatterComma.parse(text.replaceAll(' ', ''))
};
// the options name it by its id: register it before a datasource does
registerFormatter('money', money);

export const formatters: DemoSample = {
    id: 'formatters',
    title: 'Number & date formatters',
    group: 'Formatting',
    description:
        'Every field of the datasource has a formatter: format turns a value into the text the grid shows, parse turns typed text back into a value. A field gets the default formatter of its type, unless it has its own. Change the default of a type with the formatters option. The options name a formatter by its id - the built-ins are registered, registerFormatter() adds your own - so they are plain JSON. Formatters are set when the datasource is made, so the buttons build the grid again - watch the balance and date columns.',
    run(stage) {
        const ui = createStage(stage);

        // formatters are part of the datasource, a new one means a new datasource
        const show = (options: DatasourceOptions) => {
            ui.gridHost.replaceChildren();
            mountGrid(ui.gridHost, baseGridConfig(), undefined, options);
        };

        show({ fields: baseFields() });

        ui.button('Defaults (1234.56, 2026-12-31)', () => {
            show({ fields: baseFields() });
        });
        ui.button('All numbers comma, all dates DD.MM.YYYY', () => {
            // the default formatter of a type, for every field of that type
            show({ fields: baseFields(), formatters: { number: 'numberComma', date: 'dateDDMMYYYY' } });
        });
        ui.button('Only balance comma', () => {
            // or one field
            show({ fields: { ...baseFields(), balance: { type: 'number', formatter: 'numberComma' } } });
        });
        ui.button('Balance custom (12 345,60)', () => {
            // your own, registered above
            show({ fields: { ...baseFields(), balance: { type: 'number', formatter: 'money' } } });
        });
    }
};
