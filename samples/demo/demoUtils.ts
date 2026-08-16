import { Datasource, type GridConfig, type GridElement, GridInterface } from '@simple-html/grid';

/**
 * one entry per tab in the samples app
 * `code` is the curated "how to use" snippet shown above the running demo,
 * `run` mounts the live demo into the stage element
 */
export interface DemoSample {
    id: string;
    title: string;
    group: string;
    description: string;
    code: string;
    run: (stage: HTMLElement) => void;
}

export const COMPANIES = [
    'ACME CORP',
    'GLOBEX',
    'INITECH',
    'UMBRELLA',
    'STARK INDUSTRIES',
    'WAYNE ENTERPRISES',
    'WONKA',
    'TYRELL',
    'CYBERDYNE',
    'HOOLI',
    'MASSIVE DYNAMIC',
    'VANDELAY'
];

export const COUNTRIES = [
    'Norway',
    'Sweden',
    'Denmark',
    'Finland',
    'Iceland',
    'Germany',
    'France',
    'Spain',
    'Italy',
    'Portugal'
];

export const FRUITS = ['Apple', 'Banana', 'Cherry', 'Mango', 'Orange', 'Pear'];

/**
 * deterministic dummy data, so every reload looks the same
 */
export function generateRows(count = 500): any[] {
    let seed = 1;
    const rnd = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };
    const rows: any[] = [];
    for (let i = 0; i < count; i++) {
        rows.push({
            company: COMPANIES[Math.floor(rnd() * COMPANIES.length)],
            country: COUNTRIES[Math.floor(rnd() * COUNTRIES.length)],
            age: 20 + Math.floor(rnd() * 40),
            balance: Math.round(rnd() * 300000) / 100,
            date1: new Date(2026, 0, 1 + Math.floor(rnd() * 365)),
            isActive: rnd() > 0.5,
            favoriteFruit: FRUITS[Math.floor(rnd() * FRUITS.length)],
            phone: '+47 ' + String(10000000 + Math.floor(rnd() * 89999999))
        });
    }
    return rows;
}

/**
 * shared starting point, returns a fresh object every call so samples can mutate it
 */
export function baseGridConfig(): GridConfig {
    return {
        panelHeight: 25,
        readonly: false, // grid defaults to readonly: true when not set
        hideLabels: false,
        hideFilter: false,
        columnsCenter: [
            { rows: ['company'], width: 170 },
            { rows: ['country'], width: 120 },
            { rows: ['age'], width: 70 },
            { rows: ['balance'], width: 100 },
            { rows: ['date1'], width: 110 },
            { rows: ['isActive'], width: 80 },
            { rows: ['favoriteFruit'], width: 120 },
            { rows: ['phone'], width: 140 }
        ],
        attributes: [
            { attribute: 'company' },
            { attribute: 'country' },
            { attribute: 'age', type: 'number' },
            { attribute: 'balance', type: 'number' },
            { attribute: 'date1', type: 'date', label: 'date' },
            { attribute: 'isActive', type: 'boolean', label: 'active' },
            { attribute: 'favoriteFruit', label: 'fruit' },
            { attribute: 'phone' }
        ]
    };
}

/**
 * creates datasource + interface + element and mounts it into host
 */
export function mountGrid(host: HTMLElement, config: GridConfig, rows?: any[]) {
    const datasource = new Datasource();
    datasource.setData(rows || generateRows());

    const gridInterface = new GridInterface(config, datasource);

    const element = document.createElement('simple-html-grid') as GridElement;
    element.classList.add('simple-html-grid');
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.display = 'flex';
    element.connectInterface(gridInterface);
    host.appendChild(element);

    return { datasource, gridInterface, element };
}

/**
 * small helper for the demo area: optional button toolbar + log panel + grid host
 */
export function createStage(stage: HTMLElement) {
    const toolbar = document.createElement('div');
    toolbar.className = 'demo-toolbar';
    stage.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'demo-grid-host';
    stage.appendChild(gridHost);

    let logEl: HTMLElement = null;

    return {
        gridHost,
        button(label: string, onClick: () => void) {
            const btn = document.createElement('button');
            btn.className = 'demo-btn';
            btn.textContent = label;
            btn.onclick = onClick;
            toolbar.appendChild(btn);
            return btn;
        },
        log(line: string) {
            if (!logEl) {
                logEl = document.createElement('div');
                logEl.className = 'demo-log';
                stage.insertBefore(logEl, gridHost);
            }
            const row = document.createElement('div');
            row.textContent = line;
            logEl.appendChild(row);
            while (logEl.children.length > 200) {
                logEl.removeChild(logEl.firstChild);
            }
            logEl.scrollTop = logEl.scrollHeight;
        }
    };
}
