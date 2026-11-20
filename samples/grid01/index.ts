import './index.css';
import {
    createGrid,
    Datasource,
    type DatasourceEvents,
    DateFormatterDDMMYYYY,
    DateFormatterDDMMYYYYTHHMMSS,
    DateFormatterYYYYMMDD,
    DateFormatterYYYYMMDDTHHMMSS,
    type EventHandler,
    type Formatter,
    type GridConfig,
    type GridElement,
    type GridEvents,
    GridInterface,
    type GridState,
    NumberFormatterComma,
    NumberFormatterDot,
    registerFormatter
} from '@simple-html/grid';
import '../../src/grid.css';
import '../../src/date.css';
import { DateFormatterCustom } from './dateFormatterCustom';
import { dummydata } from './dummyData';
import { gridConfig, gridFields } from './gridConfig';
import { NumberFormatterCustom } from './numberFormatterCustom';
import { toggleDarkGrid } from './toggleDarkGrid';

/**
 * WARNING, this will be weird while I get main parts working
 */

/**
 * the number and date formatters the buttons switch between. The datasource gets the two
 * formatters below once, they hand every call on to the one picked last - a formatter is just an
 * object with format and parse. The datasource options name them by id, so they are registered first
 */
let numberFormatter: Formatter = NumberFormatterDot;
let dateFormatter: Formatter = DateFormatterYYYYMMDD;
const switchable = (current: () => Formatter): Formatter => ({
    format: (value) => current().format(value),
    parse: (text) => current().parse(text),
    parseFilter: (text) => {
        const formatter = current();
        return formatter.parseFilter ? formatter.parseFilter(text) : formatter.parse(text);
    },
    get placeholder() {
        return current().placeholder;
    }
});

registerFormatter(
    'grid01.number',
    switchable(() => numberFormatter)
);
registerFormatter(
    'grid01.date',
    switchable(() => dateFormatter)
);

/**
 * create datasource
 */
const datasource = new Datasource({
    fields: gridFields,
    formatters: {
        number: 'grid01.number',
        date: 'grid01.date'
    }
});
datasource.setData(
    structuredClone(dummydata).map((e: any) => {
        e.date1 = new Date(e.date1);
        e.date2 = new Date(e.date2);
        return e;
    })
);

/**
 * create container to how buttons and grid
 */
const containerGrid = document.createElement('div');
containerGrid.style.position = 'absolute';

containerGrid.style.top = '10px';
containerGrid.style.left = '510px';
containerGrid.style.right = '10px';
containerGrid.style.bottom = '10px';
document.body.appendChild(containerGrid);

/**
 * create the grid in its container, and size the columns to their content
 */
const gridInterface = createGrid(containerGrid, { config: gridConfig, datasource });
gridInterface.autoResizeColumns();

const containerbuttons = document.createElement('div');
containerbuttons.style.position = 'absolute';
containerbuttons.style.display = 'flex';
containerbuttons.style.flexDirection = 'column';
containerbuttons.style.top = '0px';
containerbuttons.style.width = '250px';
containerbuttons.style.left = '0px';
containerbuttons.style.bottom = '0px';

const containerbuttons2 = document.createElement('div');
containerbuttons2.style.position = 'absolute';
containerbuttons2.style.display = 'flex';
containerbuttons2.style.flexDirection = 'column';
containerbuttons2.style.top = '0px';
containerbuttons2.style.width = '250px';
containerbuttons2.style.left = '250px';
containerbuttons2.style.bottom = '0px';
document.body.appendChild(containerbuttons2);

function createButton(title: string, callback: () => void) {
    const btn = document.createElement('button');
    btn.onclick = callback;
    btn.innerText = title;
    btn.style.padding = '3px';
    btn.style.margin = '3px';

    if (containerbuttons.children.length > 25) {
        containerbuttons2.appendChild(btn);
    } else {
        containerbuttons.appendChild(btn);
    }
}
toggleDarkGrid();
createButton('toggle dark/light mode', () => {
    toggleDarkGrid();
});

createButton('set to 10 rows', () => {
    const data = (structuredClone(dummydata) as any[]).slice(1, 10);
    datasource.setData(
        data.map((e: any) => {
            e.date1 = new Date(e.date1);
            e.date2 = new Date(e.date2);
            return e;
        })
    );
});

createButton('add to 10 rows', () => {
    const data = (structuredClone(dummydata) as any[]).slice(datasource.length(), datasource.length() + 10);
    datasource.setData(
        data.map((e: any) => {
            e.date1 = new Date(e.date1);
            e.date2 = new Date(e.date2);
            return e;
        }),
        { add: true }
    );
});

createButton('add to 100 rows', () => {
    const data = (structuredClone(dummydata) as any[]).slice(datasource.length(), datasource.length() + 100);
    datasource.setData(
        data.map((e: any) => {
            e.date1 = new Date(e.date1);
            e.date2 = new Date(e.date2);
            return e;
        }),
        { add: true }
    );
});

