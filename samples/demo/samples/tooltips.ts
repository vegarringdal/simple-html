import { TOOLTIPS } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid, reconfigure } from '../demoUtils';

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

// the texts are config: to change them later, connect a new interface with the changed
// config, started in the state the old one is in
const next = new GridInterface(
    { ...gridConfig, tooltipText: { 'filterEditor.close': 'Lukk' }, initialState: gridInterface.getState() },
    datasource
);
element.connectInterface(next);
`,
    run(stage) {
        const ui = createStage(stage);
        const config = baseGridConfig();
        const { element, gridInterface: first } = mountGrid(ui.gridHost, config);
        let gridInterface = first;

        ui.button('Open filter editor (hover the buttons)', () => {
            gridInterface.openFilterEditor();
        });
        ui.button('Norwegian texts', () => {
            config.tooltipText = {
                'filterEditor.addCondition': 'Legg til betingelse',
                'filterEditor.addSubGroup': 'Legg til undergruppe',
                'filterEditor.clearAll': 'Fjern alle betingelser',
                'filterEditor.close': 'Lukk uten filtrering',
                'filterEditor.filterAndClose': 'Filtrer og lukk',
                'filterEditor.deleteCondition': 'Slett betingelsen'
            };
            gridInterface = reconfigure(element, gridInterface, config);
            ui.log('open the filter editor and hover its buttons');
        });
        ui.button('Default texts', () => {
            config.tooltipText = {};
            gridInterface = reconfigure(element, gridInterface, config);
        });
        ui.button('Disable built-in tooltips', () => {
            config.tooltips = false;
            gridInterface = reconfigure(element, gridInterface, config);
            ui.log('tooltips off - data-tooltip attributes are still written for your own library');
        });
        ui.button('Enable built-in tooltips', () => {
            config.tooltips = true;
            gridInterface = reconfigure(element, gridInterface, config);
        });
        ui.button('Log TOOLTIPS ids', () => {
            console.log(TOOLTIPS);
            ui.log(Object.keys(TOOLTIPS).join(', '));
        });
    }
};
