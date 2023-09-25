import './index.css';
import {
    Datasource,
    NumberFormaterComma,
    NumberFormaterDot,
    DateFormaterYYYYMMDD,
    DateFormaterDDMMYYYY,
    HTMLCellElement,
    GridConfig,
    DateFormaterYYYYMMDDTHHMMSS,
    DateFormaterDDMMYYYYTHHMMSS
} from '@simple-html/grid';
import { GridInterface, GridElement } from '@simple-html/grid';
import '../../packages/grid/src/grid.css';
import '../../packages/grid/src/date.css';
import { dummydata } from './dummyData';
import { gridConfig } from './gridConfig';
import { toggelDarkGrid } from './toggelDarkGrid';
import { NumberFormaterCustom } from './numberFormaterCustom';
import { DateFormaterCustom } from './dateFormaterCustom';

/**
 * WARNING, this will be weird while I get main parts working
 */

/**
 * create datasource
 */
const datasource = new Datasource();
datasource.setData(
    structuredClone(dummydata).map((e: any) => {
        //@ts-ignore
        e.date1 = new Date(e.date1);
        //@ts-ignore
        e.date2 = new Date(e.date2);
        return e;
    })
);

/**
 * create interface
 */
const gridInterface = new GridInterface(gridConfig, datasource);

