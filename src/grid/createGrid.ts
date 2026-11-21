import type { Datasource } from '../datasource/dataSource';
import type { GridConfig } from './gridConfig';
import { GridElement } from './gridElement';
import type { GridHooks } from './gridHooks';
import { GridInterface } from './gridInterface';

/**
 * What {@link createGrid} needs: the config and the datasource, and the hooks if any.
 *
 * @typeParam T the type of the rows
 *
 * @example
 * ```ts
 * import { type CreateGridOptions, createGrid, Datasource } from '@simple-html/grid';
 *
 * const options: CreateGridOptions<{ name: string; locked: boolean }> = {
 *     config: { readonly: false, layout: { center: [{ fields: ['name'], width: 150 }] } },
 *     datasource: new Datasource<{ name: string; locked: boolean }>(),
 *     hooks: { isReadonly: (row) => (row.locked ? true : null) }
 * };
 * const gridInterface = createGrid(host, options);
 * ```
 */
export interface CreateGridOptions<T> {
    /** the columns, the layout and the options, see {@link GridConfig}. Plain JSON */
    config: GridConfig;
    /** the rows, see {@link Datasource} */
    datasource: Datasource<T>;
    /**
     * optional: the functions - `isReadonly`, `cellClass` and `menus`, see {@link GridHooks}. Change
     * them later with `gridInterface.updateHooks()`
     */
    hooks?: GridHooks<T>;
}

/**
 * Puts a grid in a container on the page, in one call: makes the {@link GridInterface} for the config
 * and the datasource, and a `<simple-html-grid>` element that fills the container (width and height
 * 100%), connects them and adds the element to the container.
 *
 * The container needs a size: the grid fills it, it does not grow with its rows.
 *
 * `gridInterface.destroy()` takes the grid off the page again. To place and size the element yourself,
 * see {@link GridElement}.
 *
 * @param host the container, the element is added as its last child
 * @param options the config, the datasource and the hooks
 * @returns the grid interface, to work with the grid
 * @throws a `TypeError` when the config has `isReadonly`, `cellClass` or `menus` (those are hooks), or
 * a column has v5's `mandatory` (it is the field's `required` rule)
 *
 * @sample basic-grid
 * @example
 * ```ts
 * import { createGrid, Datasource, type GridConfig } from '@simple-html/grid';
 * import '@simple-html/grid/grid.css';
 *
 * const datasource = new Datasource({ fields: { age: 'number' } });
 * datasource.setData([{ name: 'Ann', age: 30 }, { name: 'Bob', age: 42 }]);
 *
 * const config: GridConfig = {
 *     layout: { center: [{ fields: ['name'], width: 150 }, { fields: ['age'], width: 80 }] }
 * };
 *
 * // <div id="grid" style="height: 400px"></div>
 * const gridInterface = createGrid(document.getElementById('grid')!, { config, datasource });
 *
 * // later, when the grid is not needed any more
 * gridInterface.destroy();
 * ```
 */
export function createGrid<T>(host: HTMLElement, options: CreateGridOptions<T>): GridInterface<T> {
    const gridInterface = new GridInterface(options.config, options.datasource, options.hooks);

    const element = new GridElement();
    element.style.width = '100%';
    element.style.height = '100%';
    element.connectInterface(gridInterface);
    host.appendChild(element);

    return gridInterface;
}
