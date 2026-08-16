import { TOOLTIPS } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const tooltips: DemoSample = {
    id: 'tooltips',
    title: 'Tooltips',
    group: 'Config',
    description:
        'The grid renders a built-in tooltip on buttons/icons (open the filter editor and hover its buttons). Override any text via tooltipText keyed by the TOOLTIPS ids - handy for translations - or set tooltips: false and hook up your own library: the data-tooltip attribute is always written to the elements either way.',
    code: `
import { TOOLTIPS } from '@simple-html/grid';

// all ids + default texts
console.log(TOOLTIPS);

const gridConfig: GridConfig = {
    tooltips: true, // default - set false to not render the built in tooltip
    tooltipText: {
        // override by id, e.g. Norwegian:
        'filterEditor.addCondition': 'Legg til betingelse',
        'filterEditor.clearAll': 'Fjern alle betingelser',
        'filterEditor.close': 'Lukk uten filtrering',
        'filterEditor.filterAndClose': 'Filtrer og lukk'
    },
    ...
};

// even with tooltips: false, data-tooltip is written to the elements,
// so you can wire up your own tooltip library instead
`,
    run(stage) {
        const ui = createStage(stage);
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        ui.button('Open filter editor (hover the buttons)', () => {
            gridInterface.openFilterEditor();
        });
        ui.button('Norwegian texts', () => {
            const config = gridInterface.saveConfig();
            config.tooltipText = {
                'filterEditor.addCondition': 'Legg til betingelse',
                'filterEditor.addSubGroup': 'Legg til undergruppe',
                'filterEditor.clearAll': 'Fjern alle betingelser',
                'filterEditor.close': 'Lukk uten filtrering',
                'filterEditor.filterAndClose': 'Filtrer og lukk',
                'filterEditor.deleteCondition': 'Slett betingelsen'
            };
            gridInterface.loadConfig(config);
            ui.log('open the filter editor and hover its buttons');
        });
        ui.button('Default texts', () => {
            const config = gridInterface.saveConfig();
            config.tooltipText = {};
            gridInterface.loadConfig(config);
        });
        ui.button('Disable built-in tooltips', () => {
            const config = gridInterface.saveConfig();
            config.tooltips = false;
            gridInterface.loadConfig(config);
            ui.log('tooltips off - data-tooltip attributes are still written for your own library');
        });
        ui.button('Enable built-in tooltips', () => {
            const config = gridInterface.saveConfig();
            config.tooltips = true;
            gridInterface.loadConfig(config);
        });
        ui.button('Log TOOLTIPS ids', () => {
            console.log(TOOLTIPS);
            ui.log(Object.keys(TOOLTIPS).join(', '));
        });
    }
};
