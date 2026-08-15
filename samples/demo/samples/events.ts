import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const events: DemoSample = {
    id: 'events',
    title: 'Event listeners',
    group: 'Events',
    description:
        'Both the datasource and the grid interface accept event listeners. The listener gets { type, data } and must return true to stay subscribed. Interact with the grid (click, edit, sort, filter) and watch the log.',
    code: `
const listener = {
    handleEvent: (e) => {
        console.log(e.type, e.data);
        return true; // return true to keep subscribing
    }
};

// selection/sorting/filtering/data events
datasource.addEventListener(listener);

// cell clicks, edits, column events etc
gridInterface.addEventListener(listener);

// later
datasource.removeEventListener(listener);
gridInterface.removeEventListener(listener);
`,
    run(stage) {
        const ui = createStage(stage);
        const { datasource, gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        datasource.addEventListener({
            handleEvent: (e: any) => {
                ui.log('datasource: ' + e.type);
                return true;
            }
        });

        gridInterface.addEventListener({
            handleEvent: (e: any) => {
                ui.log('gridInterface: ' + e.type + (e.data?.attribute ? ' (' + e.data.attribute + ')' : ''));
                return true;
            }
        });

        ui.log('interact with the grid to see events...');
    }
};