createButton('select all', () => {
    datasource.selectAll();
});

createButton('select first', () => {
    datasource.selectFirst();
});

createButton('select next', () => {
    datasource.selectNext();
});

createButton('select prev', () => {
    datasource.selectPrev();
});

createButton('select last', () => {
    datasource.selectLast();
});

createButton('select row 5', () => {
    datasource.select(5);
});

createButton('add new and scroll to', () => {
    datasource.addNewEmpty();
});

createButton('add new with data', () => {
    datasource.addNewEmpty({ company: 'Im a company' });
});

createButton('add new with data and do not scroll to it', () => {
    datasource.addNewEmpty({ company: 'Who Im I' }, { scrollTo: false });
});

// what the user changed: column order/widths, sorting, grouping, filter, header filters
let savedState: GridState | null = null;

createButton('save state', () => {
    savedState = gridInterface.getState();
});

createButton('load state', () => {
    if (!savedState) {
        alert('no state saved, save one first');
    } else {
        gridInterface.setState(savedState);
    }
});

createButton('markForDeletion (selection)', () => {
    datasource.markForDeletion(datasource.getSelectedRows());
});

createButton('get markForDeletion (see console)', () => {
    console.log(datasource.getMarkedForDeletion());
});

createButton('reset data/changes', () => {
    datasource.resetData();
});

createButton('reset data/changes -selection', () => {
    datasource.resetDataSelectionOnly();
});

createButton('get changes (ses console)', () => {
    console.log(datasource.getChanges());
});

createButton('remove marked for deleted (no undo)', () => {
    datasource.getDataContainer().clearMarkedForDeletion();
    datasource.reloadDatasource();
});

createButton('reset state (initialState)', () => {
    gridInterface.resetState();
});

/**
 * readonly is config, updateConfig() changes it while the grid is shown. The state stays as it is
 */
createButton('set as readonly', () => {
    gridInterface.updateConfig({ readonly: true });
});

createButton('set as editmode', () => {
    gridInterface.updateConfig({ readonly: false });
});

createButton('Open Filter Editor', () => {
    gridInterface.openFilterEditor();
});

// the unsubscribe functions on() returned, called by the "off" buttons
let datasourceEventsOff: (() => void)[] = [];
let gridInterfaceEventsOff: (() => void)[] = [];

const datasourceEventNames: (keyof DatasourceEvents)[] = [
    'collection-changed',
    'collection-filtered',
    'collection-sorted',
    'collection-grouped',
    'collection-expand',
    'collection-collapse',
    'current-entity',
    'selection-change',
    'select'
];

createButton('datasource.on\n (see console - F12)', () => {
    for (const off of datasourceEventsOff) {
        off();
    }
    datasourceEventsOff = datasourceEventNames.map((type) =>
        datasource.on(type, (data) => {
            console.log('DATASOURCE EVENTS:', type, data);
        })
    );
});

createButton('datasource events off\n (see console - F12)', () => {
    for (const off of datasourceEventsOff) {
        off();
    }
    datasourceEventsOff = [];
});

createButton('gridInterface.on\n (see console - F12)', () => {
    for (const off of gridInterfaceEventsOff) {
        off();
    }
    gridInterfaceEventsOff = [
        gridInterface.on('filter-operator-change', (data) => {
            // sample on how you  would edit config and rerender headers
            data.column.placeholderFilter = data.operator;
            data.rebuildHeader();
        })
    ];
});

createButton('gridInterface events off\n (see console - F12)', () => {
    for (const off of gridInterfaceEventsOff) {
        off();
    }
    gridInterfaceEventsOff = [];
});

createButton('overide default numberformatter (comma)', () => {
    numberFormatter = NumberFormatterComma;
    gridInterface.rebuild();
});

createButton('overide default numberformatter (comma-custom)', () => {
    numberFormatter = NumberFormatterCustom;
    gridInterface.rebuild();
});

createButton('use default numberformatter (dot)', () => {
    numberFormatter = NumberFormatterDot;
    gridInterface.rebuild();
});

createButton('overide default Dateformatter (DD.MM.YYYY)', () => {
    dateFormatter = DateFormatterDDMMYYYY;
    gridInterface.rebuild();
});

createButton('overide default Dateformatter (DD.MM.YYYYTHH:MM:SS)', () => {
    dateFormatter = DateFormatterDDMMYYYYTHHMMSS;
    gridInterface.rebuild();
});

createButton('overide default Dateformatter (DD.MM.YYYY/custom)', () => {
    dateFormatter = DateFormatterCustom;
    gridInterface.rebuild();
});

createButton('use default Dateformatter (YYYY-MM-DD)', () => {
    dateFormatter = DateFormatterYYYYMMDD;
    gridInterface.rebuild();
});

