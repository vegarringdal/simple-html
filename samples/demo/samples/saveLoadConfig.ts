import { and, where } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

const STORAGE_KEY = 'simple-html-demo-saved-layout';

export const saveLoadConfig: DemoSample = {
    id: 'save-load-config',
    title: 'Save & load layout',
    group: 'Config',
    description:
        'saveConfig() returns a plain JSON object with the current column order/widths, sorting, grouping and filter - everything the user changed. Store it anywhere and feed it back to loadConfig(). The filter is the datasource filter, the same format datasource.filter() takes, so a config can come with a filter of its own. Rearrange some columns, filter, save, mess it up, then load.',
    code: `
import { and, where } from '@simple-html/grid';

// captures column order/sizes, sorting, grouping, filter...
const config = gridInterface.saveConfig();
localStorage.setItem('my-grid-layout', JSON.stringify(config));

// config.filter is what datasource.getFilter() returns:
// { group: 'AND', children: [{ field: 'country', operator: 'EQUAL', value: 'Norway' }] }, or null

// restore later (e.g. next session)
const saved = localStorage.getItem('my-grid-layout');
if (saved) {
    gridInterface.loadConfig(JSON.parse(saved));
}

// a config with a filter of its own
gridInterface.loadConfig({
    ...initialConfig,
    filter: and(where('country', 'EQUAL', 'Norway'), where('age', 'LESS_THAN', 30))
});

// or go back to the config you started with
gridInterface.loadConfig(initialConfig);
`,
    run(stage) {
        const ui = createStage(stage);
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        ui.button('Save layout', () => {
            const config = gridInterface.saveConfig();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
            ui.log(`layout saved to localStorage, filter: ${JSON.stringify(config.filter)}`);
        });
        ui.button('Load layout', () => {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                gridInterface.loadConfig(JSON.parse(saved));
                ui.log('layout loaded');
            } else {
                ui.log('nothing saved yet - click "Save layout" first');
            }
        });
        ui.button('Load with a filter', () => {
            gridInterface.loadConfig({
                ...baseGridConfig(),
                filter: and(where('country', 'EQUAL', 'Norway'), where('age', 'LESS_THAN', 30))
            });
            ui.log('initial config loaded, with the filter Norway AND age < 30');
        });
        ui.button('Reset to initial config', () => {
            gridInterface.loadConfig(baseGridConfig());
            ui.log('initial config loaded');
        });
    }
};