gridInterface.addEventListener({
    handleEvent: (msg) => {
        if (msg.type === 'gridConnected') {
            gridInterface.autoResizeColumns();
        }
    }
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
toggelDarkGrid();
createButton('toggle dark/light mode', () => {
    toggelDarkGrid();
});

createButton('set to 10 rows', () => {
    const data = (structuredClone(dummydata) as any[]).slice(1, 10);
    datasource.setData(
        data.map((e: any) => {
            //@ts-ignore
            e.date1 = new Date(e.date1);
            //@ts-ignore
            e.date2 = new Date(e.date2);
            return e;
        })
    );
});

createButton('add to 10 rows', () => {
    const data = (structuredClone(dummydata) as any[]).slice(datasource.length(), datasource.length() + 10);
    datasource.setData(
        data.map((e: any) => {
            //@ts-ignore
            e.date1 = new Date(e.date1);
            //@ts-ignore
            e.date2 = new Date(e.date2);
            return e;
        }),
        true
    );
});

createButton('add to 100 rows', () => {
    const data = (structuredClone(dummydata) as any[]).slice(datasource.length(), datasource.length() + 100);
    datasource.setData(
        data.map((e: any) => {
            //@ts-ignore
            e.date1 = new Date(e.date1);
            //@ts-ignore
            e.date2 = new Date(e.date2);
            return e;
        }),
        true
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
    datasource.addNewEmpty({ company: 'Who Im I' }, false);
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

createButton('get changes (ses console)', () => {
    console.log(datasource.getChanges());
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

const datasourceEvents = {
    handleEvent: (e: any) => {
        /*   console.log('DATASOURCE EVENTS:', e.type, e.data); */
        return true; // to keep subscribing
    }
};

const gridInterfaceEvents = {
    handleEvent: (e: any) => {
        /* console.log('GRIDINTERFACE EVENTS:', e.type, e.data); */

        if (e.type === 'filter-operator-change') {
            // sample on how you  would edit config and rerender headers
            e.data.cellConfig.placeHolderFilter = e.data.cellConfig.operator;
            e.data.rebuildHeaderColumns(e.data.ctx);
        }

        return true; // to keep subscribing
    }
};

createButton('datasource.addEventListener\n (see console - F12)', () => {
    datasource.addEventListener(datasourceEvents);
});

createButton('datasource.removeEventListener\n (see console - F12)', () => {
    datasource.removeEventListener(datasourceEvents);
});

createButton('gridInterface.addEventListener\n (see console - F12)', () => {
    gridInterface.addEventListener(gridInterfaceEvents);
});

createButton('gridInterface.removeEventListener\n (see console - F12)', () => {
    gridInterface.removeEventListener(gridInterfaceEvents);
});

createButton('overide default numberformater (comma)', () => {
    datasource.setNumberFormater(NumberFormaterComma);
    gridInterface.triggerRebuild();
});

createButton('overide default numberformater (comma-custom)', () => {
    datasource.setNumberFormater(NumberFormaterCustom);
    gridInterface.triggerRebuild();
});

createButton('use default numberformater (dot)', () => {
    datasource.setNumberFormater(NumberFormaterDot);
    gridInterface.triggerRebuild();
});

createButton('overide default Dateformater (DD.MM.YYYY)', () => {
    datasource.setDateFormater(DateFormaterDDMMYYYY);
    gridInterface.triggerRebuild();
});

createButton('overide default Dateformater (DD.MM.YYYYTHH:MM:SS)', () => {
    datasource.setDateFormater(DateFormaterDDMMYYYYTHHMMSS);
    gridInterface.triggerRebuild();
});

createButton('overide default Dateformater (DD.MM.YYYY/custom)', () => {
    datasource.setDateFormater(DateFormaterCustom);
    gridInterface.triggerRebuild();
});

createButton('use default Dateformater (YYYY-MM-DD)', () => {
    datasource.setDateFormater(DateFormaterYYYYMMDD);
    gridInterface.triggerRebuild();
});

createButton('use default Dateformater (YYYY-MM-DDTHH:MM:SS)', () => {
    datasource.setDateFormater(DateFormaterYYYYMMDDTHHMMSS);
    gridInterface.triggerRebuild();
});

createButton('set readonlyf favoriteFruit based on cell isDumb', () => {
    gridInterface.readonlySetter((attribute: string, rowData: any, configReadonlySetting: boolean) => {
        if (rowData['isDumb'] === true && attribute === 'favoriteFruit') {
            return true;
        } else {
            return configReadonlySetting;
        }
    });
});

createButton('remove readonly favoriteFruit based on cell isDumb', () => {
    gridInterface.readonlySetter(null);
});

createButton('cell focus custom menu 1 time', () => {
    gridInterface.addEventListener({
        handleEvent: (e) => {
            if (e.type === 'cell-click') {
                gridInterface.contextMenuCustom(
                    e.data.originalEvent,
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
                    e.data.cell,
                    (result) => {
                        datasource.currentEntity[e.data.attribute] = result;
                        gridInterface.triggerScrollEvent();
                        return true;
                    }
                );
            }
            return true;
        }
    });
});

createButton('append class dimmed favoriteFruit based on cell isDumb', () => {
    gridInterface.cellAppendClassSetter((attribute: string, rowData: any, _isReadOnly: boolean) => {
        if (rowData['isDumb'] === false && attribute === 'favoriteFruit') {
            return { dimmedClass: 'yellow', inputClass: '' };
        } else {
            return { dimmedClass: '', inputClass: '' };
        }
    });
});

createButton('remove class dimmed  favoriteFruit based on cell isDumb', () => {
    gridInterface.cellAppendClassSetter(null);
});

{
    /**
     * dropdown sample
     */

    const gridInterfaceDropdownEventSample = {
        handleEvent: (e: any) => {
            gridInterface.removeContextMenuElement();

            if (e.type === 'cell-focus-button-click' && e.data?.attribute === 'company') {
                const cell = e.data.cell as HTMLCellElement;
                const rect = cell.getBoundingClientRect();
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

                element.style.width = width + 'px';
                element.style.height = height + 'px';
                element.style.display = 'absolute';
                element.style.top = top + 'px';
                element.style.left = left + 'px';
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
                    datasourceLocal.setData([{ WOW: 'wow' + i }], true);
                }

                const gridInterfaceLocal = new GridInterface(gridConfig, datasourceLocal);
                element.classList.add('simple-html-grid');
                element.connectInterface(gridInterfaceLocal);
                document.body.appendChild(element);

                element.onclick = (x: any) => {
                    if (x.target?.classList.contains('simple-html-grid-cell-input')) {
                        gridInterface.removeContextMenuElement();
                        datasource.currentEntity['company'] = datasourceLocal.currentEntity['WOW'];
                        e.data.target?.focus();
                    }
                };

                element.onkeydown = (x: any) => {
                    if (x.code === 'Enter' && x.target?.classList.contains('simple-html-grid-cell-input')) {
                        gridInterface.removeContextMenuElement();
                        datasource.currentEntity['company'] = datasourceLocal.currentEntity['WOW'];
                        e.data.target?.focus();
                    }
                };

                setTimeout(() => {
                    // set focus to first filter
                    // but we want a timeout, so we do not get space clicked

                    gridInterface.setContextMenuElement(element);
                    (element.getElementsByTagName('INPUT')[0] as HTMLInputElement)?.focus();
                });
            }

            return true; // to keep subscribing
        }
    };

    createButton('gridInterface.addEventListener - popup - company', () => {
        gridInterface.addEventListener(gridInterfaceDropdownEventSample);
    });

    createButton('gridInterface.removeEventListener  - popup - company', () => {
        gridInterface.removeEventListener(gridInterfaceDropdownEventSample);
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
