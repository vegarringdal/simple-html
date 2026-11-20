import { type DatasourceOptions, type Formatter, TextFormatter } from '@simple-html/grid';
import { baseFields, baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

/**
 * shows a country in upper case, and stores what is typed capitalized: 'NORWAY' -> 'Norway'
 */
const upperCase: Formatter = {
    // value -> text: cells, edit input, filter, group headers
    format: (value) => TextFormatter.format(value).toUpperCase(),
    // typed text -> value to store
    parse: (text) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
    // optional: parseFilter(text) for the filter inputs (default parse),
    // and placeholder, shown in the empty header filter
};

/**
 * a variant of a built-in: spread it and replace what you need. The phone number without spaces
 */
const compactPhone: Formatter = { ...TextFormatter, format: (value) => TextFormatter.format(value).replaceAll(' ', '') };

export const customFormatter: DemoSample = {
    id: 'custom-formatter',
    title: 'Custom formatter',
    group: 'Formatting',
    description:
        'A formatter is a plain object: format turns a value into the text the grid shows - in the cell, the edit input, the filter and the group header - and parse turns what the user typed back into the value to store. Set one per field in the datasource fields. Here country shows in upper case and what you type is stored capitalized, phone shows without spaces. Log a row to see the stored values.',
    run(stage) {
        const ui = createStage(stage);

        // formatters are part of the datasource, a new one means a new datasource - and a new grid
        let mounted = mountGrid(ui.gridHost, baseGridConfig());
        const show = (options: DatasourceOptions) => {
            mounted.gridInterface.destroy();
            mounted = mountGrid(ui.gridHost, baseGridConfig(), undefined, options);
        };

        ui.button('Upper case country, compact phone', () => {
            // a formatter per field. country and phone are text fields, text is the default type
            show({ fields: { ...baseFields(), country: { formatter: upperCase }, phone: { formatter: compactPhone } } });
            ui.log('country shows upper case - type in a cell, it is stored capitalized');
        });
        ui.button('Default formatters', () => {
            show({ fields: baseFields() });
        });
        ui.button('Log a raw row', () => {
            const row = mounted.datasource.getAllData()[0];
            console.log(row);
            ui.log(`stored: country ${row.country}, phone ${row.phone}`);
            // what the grid uses for a field
            ui.log(`shown: country ${mounted.datasource.getFormatter('country').format(row.country)}`);
        });
    }
};
