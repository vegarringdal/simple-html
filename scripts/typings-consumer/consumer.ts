/**
 * A user's code, compiled against the published typings in dist only: `npm run check:typings`.
 *
 * The build strips members tagged @internal from the .d.ts files. If a public signature still uses
 * a stripped type, the typings are broken for users while the library itself still compiles -
 * this file (with skipLibCheck: false, so every .d.ts is checked) is what catches that.
 * Add to it when the public API grows.
 */
import {
    DataContainer,
    Datasource,
    DateFormatterYYYYMMDD,
    type Entity,
    type FilterArgument,
    type GridConfig,
    type GridElement,
    GridInterface,
    type HTMLCellElement,
    NumberFormatterDot,
    TOOLTIPS,
    type ValueFormatter
} from '../../dist/index';

const datasource = new Datasource(new DataContainer('id'));
datasource.setData([{ id: 1, name: 'a', born: new Date() }]);
datasource.setDateFormatter(DateFormatterYYYYMMDD);
datasource.setNumberFormatter(NumberFormatterDot);
datasource.setLocaleCompare('nb');
datasource.deselectAll();
datasource.resetSort('name');

const filter: FilterArgument | null = datasource.getFilter();
if (filter) {
    datasource.filter(filter);
}

const config: GridConfig = {
    columnsCenter: [{ rows: ['name'], width: 100 }],
    attributes: [{ attribute: 'name' }, { attribute: 'born', type: 'date' }],
    placeHolderRowCurrentEntityOnly: true
};
const gridInterface = new GridInterface(config, datasource);
gridInterface.readonlySetter((attribute: string, row: Entity) => (attribute === 'name' ? !!row.__group : null));
gridInterface.readonlySetter(null);
gridInterface.cellAppendClassSetter(null);
gridInterface.addEventListener({
    handleEvent: (e: any) => {
        const cell = e.data?.cell as HTMLCellElement | undefined;
        return !!cell;
    }
});

const element = document.createElement('simple-html-grid') as GridElement;
element.connectInterface(gridInterface);

const formatter: ValueFormatter = datasource.getValueFormatter();
formatter.fromSource(1, 'number', 'name', false);
console.log(TOOLTIPS);

// internals are not part of the typings any more
// @ts-expect-error
gridInterface.__getGridConfig();
// @ts-expect-error
datasource.__select(0);
