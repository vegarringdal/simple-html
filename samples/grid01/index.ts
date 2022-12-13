import './index.css';
import { Datasource, Entity } from '@simple-html/grid';
import { GridInterface, GridElement } from '@simple-html/grid';
import '../../packages/grid/src/grid.css';
import { dummydata } from './dummyData';
import { gridConfig } from './gridConfig';
import { toggelDarkGrid } from './toggelDarkGrid';

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

containerGrid.style.top = '0px';
containerGrid.style.left = '250px';
containerGrid.style.right = '0px';
containerGrid.style.bottom = '0px';

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

const datasourceEvents = {
    handleEvent: (e: any) => {
        console.log('DATASOURCE EVENTS:', e.type, e.data);
        return true; // to keep subscribing
    }
};

const gridInterfaceEvents = {
    handleEvent: (e: any) => {
        console.log('GRIDINTERFACE EVENTS:', e.type, e.data);
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
