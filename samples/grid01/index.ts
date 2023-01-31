import './index.css';
import { Datasource, Entity, NumberFormaterComma, NumberFormaterDot, DateFormaterISO8601, DateFormaterDDMMYYYY } from '@simple-html/grid';
import { GridInterface, GridElement } from '@simple-html/grid';
import '../../packages/grid/src/grid.css';
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

/**
 * create container to how buttons and grid
 */
const containerGrid = document.createElement('div');
containerGrid.style.position = 'absolute';

containerGrid.style.top = '10px';
containerGrid.style.left = '260px';
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
    containerbuttons.appendChild(btn);
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
        console.log('DATASOURCE EVENTS:', e.type, e.data);
        return true; // to keep subscribing
    }
};

const gridInterfaceEvents = {
    handleEvent: (e: any) => {
        console.log('GRIDINTERFACE EVENTS:', e.type, e.data);

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
    gridInterface.triggerScrollEvent()
    
});

createButton('overide default numberformater (comma-custom)', () => {
    datasource.setNumberFormater(NumberFormaterCustom);
    gridInterface.triggerScrollEvent()
    
});

createButton('use default numberformater (dot)', () => {
    datasource.setNumberFormater(NumberFormaterDot);
    gridInterface.triggerScrollEvent()
});


createButton('overide default Dateformater (DD.MM.YYYY)', () => {
    datasource.setDateFormater(DateFormaterDDMMYYYY);
    gridInterface.triggerScrollEvent()
    
});

createButton('overide default Dateformater (DD.MM.YYYY/custom)', () => {
    datasource.setDateFormater(DateFormaterCustom);
    gridInterface.triggerScrollEvent()
    
});

createButton('use default Dateformater (iso8601)', () => {
    datasource.setDateFormater(DateFormaterISO8601);
    gridInterface.triggerScrollEvent()
});


createButton('set readonlyf favoriteFruit based on cell isDumb', () => {
    gridInterface.readonlySetter((attribute: string, rowData: Entity, configReadonlySetting: boolean) => {
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
