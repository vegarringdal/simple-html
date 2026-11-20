import './index.css';
import {
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
    NumberFormatterComma,
    NumberFormatterDot
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
 * object with format and parse
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

/**
 * create datasource
 */
const datasource = new Datasource({
    fields: gridFields,
    formatters: {
        number: switchable(() => numberFormatter),
        date: switchable(() => dateFormatter)
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
 * create interface
 */
const gridInterface = new GridInterface(gridConfig, datasource);

gridInterface.on('grid-connected', () => {
    gridInterface.autoResizeColumns();
});

/**
 * create container to how buttons and grid
 */
const containerGrid = document.createElement('div');
containerGrid.style.position = 'absolute';

containerGrid.style.top = '10px';
containerGrid.style.left = '510px';
containerGrid.style.right = '10px';
containerGrid.style.bottom = '10px';

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

const element = document.createElement('simple-html-grid') as GridElement;
element.style.width = '100%';
element.style.height = '100%';
element.style.display = 'flex';
element.classList.add('simple-html-grid');
element.connectInterface(gridInterface);

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

createButton('save config', () => {
    (globalThis as any).griconfig = gridInterface.saveConfig();
});

createButton('load config', () => {
    if (!(globalThis as any)) {
        alert('no config saved, save on first');
    } else {
        gridInterface.loadConfig((globalThis as any).griconfig);
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

createButton('use init config', () => {
    gridInterface.loadConfig(gridConfig);
});

createButton('set as readonly', () => {
    const config = gridInterface.saveConfig();
    config.readonly = true;
    gridInterface.loadConfig(config);
});

createButton('set as editmode', () => {
    const config = gridInterface.saveConfig();
    config.readonly = false;
    gridInterface.loadConfig(config);
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
            data.cellConfig.placeHolderFilter = data.cellConfig.operator;
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
    gridInterface.triggerRebuild();
});

createButton('overide default numberformatter (comma-custom)', () => {
    numberFormatter = NumberFormatterCustom;
    gridInterface.triggerRebuild();
});

createButton('use default numberformatter (dot)', () => {
    numberFormatter = NumberFormatterDot;
    gridInterface.triggerRebuild();
});

createButton('overide default Dateformatter (DD.MM.YYYY)', () => {
    dateFormatter = DateFormatterDDMMYYYY;
    gridInterface.triggerRebuild();
});

createButton('overide default Dateformatter (DD.MM.YYYYTHH:MM:SS)', () => {
    dateFormatter = DateFormatterDDMMYYYYTHHMMSS;
    gridInterface.triggerRebuild();
});

createButton('overide default Dateformatter (DD.MM.YYYY/custom)', () => {
    dateFormatter = DateFormatterCustom;
    gridInterface.triggerRebuild();
});

createButton('use default Dateformatter (YYYY-MM-DD)', () => {
    dateFormatter = DateFormatterYYYYMMDD;
    gridInterface.triggerRebuild();
});

createButton('use default Dateformatter (YYYY-MM-DDTHH:MM:SS)', () => {
    dateFormatter = DateFormatterYYYYMMDDTHHMMSS;
    gridInterface.triggerRebuild();
});

createButton('set readonlyf favoriteFruit based on cell isDumb', () => {
    gridInterface.readonlySetter((attribute: string, rowData: any, configReadonlySetting: boolean) => {
        if (rowData.isDumb === true && attribute === 'favoriteFruit') {
            return true;
        } else {
            return configReadonlySetting;
        }
    });
});

createButton('remove readonly favoriteFruit based on cell isDumb', () => {
    // gives no answer, so the column config decides, same as no setter
    gridInterface.readonlySetter(null);
});

createButton('cell focus custom menu 1 time', () => {
    const off = gridInterface.on('cell-click', (data) => {
        // 1 time: unsubscribe on the first click
        off();
        gridInterface.contextMenuCustom(
            data.originalEvent,
            [
                {
                    value: '1',
                    isHeader: true,
                    label: 'label1'
                },
                {
                    value: '2',
                    isHeader: false,
                    label: 'label2'
                },
                {
                    value: '3',
                    isHeader: false,
                    label: 'label3'
                },
                {
                    value: '11',
                    isHeader: true,
                    label: 'label11'
                },
                {
                    value: '12',
                    isHeader: false,
                    label: 'label12'
                },
                {
                    value: '13',
                    isHeader: false,
                    label: 'label13'
                }
            ],
            data.cell,
            (result) => {
                data.rowData[data.attribute] = result;
                gridInterface.triggerScrollEvent();
            }
        );
    });
});

createButton('append class dimmed favoriteFruit based on cell isDumb', () => {
    gridInterface.cellAppendClassSetter((attribute: string, rowData: any, _isReadOnly: boolean) => {
        if (rowData.isDumb === false && attribute === 'favoriteFruit') {
            return { dimmedClass: 'yellow', inputClass: '' };
        } else {
            return { dimmedClass: '', inputClass: '' };
        }
    });
});

createButton('remove class dimmed  favoriteFruit based on cell isDumb', () => {
    // no extra classes, same as no setter
    gridInterface.cellAppendClassSetter(null);
});

{
    /**
     * dropdown sample
     */

    const openDropdown: EventHandler<GridEvents['cell-focus-button-click']> = (data) => {
        gridInterface.removeContextMenuElement();

        if (data.attribute === 'company') {
            const rect = data.cell.getBoundingClientRect();
            const element = document.createElement('simple-html-grid') as GridElement;
            const height = 300;
            const width = 500;

            /**
             * first part here is to just keep it within screen size
             */

            let top = rect.bottom;
            let left = rect.left;

            if (window.innerHeight < rect.bottom + height) {
                top = rect.top - height - 3;
            }
            if (window.innerWidth < rect.right + width) {
                left = window.innerWidth - width - 3;
            }

            /**
             * add syle/calculated top/left
             * you might want to add some loading icon..
             */

            element.style.width = `${width}px`;
            element.style.height = `${height}px`;
            element.style.display = 'absolute';
            element.style.top = `${top}px`;
            element.style.left = `${left}px`;
            element.style.boxShadow = '16px 17px 8px 0px rgb(0 0 0 / 20%), 0 6px 20px 0 rgb(0 0 0 / 19%)';

            const gridConfig: GridConfig = {
                panelHeight: 0,
                selectSizeHeight: 1,
                hideLabels: false,
                hideFilter: false,
                footerHeight: 10, // if you wan the scrollbar..
                columnsCenter: [{ width: width - 45, rows: ['WOW'] }],
                attributes: [
                    {
                        attribute: 'WOW',
                        label: 'select cable'
                    }
                ]
            };

            const datasourceLocal = new Datasource();

            // dummy data for sample
            for (let i = 0; i < 1000; i++) {
                datasourceLocal.setData([{ WOW: `wow${i}` }], { add: true });
            }

            const gridInterfaceLocal = new GridInterface(gridConfig, datasourceLocal);
            element.classList.add('simple-html-grid');
            element.connectInterface(gridInterfaceLocal);
            document.body.appendChild(element);

            element.onclick = (x: any) => {
                if (x.target?.classList.contains('simple-html-grid-cell-input')) {
                    gridInterface.removeContextMenuElement();
                    data.rowData.company = datasourceLocal.currentEntity?.WOW;
                    data.target.focus();
                }
            };

            element.onkeydown = (x: any) => {
                if (x.code === 'Enter' && x.target?.classList.contains('simple-html-grid-cell-input')) {
                    gridInterface.removeContextMenuElement();
                    data.rowData.company = datasourceLocal.currentEntity?.WOW;
                    data.target.focus();
                }
            };

            setTimeout(() => {
                // set focus to first filter
                // but we want a timeout, so we do not get space clicked

                gridInterface.setContextMenuElement(element);
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
            gridInterface.on('cell-row-focus', () => gridInterface.removeContextMenuElement()),
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
containerGrid.appendChild(element);
document.body.appendChild(containerGrid);
document.body.appendChild(containerbuttons);

document.body.addEventListener(
    'touchmove',
    (e) => {
        e.preventDefault();
    },
    { passive: false }
);