createButton('use default Dateformatter (YYYY-MM-DDTHH:MM:SS)', () => {
    dateFormatter = DateFormatterYYYYMMDDTHHMMSS;
    gridInterface.rebuild();
});

createButton('set readonlyf favoriteFruit based on cell isDumb', () => {
    gridInterface.updateHooks({
        // null: the column config decides
        isReadonly: (row, field) => (row.isDumb === true && field === 'favoriteFruit' ? true : null)
    });
});

createButton('remove readonly favoriteFruit based on cell isDumb', () => {
    // no hook: the column config decides
    gridInterface.updateHooks({ isReadonly: undefined });
});

createButton('cell focus custom menu 1 time', () => {
    const off = gridInterface.on('cell-click', (data) => {
        // 1 time: unsubscribe on the first click
        off();
        const pick = (value: string) => {
            data.rowData[data.attribute] = value;
            gridInterface.refresh();
        };
        gridInterface.openMenu(data.cell, [
            { type: 'section', id: 'label1', label: 'label1:' },
            { id: 'label2', label: 'label2', action: () => pick('2') },
            { id: 'label3', label: 'label3', action: () => pick('3') },
            { type: 'section', id: 'label11', label: 'label11:' },
            { id: 'label12', label: 'label12', action: () => pick('12') },
            { id: 'label13', label: 'label13', action: () => pick('13') }
        ]);
    });
});

createButton('append class background favoriteFruit based on cell isDumb', () => {
    gridInterface.updateHooks({
        cellClass: (row, field) => (row.isDumb === false && field === 'favoriteFruit' ? { background: 'yellow' } : null)
    });
});

createButton('remove class background favoriteFruit based on cell isDumb', () => {
    // no extra classes
    gridInterface.updateHooks({ cellClass: undefined });
});

{
    /**
     * dropdown sample
     */

    const openDropdown: EventHandler<GridEvents['cell-focus-button-click']> = (data) => {
        if (data.attribute === 'company') {
            const element = document.createElement('simple-html-grid') as GridElement;
            const height = 300;
            const width = 500;

            /**
             * the size: openMenu() places it under the cell and keeps it within the screen
             * you might want to add some loading icon..
             */
            element.style.width = `${width}px`;
            element.style.height = `${height}px`;

            const gridConfig: GridConfig = {
                panelHeight: 0,
                selectSizeHeight: 1,
                hideLabels: false,
                hideFilter: false,
                footerHeight: 10, // if you wan the scrollbar..
                columns: {
                    WOW: { label: 'select cable' }
                },
                layout: { center: [{ width: width - 45, fields: ['WOW'] }] }
            };

            const datasourceLocal = new Datasource();

            // dummy data for sample
            const rows = [];
            for (let i = 0; i < 1000; i++) {
                rows.push({ WOW: `wow${i}` });
            }
            datasourceLocal.setData(rows);

            // placed by hand, openMenu() puts it on the page. The grid adds its css class itself
            const gridInterfaceLocal = new GridInterface(gridConfig, datasourceLocal);
            element.connectInterface(gridInterfaceLocal);

            element.onclick = (x: any) => {
                if (x.target?.classList.contains('simple-html-grid-cell-input')) {
                    gridInterface.closeMenu();
                    data.rowData.company = datasourceLocal.currentEntity?.WOW;
                    data.target.focus();
                }
            };

            element.onkeydown = (x: any) => {
                if (x.code === 'Enter' && x.target?.classList.contains('simple-html-grid-cell-input')) {
                    gridInterface.closeMenu();
                    data.rowData.company = datasourceLocal.currentEntity?.WOW;
                    data.target.focus();
                }
            };

            // a menu with the grid as a block: closed on scroll, outside click, another menu
            gridInterface.openMenu(data.cell, [{ type: 'block', id: 'cable-picker', element }]);

            setTimeout(() => {
                // set focus to first filter
                // but we want a timeout, so we do not get space clicked
                (element.getElementsByTagName('INPUT')[0] as HTMLInputElement)?.focus();
            });
        }
    };

    // the unsubscribe functions on() returned, called by the "off" button
    let dropdownEventsOff: (() => void)[] = [];

    createButton('gridInterface.on - popup - company', () => {
        for (const off of dropdownEventsOff) {
            off();
        }
        dropdownEventsOff = [
            // moving to another cell closes an open dropdown
            gridInterface.on('cell-row-focus', () => gridInterface.closeMenu()),
            gridInterface.on('cell-focus-button-click', openDropdown)
        ];
    });

    createButton('gridInterface off - popup - company', () => {
        for (const off of dropdownEventsOff) {
            off();
        }
        dropdownEventsOff = [];
    });
}

/**
 * add to document
 */
document.body.appendChild(containerbuttons);

document.body.addEventListener(
    'touchmove',
    (e) => {
        e.preventDefault();
    },
    { passive: false }
);
