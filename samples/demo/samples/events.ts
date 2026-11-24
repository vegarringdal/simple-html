import type { DatasourceEvents, GridEvents } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const events: DemoSample = {
    id: 'events',
    title: 'Event listeners',
    group: 'Events',
    description:
        'The datasource and the grid interface both have events. on(name, handler) subscribes to one event: the handler gets its payload (typed from DatasourceEvents / GridEvents), and on() returns a function that unsubscribes. Interact with the grid (click, edit, sort, filter) and watch the log.',
    run(stage) {
        const ui = createStage(stage);
        const { datasource, gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        // on(name, handler) subscribes, the handler gets the payload of the event. on() returns a
        // function that unsubscribes: const off = datasource.on('select', handler); off();

        // every event, so the log shows them all. The datasource: data, sorting, filtering,
        // grouping and selection
        const datasourceEvents: (keyof DatasourceEvents)[] = [
            'collection-changed',
            'collection-filtered',
            'collection-sorted',
            'collection-grouped',
            'collection-expand',
            'collection-collapse',
            'current-entity',
            'selection-change',
            'select',
            'validate'
        ];
        for (const type of datasourceEvents) {
            datasource.on(type, () => {
                ui.log('datasource: ' + type);
            });
        }

        // the grid interface: cell clicks and focus, copy/paste from the row menu
        const gridEvents: (keyof GridEvents)[] = [
            'grid-connected',
            'cell-click',
            'cell-dblclick',
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
