import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const cellStyling: DemoSample = {
    id: 'cell-styling',
    title: 'Cell styling & readonly',
    group: 'Formatting',
    description:
        'cellAppendClassSetter() lets you append css classes to cells based on the row data - here balance cells get a red/green tint by value. readonlySetter() does the same for readonly state - here company becomes readonly on inactive rows. Both take a callback (or null to remove it).',
    code: `
/* the class you append to dimmedClass is an overlay, so position it:
.cell-low {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(239, 68, 68, 0.22);
    pointer-events: none;
}
*/

// color cells based on row values
gridInterface.cellAppendClassSetter((attribute, rowData, _isReadOnly) => {
    if (attribute === 'balance') {
        if (rowData.balance < 500) {
            return { dimmedClass: 'cell-low', inputClass: '' };
        }
        if (rowData.balance > 2500) {
            return { dimmedClass: 'cell-high', inputClass: '' };
        }
    }
    return { dimmedClass: '', inputClass: '' };
});

// readonly based on row values (configReadonly = what the config says)
gridInterface.readonlySetter((attribute, rowData, configReadonly) => {
    if (attribute === 'company' && rowData.isActive === false) {
        return true;
    }
    return configReadonly;
});

gridInterface.triggerRebuild(); // rerender cells

// pass null to remove the callbacks again
gridInterface.cellAppendClassSetter(null);
gridInterface.readonlySetter(null);
`,
    run(stage) {
        const ui = createStage(stage);
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        ui.button('Color balance cells', () => {
            gridInterface.cellAppendClassSetter((attribute: string, rowData: any, _isReadOnly: boolean) => {
                if (attribute === 'balance') {
                    if (rowData.balance < 500) {
                        return { dimmedClass: 'demo-cell-low', inputClass: '' };
                    }
                    if (rowData.balance > 2500) {
                        return { dimmedClass: 'demo-cell-high', inputClass: '' };
                    }
                }
                return { dimmedClass: '', inputClass: '' };
            });
            gridInterface.triggerRebuild();
        });
        ui.button('Remove coloring', () => {
            // no extra classes, same as no setter
            gridInterface.cellAppendClassSetter(null);
            gridInterface.triggerRebuild();
        });
        ui.button('Readonly company when inactive', () => {
            gridInterface.readonlySetter((attribute: string, rowData: any, configReadonly: boolean) => {
                if (attribute === 'company' && rowData.isActive === false) {
                    return true;
                }
                return configReadonly;
            });
            gridInterface.triggerRebuild();
            ui.log('company cells on rows with active=false are now readonly (dimmed)');
        });
        ui.button('Remove readonly rule', () => {
            // gives no answer, so the column config decides, same as no setter
            gridInterface.readonlySetter(null);
            gridInterface.triggerRebuild();
        });
    }
};
