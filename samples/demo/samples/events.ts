import type { DatasourceEvents, GridEvents } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const events: DemoSample = {
    id: 'events',
    title: 'Event listeners',
    group: 'Events',
    description:
        'The datasource and the grid interface both have events. on(name, handler) subscribes to one event: the handler gets its payload (typed from DatasourceEvents / GridEvents), and on() returns a function that unsubscribes. Interact with the grid (click, edit, sort, filter) and watch the log.',
    code: `
// datasource: data, sorting, filtering, grouping and selection
const off = datasource.on('collection-filtered', (data) => {
    console.log('filtered by', data.info, '-', datasource.length(true), 'rows');
});

datasource.on('selection-change', () => {
    console.log(datasource.getSelectedRows().length, 'rows selected');
});

// grid interface: cell clicks and focus, copy/paste from the row menu
gridInterface.on('cell-click', (data) => {
    console.log('clicked', data.attribute, 'in row', data.row, data.rowData);
});

// the handler stays subscribed until you call what on() returned
off();
`,
    run(stage) {
        const ui = createStage(stage);
        const { datasource, gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        // every event, so the log shows them all
        const datasourceEvents: (keyof DatasourceEvents)[] = [
            'collection-changed',
            'collection-filtered',
            'collection-sorted',
            'collection-grouped',
            'collection-expand',
            'collection-collapse',
            'current-entity',
            'selection-change',
            'select'
        ];
        for (const type of datasourceEvents) {
            datasource.on(type, () => {
                ui.log('datasource: ' + type);
            });
        }

        const gridEvents: (keyof GridEvents)[] = [
            'grid-connected',
            'cell-click',
            'cell-row-focus',
            'cell-focus-button-click',
            'cell-header-focus',
            'filter-operator-change',
            'paste',
            'clear',
            'copy-cell',
            'copy-column',
            'copy-row',
            'copy-row-col'
        ];
        for (const type of gridEvents) {
            gridInterface.on(type, (data) => {
                const attribute = 'attribute' in data ? ' (' + data.attribute + ')' : '';
                ui.log('gridInterface: ' + type + attribute);
            });
        }

        ui.log('interact with the grid to see events...');
    }
};
