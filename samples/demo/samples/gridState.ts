import { and, type GridConfig, type GridState, where } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

const STORAGE_KEY = 'simple-html-demo-saved-state';

export const gridState: DemoSample = {
    id: 'grid-state',
    title: 'Save & restore state',
    group: 'Config',
    description:
        'The config is what you write, the state is what the user changes: column order, pinning and widths, sorting, grouping, expanded groups, the filter and what the header filters show. getState() returns a copy of it as plain data - store it anywhere and give it back to setState(). setState() applies the parts it is given and keeps the rest. initialState in the config is the state the grid starts in, and resetState() goes back to it. Rearrange some columns, sort, filter, save, mess it up, then restore.',
    run(stage) {
        const ui = createStage(stage);
        const config: GridConfig = {
            ...baseGridConfig(),
            // the state the grid starts in, and resetState() goes back to
            initialState: { sorting: [{ attribute: 'company', ascending: true }] }
        };
        const { gridInterface } = mountGrid(ui.gridHost, config);

        ui.button('Save state', () => {
            // column order/pinning/widths, sorting, grouping, expanded groups, filter, header filters.
            // state.filter is what datasource.getFilter() returns
            const state = gridInterface.getState();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            ui.log(`state saved to localStorage, filter: ${JSON.stringify(state.filter)}`);
        });
        ui.button('Restore state', () => {
            const saved: GridState | null = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
            if (saved) {
                gridInterface.setState(saved);
                ui.log('state restored');
            } else {
                ui.log('nothing saved yet - click "Save state" first');
            }
        });
        ui.button('Set a filter', () => {
            // only some parts, the rest stays as it is.
            // headerFilters: what the header filter cells show
            gridInterface.setState({
                filter: and(where('country', 'EQUAL', 'Norway'), where('age', 'LESS_THAN', 30)),
                headerFilters: { country: { value: 'Norway' }, age: { value: 30, operator: 'LESS_THAN' } }
            });
            ui.log('filter set: Norway AND age < 30, the rest of the state is kept');
        });
        ui.button('Reset state', () => {
            // back to initialState and the config's layout
            gridInterface.resetState();
            ui.log('back to initialState: sorted on company, the config layout, no filter');
        });
        ui.button('Log state', () => {
            ui.log(JSON.stringify(gridInterface.getState()));
        });
    }
};
