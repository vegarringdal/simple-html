import {
    createGrid,
    Datasource,
    type DatasourceOptions,
    type FieldConfig,
    type FieldType,
    type GridConfig
} from '@simple-html/grid';

/**
 * one sample of the docs site, a file in samples/: its page is #sample/<id>, and a guide shows it
 * running with a ```sample <id> block. The site shows the sample's file as its source (sampleList.ts),
 * so what the file does is what the reader sees.
 * `run` mounts the live demo into the stage element
 */
export interface DemoSample {
    id: string;
    title: string;
    /** the group in the sidebar */
    group: string;
    description: string;
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

export const COUNTRIES = ['Norway', 'Sweden', 'Denmark', 'Finland', 'Iceland', 'Germany', 'France', 'Spain', 'Italy', 'Portugal'];

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
 * the fields of generateRows(): the type and label of each field. A field not listed is text,
 * labelled with its name. Returns a fresh object every call so samples can mutate it
 */
export function baseFields(): Record<string, FieldType | FieldConfig> {
    return {
        age: 'number',
        balance: 'number',
        date1: { type: 'date', label: 'date' },
        isActive: { type: 'boolean', label: 'active' },
        favoriteFruit: { label: 'fruit' }
    };
}

/**
 * shared starting point, returns a fresh object every call so samples can mutate it.
 * The column types and labels come from the datasource, see baseFields()
 */
export function baseGridConfig(): GridConfig {
    return {
        panelHeight: 25,
        readonly: false, // grid defaults to readonly: true when not set
        hideLabels: false,
        hideFilter: false,
        // no columns: every field gets the default column options
        layout: {
            center: [
                { fields: ['company'], width: 170 },
                { fields: ['country'], width: 120 },
                { fields: ['age'], width: 70 },
                { fields: ['balance'], width: 100 },
                { fields: ['date1'], width: 110 },
                { fields: ['isActive'], width: 80 },
                { fields: ['favoriteFruit'], width: 120 },
                { fields: ['phone'], width: 140 }
            ]
        }
    };
}

/**
 * creates the datasource and puts a grid for it in host, with createGrid
 * @param options the datasource options, default the fields of generateRows()
 */
export function mountGrid(
    host: HTMLElement,
    config: GridConfig,
    rows?: any[],
    options: DatasourceOptions = { fields: baseFields() }
) {
    const datasource = new Datasource(options);
    datasource.setData(rows || generateRows());

    const gridInterface = createGrid(host, { config, datasource });

    return { datasource, gridInterface };
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

    let logEl: HTMLElement | null = null;

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
                logEl.removeChild(logEl.firstChild!);
            }
            logEl.scrollTop = logEl.scrollHeight;
        }
    };
}
