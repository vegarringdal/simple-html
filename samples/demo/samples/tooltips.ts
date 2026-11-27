import { TEXTS } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const tooltips: DemoSample = {
    id: 'tooltips',
    title: 'Tooltips',
    group: 'Config',
    description:
        'The grid renders a built-in tooltip on buttons/icons (open the filter editor and hover its buttons). The tooltips are texts like the others: their ids end with .tooltip, change them with texts in the config (one grid) or setTexts() (the page) - see the Translation sample. Or set tooltips: false and hook up your own library: the data-tooltip attribute is always written to the elements either way.',
    run(stage) {
        const ui = createStage(stage);
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        ui.button('Open filter editor (hover the buttons)', () => {
            gridInterface.openFilterEditor();
        });
        ui.button('Norwegian tooltips', () => {
            // a text by its id: a tooltip's id ends with .tooltip. texts is replaced as a whole
            gridInterface.updateConfig({
                texts: {
                    'filterEditor.addCondition.tooltip': 'Legg til betingelse',
                    'filterEditor.addSubGroup.tooltip': 'Legg til undergruppe',
                    'filterEditor.clearAll.tooltip': 'Fjern alle betingelser',
                    'filterEditor.close.tooltip': 'Lukk uten filtrering',
                    'filterEditor.filterAndClose.tooltip': 'Filtrer og lukk',
                    'filterEditor.deleteCondition.tooltip': 'Slett betingelsen'
                }
            });
            ui.log('open the filter editor and hover its buttons');
        });
        ui.button('Default texts', () => {
            gridInterface.updateConfig({ texts: undefined });
        });
        // even with tooltips: false, data-tooltip is written to the elements,
        // so you can wire up your own tooltip library instead
        ui.button('Disable built-in tooltips', () => {
            gridInterface.updateConfig({ tooltips: false });
            ui.log('tooltips off - data-tooltip attributes are still written for your own library');
        });
        ui.button('Enable built-in tooltips', () => {
            gridInterface.updateConfig({ tooltips: true });
        });
        ui.button('Log the tooltip ids', () => {
            // TEXTS has every text by id, the tooltips end with .tooltip
            const ids = Object.keys(TEXTS).filter((id) => id.endsWith('.tooltip'));
            console.log(ids);
            ui.log(ids.join(', '));
        });
    }
};
