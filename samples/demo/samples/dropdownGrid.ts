import { Datasource, type GridConfig, type GridElement, GridInterface } from '@simple-html/grid';
import { baseGridConfig, COMPANIES, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const dropdownGrid: DemoSample = {
    id: 'dropdown-grid',
    title: 'Grid as dropdown',
    group: 'Editing',
    description:
        'A cell can show a focus button via the focusButton attribute option. Here clicking it (or hitting Space in the cell) opens a second, filterable grid as a dropdown and writes the picked value back. The company cell itself is readonly, so the dropdown is the only way to change the value.',
    code: `
// in the main grid config, enable the focus button on the attribute.
// NB: the grid defaults to readonly: true, so with this option the button
// only shows when the config has readonly: false.
// readonly on the attribute blocks manual typing, so the dropdown
// (button or Space in the cell) is the only way to set the value
{ attribute: 'company', readonly: true, focusButton: 'SHOW_IF_GRID_NOT_READONLY' }

gridInterface.on('cell-focus-button-click', (data) => {
    if (data.attribute === 'company') {
        const rect = data.cell.getBoundingClientRect();

        // build a small grid to use as dropdown
        const dropdown = document.createElement('simple-html-grid') as GridElement;
        dropdown.classList.add('simple-html-grid');
        dropdown.style.position = 'fixed';
        dropdown.style.width = '300px';
        dropdown.style.height = '250px';
        dropdown.style.top = rect.bottom + 'px';
        dropdown.style.left = rect.left + 'px';

        const localDatasource = new Datasource();
        localDatasource.setData(companies); // [{ company: 'ACME CORP' }, ...]

        const localInterface = new GridInterface(dropdownConfig, localDatasource);
        dropdown.connectInterface(localInterface);
        document.body.appendChild(dropdown);

        // clicking a row in the dropdown writes the value back
        dropdown.onclick = (x) => {
            if (x.target.classList.contains('simple-html-grid-cell-input')) {
                gridInterface.removeContextMenuElement();
                data.rowData.company = localDatasource.currentEntity.company;
                data.target.focus(); // back to the cell
            }
        };

        // register as context menu, so grid closes it on scroll/outside click
        gridInterface.setContextMenuElement(dropdown);
    }
});
`,
    run(stage) {
        const ui = createStage(stage);
        const config = baseGridConfig();
        for (const attribute of config.attributes) {
            if (attribute.attribute === 'company') {
                attribute.readonly = true;
                attribute.focusButton = 'SHOW_IF_GRID_NOT_READONLY';
            }
        }
        const { gridInterface } = mountGrid(ui.gridHost, config);

        // moving to another cell closes an open dropdown
        gridInterface.on('cell-row-focus', () => {
            gridInterface.removeContextMenuElement();
        });

        gridInterface.on('cell-focus-button-click', (data) => {
            gridInterface.removeContextMenuElement();

            if (data.attribute === 'company') {
                const rect = data.cell.getBoundingClientRect();
                const width = 300;
                const height = 250;

                // keep it within the viewport
                let top = rect.bottom;
                let left = rect.left;
                if (window.innerHeight < rect.bottom + height) {
                    top = rect.top - height - 3;
                }
                if (window.innerWidth < rect.right + width) {
                    left = window.innerWidth - width - 3;
                }

                const dropdown = document.createElement('simple-html-grid') as GridElement;
                dropdown.classList.add('simple-html-grid');
                dropdown.style.position = 'fixed';
                dropdown.style.width = width + 'px';
                dropdown.style.height = height + 'px';
                dropdown.style.top = top + 'px';
                dropdown.style.left = left + 'px';
                dropdown.style.boxShadow = '0 6px 20px 0 rgb(0 0 0 / 30%)';

                const dropdownConfig: GridConfig = {
                    panelHeight: 0,
                    selectSizeHeight: 1,
                    footerHeight: 10,
                    columnsCenter: [{ rows: ['company'], width: width - 45 }],
                    attributes: [{ attribute: 'company', label: 'pick company' }]
                };

                const localDatasource = new Datasource();
                localDatasource.setData(
                    COMPANIES.map((company) => {
                        return { company };
                    })
                );

                const localInterface = new GridInterface(dropdownConfig, localDatasource);
                dropdown.connectInterface(localInterface);
                document.body.appendChild(dropdown);

                const applyValue = () => {
                    gridInterface.removeContextMenuElement();
                    data.rowData.company = localDatasource.currentEntity?.company;
                    gridInterface.triggerScrollEvent();
                    data.target.focus();
                };

                dropdown.onclick = (x: any) => {
                    if (x.target?.classList.contains('simple-html-grid-cell-input')) {
                        applyValue();
                    }
                };
                dropdown.onkeydown = (x: any) => {
                    if (x.code === 'Enter' && x.target?.classList.contains('simple-html-grid-cell-input')) {
                        applyValue();
                    }
                };

                setTimeout(() => {
                    // register as context menu element and focus the filter input
                    gridInterface.setContextMenuElement(dropdown);
                    (dropdown.getElementsByTagName('INPUT')[0] as HTMLInputElement)?.focus();
                });
            }
        });

        ui.log('click a company cell, then the ... button that appears (or hit Space in the cell)');
    }
};
