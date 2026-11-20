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

// change the texts later: tooltipText is replaced as a whole
gridInterface.updateConfig({ tooltipText: { 'filterEditor.close': 'Lukk' } });
gridInterface.updateConfig({ tooltips: false });
`,
    run(stage) {
        const ui = createStage(stage);
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        ui.button('Open filter editor (hover the buttons)', () => {
            gridInterface.openFilterEditor();
        });
        ui.button('Norwegian texts', () => {
            gridInterface.updateConfig({
                tooltipText: {
                    'filterEditor.addCondition': 'Legg til betingelse',
                    'filterEditor.addSubGroup': 'Legg til undergruppe',
                    'filterEditor.clearAll': 'Fjern alle betingelser',
                    'filterEditor.close': 'Lukk uten filtrering',
                    'filterEditor.filterAndClose': 'Filtrer og lukk',
                    'filterEditor.deleteCondition': 'Slett betingelsen'
                }
            });
            ui.log('open the filter editor and hover its buttons');
        });
        ui.button('Default texts', () => {
            gridInterface.updateConfig({ tooltipText: undefined });
        });
        ui.button('Disable built-in tooltips', () => {
            gridInterface.updateConfig({ tooltips: false });
            ui.log('tooltips off - data-tooltip attributes are still written for your own library');
        });
        ui.button('Enable built-in tooltips', () => {
            gridInterface.updateConfig({ tooltips: true });
        });
        ui.button('Log TOOLTIPS ids', () => {
            console.log(TOOLTIPS);
            ui.log(Object.keys(TOOLTIPS).join(', '));
        });
    }
};
