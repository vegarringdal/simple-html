import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const valueFormaterOverride: DemoSample = {
    id: 'value-formater',
    title: 'Value formater override',
    group: 'Formatting',
    description:
        'The datasource routes every cell value through a ValueFormater. You can wrap its fromSource to rewrite display values per attribute - here country is displayed uppercase without touching the data. isFilter tells you if the value is for the filter row. setValueFormater() replaces the whole thing.',
    code: `
// grab the active formater and keep the original method
const formater = datasource.getValueFormater();
const originalFromSource = formater.fromSource;

formater.fromSource = (value, type, attribute, isFilter) => {
    // NB: fromSource is also what edit cells show, so what you return
    // here is what the user edits - keep it round-trippable
    if (attribute === 'country' && !isFilter && value) {
        return String(value).toUpperCase();
    }
    return originalFromSource.apply(formater, [value, type, attribute, isFilter]);
};

gridInterface.triggerRebuild();

// restore
formater.fromSource = originalFromSource;
gridInterface.triggerRebuild();

// or implement the full ValueFormater interface and replace it
// (fromSource/toSource/toFilter/fromSourceDisplay/fromSourceGrouping)
datasource.setValueFormater(myValueFormater);
`,
    run(stage) {
        const ui = createStage(stage);
        const { datasource, gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        const formater = datasource.getValueFormater();
        const originalFromSource = formater.fromSource;

        ui.button('Uppercase country (display only)', () => {
            formater.fromSource = (value: any, type: any, attribute: string, isFilter: boolean) => {
                if (attribute === 'country' && !isFilter && value) {
                    return String(value).toUpperCase();
                }
                return originalFromSource.apply(formater, [value, type, attribute, isFilter]);
            };
            gridInterface.triggerRebuild();
            ui.log('country cells now display uppercase, the data itself is untouched');
        });
        ui.button('Restore default', () => {
            formater.fromSource = originalFromSource;
            gridInterface.triggerRebuild();
        });
        ui.button('Log a raw row (console)', () => {
            console.log(datasource.getRow(0));
            ui.log('country in data: ' + (datasource.getRow(0) as any).country);
        });
    }
};
