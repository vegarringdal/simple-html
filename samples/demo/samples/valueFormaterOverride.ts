import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const valueFormaterOverride: DemoSample = {
    id: 'value-formater',
    title: 'Value formater override',
    group: 'Formatting',
    description:
        'The datasource routes every cell value through a ValueFormater. fromSourceDisplay is what normal cells render, while fromSource is used for edit cells and the filter row - so override fromSourceDisplay to change how values are shown without touching what the user edits. Here country displays uppercase, but click into a cell and you edit the real value.',
    code: `
// grab the active formater and keep the original method
const formater = datasource.getValueFormater();
const originalDisplay = formater.fromSourceDisplay;

// fromSourceDisplay = what normal cells show.
// fromSource = edit/filter value, so editing still shows the real value
formater.fromSourceDisplay = (value, type, attribute, isFilter) => {
    if (attribute === 'country' && value) {
        return String(value).toUpperCase();
    }
    return originalDisplay.apply(formater, [value, type, attribute, isFilter]);
};

gridInterface.triggerRebuild();

// restore
formater.fromSourceDisplay = originalDisplay;
gridInterface.triggerRebuild();

// or implement the full ValueFormater interface and replace it
// (fromSource/toSource/toFilter/fromSourceDisplay/fromSourceGrouping)
datasource.setValueFormater(myValueFormater);
`,
    run(stage) {
        const ui = createStage(stage);
        const { datasource, gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        const formater = datasource.getValueFormater();
        const originalDisplay = formater.fromSourceDisplay;

        ui.button('Uppercase country (display only)', () => {
            formater.fromSourceDisplay = (value: any, type: any, attribute: string, isFilter: boolean) => {
                if (attribute === 'country' && value) {
                    return String(value).toUpperCase();
                }
                return originalDisplay.apply(formater, [value, type, attribute, isFilter]);
            };
            gridInterface.triggerRebuild();
            ui.log('country displays uppercase - click into a cell: you edit the real value');
        });
        ui.button('Restore default', () => {
            formater.fromSourceDisplay = originalDisplay;
            gridInterface.triggerRebuild();
        });
        ui.button('Log a raw row (console)', () => {
            console.log(datasource.getRow(0));
            ui.log('country in data: ' + (datasource.getRow(0) as any).country);
        });
    }
};
