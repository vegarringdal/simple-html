// built in: NumberFormatterDot 1234.56 (the default for number), NumberFormatterComma 1234,56,
// DateFormatterYYYYMMDD 2026-12-31 (the default for date), DateFormatterDDMMYYYY 31.12.2026
import { type DatasourceOptions, DateFormatterDDMMYYYY, type Formatter, NumberFormatterComma } from '@simple-html/grid';
import { baseFields, baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

/**
 * your own: an object with format (value -> text) and parse (typed text -> value).
 * Two decimals, comma, space as thousand separator. 12345.6 -> '12 345,60'
 */
const money: Formatter = {
    format: (value) =>
        typeof value === 'number'
            ? value
                  .toFixed(2)
                  .replace('.', ',')
                  .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
            : '',
    // take the spaces out, then the built-in parser: '12 345,60' -> 12345.6
    parse: (text) => NumberFormatterComma.parse(text.replaceAll(' ', ''))
};

export const formatters: DemoSample = {
    id: 'formatters',
    title: 'Number & date formatters',
    group: 'Formatting',
    description:
        'Every field of the datasource has a formatter: format turns a value into the text the grid shows, parse turns typed text back into a value. A field gets the default formatter of its type, unless it has its own. Change the default of a type with the formatters option. Formatters are set when the datasource is made, so the buttons build the grid again - watch the balance and date columns.',
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
            show({ fields: baseFields(), formatters: { number: NumberFormatterComma, date: DateFormatterDDMMYYYY } });
        });
        ui.button('Only balance comma', () => {
            // or one field
            show({ fields: { ...baseFields(), balance: { type: 'number', formatter: NumberFormatterComma } } });
        });
        ui.button('Balance custom (12 345,60)', () => {
            show({ fields: { ...baseFields(), balance: { type: 'number', formatter: money } } });
        });
    }
};
