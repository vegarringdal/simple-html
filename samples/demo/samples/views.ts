import { and, type GridConfig, type GridView, where } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

/** where the grid keeps the user's views: GridConfig.viewsStorageKey */
const STORAGE_KEY = 'simple-html-demo-views';

/**
 * Views of the app's, shared with every user: readonly - the user applies them, and can save one as a
 * view of their own, not change it. Plain JSON, the parts a view leaves out are the config's state
 */
const SHARED_VIEWS: GridView[] = [
    {
        id: 'nordic-active',
        name: 'Active in Norway',
        readonly: true,
        state: {
            filter: and(where('country', 'EQUAL', 'Norway'), where('isActive', 'EQUAL', true)),
            headerFilters: { country: { value: 'Norway' }, isActive: { value: true } },
            sorting: [{ attribute: 'balance', ascending: false }]
        }
    },
    {
        id: 'by-country',
        name: 'By country, compact',
        readonly: true,
        state: {
            grouping: [{ attribute: 'country', title: 'Country' }],
            layout: {
                center: [
                    { fields: ['company'], width: 170 },
                    { fields: ['age'], width: 70 },
                    { fields: ['balance'], width: 100 }
                ]
            },
            aggregates: { balance: ['sum'] }
        }
    }
];

export const views: DemoSample = {
    id: 'views',
    title: 'Named views',
    group: 'Config',
    description:
        'Views are named snapshots of the state - columns, widths, filters, sorting, grouping, formats. The button at the left end of the footer shows the view shown, a * when you changed it: click it to switch views, Save, Save as new view…, Revert changes, Rename…, Delete or make one the Default view, the one the grid opens with. The two shared views are readonly. viewsStorageKey keeps your own views in localStorage: reload the page and they are there. views-change sends the list for a backend.',
    run(stage) {
        const ui = createStage(stage);
        const config: GridConfig = {
            ...baseGridConfig(),
            // the views of the app, and the user's own kept in localStorage under the key
            views: SHARED_VIEWS,
            viewsStorageKey: STORAGE_KEY
        };
        const { gridInterface } = mountGrid(ui.gridHost, config);

        // the list changed - saved, renamed, deleted, a default picked: store it (here localStorage does)
        gridInterface.on('views-change', ({ views }) => {
            ui.log(`views-change: ${views.map((view) => `${view.name}${view.default ? ' (default)' : ''}`).join(', ')}`);
        });

        // the same as the menu, from code
        ui.button('Apply "Active in Norway"', () => gridInterface.applyView('nordic-active'));
        ui.button('Save as "Over 40"', () => {
            gridInterface.setState({
                filter: and(where('age', 'GREATER_THAN', 40)),
                headerFilters: { age: { value: 40, operator: 'GREATER_THAN' } }
            });
            const view = gridInterface.saveViewAs(`Over 40 (${gridInterface.getViews().length + 1})`);
            ui.log(`saved "${view.name}", id ${view.id}`);
        });
        ui.button('Log current view', () => {
            const view = gridInterface.getCurrentView();
            ui.log(view ? `${view.name}${gridInterface.isViewModified() ? ' - changed' : ''}` : 'Standard (the config)');
        });
        ui.button('Forget my views', () => {
            // the shared views stay, the user's are gone - in the storage too
            gridInterface.setViews(SHARED_VIEWS);
            ui.log('only the shared views now');
        });
    }
};
