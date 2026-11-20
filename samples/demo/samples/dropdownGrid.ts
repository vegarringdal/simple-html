import { Datasource, type GridConfig, type GridElement, GridInterface } from '@simple-html/grid';
import { baseGridConfig, COMPANIES, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const dropdownGrid: DemoSample = {
    id: 'dropdown-grid',
    title: 'Grid as dropdown',
    group: 'Editing',
    description:
        'A cell can show a focus button via the focusButton column option. Here clicking it (or hitting Space in the cell) opens a second, filterable grid as a dropdown and writes the picked value back. The dropdown is opened with openMenu() as a block, so the grid closes it as it does its own menus: a click outside, another menu. The company cell itself is readonly, so the dropdown is the only way to change the value.',
    run(stage) {
        const ui = createStage(stage);
        const config = baseGridConfig();
        // the focus button on the company cells. NB: the grid defaults to readonly: true, so with this
        // option the button only shows when the config has readonly: false (baseGridConfig has).
        // readonly on the column blocks typing, so the dropdown (button or Space in the cell) is the
        // only way to set the value
        config.columns = { company: { readonly: true, focusButton: 'SHOW_IF_GRID_NOT_READONLY' } };
        const { gridInterface } = mountGrid(ui.gridHost, config);

        // moving to another cell closes an open dropdown
        gridInterface.on('cell-row-focus', () => {
            gridInterface.closeMenu();
        });

        gridInterface.on('cell-focus-button-click', (data) => {
            if (data.attribute === 'company') {
                const width = 300;

                // a small grid as the dropdown. Placed by hand, not with createGrid: openMenu() puts it
                // on the page, the grid adds its css class itself
                const dropdown = document.createElement('simple-html-grid') as GridElement;
                dropdown.style.width = `${width}px`;
                dropdown.style.height = '250px';

                const dropdownConfig: GridConfig = {
                    panelHeight: 0,
                    selectSizeHeight: 1,
                    footerHeight: 10,
                    columns: { company: { label: 'pick company' } },
                    layout: { center: [{ fields: ['company'], width: width - 45 }] }
                };

                const localDatasource = new Datasource();
                localDatasource.setData(
                    COMPANIES.map((company) => {
                        return { company };
                    })
                );

                const localInterface = new GridInterface(dropdownConfig, localDatasource);
                dropdown.connectInterface(localInterface);

                const applyValue = () => {
                    gridInterface.closeMenu();
                    const current = localDatasource.currentEntity;
                    data.rowData.company = current?.company;
                    gridInterface.refresh();
                    data.target.focus();
                    ui.log(`picked: ${current?.company}`);
                };

                dropdown.onclick = (x: MouseEvent) => {
                    if (x.target instanceof HTMLElement && x.target.classList.contains('simple-html-grid-cell-input')) {
                        applyValue();
                    }
                };
                dropdown.onkeydown = (x: KeyboardEvent) => {
                    if (
                        x.code === 'Enter' &&
                        x.target instanceof HTMLElement &&
                        x.target.classList.contains('simple-html-grid-cell-input')
                    ) {
                        applyValue();
                    }
                };

                // a menu with the grid as a block: opened under the cell, kept in the window, and closed
                // with the grid's menus - a click outside it, another menu opening, closeMenu()
                gridInterface.openMenu(data.cell, [{ type: 'block', id: 'company-picker', element: dropdown }]);

                // focus the filter input in a timeout, so the Space that opened it is not typed into it
                setTimeout(() => {
                    (dropdown.getElementsByTagName('INPUT')[0] as HTMLInputElement | undefined)?.focus();
                });
            }
        });

        ui.log('click a company cell, then the ... button that appears (or hit Space in the cell)');
    }
};
