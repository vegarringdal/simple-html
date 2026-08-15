import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

const STORAGE_KEY = 'simple-html-demo-saved-layout';

export const saveLoadConfig: DemoSample = {
    id: 'save-load-config',
    title: 'Save & load layout',
    group: 'Config',
    description:
        'saveConfig() returns a plain JSON object with the current column order/widths, sorting, grouping and filter - everything the user changed. Store it anywhere and feed it back to loadConfig(). Rearrange some columns, save, mess it up, then load.',
    code: `
// captures column order/sizes, sorting, grouping, filter...
const config = gridInterface.saveConfig();
localStorage.setItem('my-grid-layout', JSON.stringify(config));

// restore later (e.g. next session)
const saved = localStorage.getItem('my-grid-layout');
if (saved) {
    gridInterface.loadConfig(JSON.parse(saved));
}

// or go back to the config you started with
gridInterface.loadConfig(initialConfig);
`,
    run(stage) {
        const ui = createStage(stage);
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        ui.button('Save layout', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(gridInterface.saveConfig()));
            ui.log('layout saved to localStorage');
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
        ui.button('Reset to initial config', () => {
            gridInterface.loadConfig(baseGridConfig());
            ui.log('initial config loaded');
        });
    }
};
