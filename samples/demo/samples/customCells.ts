import { type CellRenderContext, type CellRenderer, type GridConfig, registerCellRenderer } from '@simple-html/grid';
import { html, render } from 'lit-html';
import { baseFields, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

const STATUSES = ['open', 'waiting', 'done'];
const PRIORITIES = ['Low', 'Normal', 'High'];

/**
 * how many renderers the cells mounted and destroyed: a renderer is called once per cell element, not
 * per row - scroll and count again. A wrapper around a renderer, it counts its instances
 */
const count = { mounted: 0, destroyed: 0 };
const counted =
    (renderer: CellRenderer): CellRenderer =>
    (host) => {
        count.mounted++;
        const instance = renderer(host);
        return {
            ...instance,
            destroy() {
                count.destroyed++;
                instance.destroy?.();
            }
        };
    };

/**
 * a badge, in plain DOM: the span is made once per cell element, update() changes its text and its
 * status. The colours are the grid's, light and dark (the style element below)
 */
const badge: CellRenderer = (host) => {
    const span = document.createElement('span');
    span.className = 'demo-badge';
    host.appendChild(span);
    return {
        update({ value, text }) {
            span.textContent = text;
            span.dataset.status = String(value);
            span.hidden = text === '';
        }
    };
};

/**
 * a progress bar, with lit-html: render() into the host again on every update, lit-html changes only the
 * width and the text
 */
const progress: CellRenderer = (host) => ({
    update({ value }) {
        const percent = Math.min(Math.max(Number(value) || 0, 0), 100);
        render(
            html`<span class="demo-progress"><span style=${`width:${percent}%`}></span></span><span class="demo-percent">${percent}%</span>`,
            host
        );
    }
});

/**
 * a link: a click opens it. Out of the tab order, the cell is the stop of Tab - Enter in the cell edits
 * the address in the grid's editor
 */
const link: CellRenderer = (host) => {
    const a = document.createElement('a');
    a.className = 'demo-link';
    a.target = '_blank';
    a.rel = 'noopener';
    a.tabIndex = -1;
    host.appendChild(a);
    return {
        update({ value, text }) {
            a.textContent = text;
            a.href = `https://example.com/${encodeURIComponent(String(value ?? ''))}`;
        }
    };
};

/**
 * a select that edits the value: a change writes the row - tracked, validated and one undo step, as any
 * edit. edit() is what the grid calls for Enter, F2 and a double click: the select gets the focus, the
 * arrows change it, Esc goes back to the cell. Disabled where the cell is readonly
 */
const select: CellRenderer = (host) => {
    const element = document.createElement('select');
    element.className = 'demo-select';
    element.tabIndex = -1;
    // a control of your own needs a name for a screen reader
    element.setAttribute('aria-label', 'Priority');
    for (const priority of PRIORITIES) {
        const option = document.createElement('option');
        option.value = priority;
        option.textContent = priority;
        element.appendChild(option);
    }
    let context: CellRenderContext | undefined;
    element.addEventListener('change', () => {
        if (context && !context.readonly) {
            context.row[context.field] = element.value;
        }
    });
    element.addEventListener('keydown', (event) => {
        // its own key: not the grid's Esc, which clears the ranges
        if (event.key === 'Escape') {
            event.stopPropagation();
            host.focus();
        }
    });
    host.appendChild(element);
    return {
        update(next) {
            context = next;
            element.value = String(next.value ?? '');
            element.disabled = next.readonly;
        },
        edit() {
            element.focus();
        }
    };
};

/**
 * a date with its weekday, only drawn: a click opens the grid's date picker, Enter the editor
 */
const weekday: CellRenderer = (host) => ({
    update({ value, text }) {
        const day = value instanceof Date ? value.toLocaleDateString('en', { weekday: 'short' }) : '';
        host.textContent = day ? `${day} ${text}` : text;
    }
});

// the config names a renderer by its id, so it stays plain JSON. Register them when the page loads,
// before a grid names them
registerCellRenderer('badge', counted(badge));
registerCellRenderer('progress', counted(progress));
registerCellRenderer('link', counted(link));
registerCellRenderer('select', counted(select));
registerCellRenderer('weekday', counted(weekday));

/** the look of the badge, the bar, the link and the select: the grid's colours, so light and dark */
const STYLE = `
.demo-badge { padding: 0 6px; border: 1px solid currentColor; line-height: 14px; }
.demo-badge[data-status='open'] { color: var(--simple-html-grid-conflict-color); }
.demo-badge[data-status='waiting'] { color: var(--simple-html-grid-edited-color); }
.demo-badge[data-status='done'] { color: var(--simple-html-grid-new-color); }
.demo-progress { flex: 1; height: 8px; border: 1px solid var(--simple-html-grid-pinned-border); background: var(--simple-html-grid-sec-bg-color); }
.demo-progress > span { display: block; height: 100%; background: var(--simple-html-grid-multiline-color); }
.demo-percent { flex: none; width: 32px; text-align: right; }
.demo-link { color: inherit; }
.demo-select { width: 100%; height: 18px; border: 1px solid var(--simple-html-grid-pinned-border); border-radius: 0; font: inherit; color: inherit; background: var(--simple-html-grid-sec-bg-color); }
`;

/**
 * the rows of the demo, with a status, a progress, a website and a priority
 */
function rows(total: number) {
    return generateRows(total).map((row, i) => ({
        ...row,
        status: STATUSES[i % 3],
        progress: (i * 37) % 101,
        website: row.company.toLowerCase().replaceAll(' ', '-'),
        priority: PRIORITIES[(i * 7) % 3]
    }));
}

export const customCells: DemoSample = {
    id: 'custom-cells',
    title: 'Custom cells',
    group: 'Cells',
    description:
        "A column draws its cells with a renderer of your own: registerCellRenderer(id, renderer), and renderer: id in the column - the config stays JSON. The renderer is called once per cell element with the host to render into, and its update() every time the cell shows a row: plain DOM (status, website, date), lit-html (progress) or React and Solid (see the guide). Priority is a select that writes the row itself - Enter or a double click focuses it, Esc goes back, Ctrl+Z undoes. The other cells only draw: Enter, F2, typing or a double click opens the grid's editor of one line over the cell (Enter saves), and a click on a date the date picker. The keys, copy, ranges, Find, errors (progress is 0 to 100) and the edited marker work as in any cell. Count the renderers: as many as there are cell elements, also after 10 000 rows are scrolled.",
    run(stage) {
        const style = document.createElement('style');
        style.textContent = STYLE;
        stage.appendChild(style);
        const ui = createStage(stage);

        const config: GridConfig = {
            panelHeight: 25,
            readonly: false,
            columns: {
                status: { renderer: 'badge' },
                progress: { renderer: 'progress' },
                website: { renderer: 'link' },
                priority: { renderer: 'select' },
                date1: { renderer: 'weekday' }
            },
            layout: {
                left: [{ fields: ['company'], width: 160 }],
                center: [
                    { fields: ['status'], width: 90 },
                    { fields: ['progress'], width: 140 },
                    { fields: ['priority'], width: 100 },
                    { fields: ['website'], width: 170 },
                    { fields: ['date1'], width: 130 },
                    { fields: ['country'], width: 110 },
                    { fields: ['age'], width: 70 }
                ]
            }
        };

        const { datasource, gridInterface } = mountGrid(ui.gridHost, config, rows(500), {
            fields: {
                ...baseFields(),
                progress: {
                    type: 'number',
                    validate: [
                        { id: 'min', value: 0 },
                        { id: 'max', value: 100 }
                    ]
                }
            }
        });

        ui.button('Count the renderers', () => {
            ui.log(
                `renderers mounted: ${count.mounted}, destroyed: ${count.destroyed}, in use: ${count.mounted - count.destroyed}`
            );
        });
        ui.button('10 000 rows', () => {
            datasource.setData(rows(10000));
            ui.log('10 000 rows - scroll, then count the renderers');
        });
        ui.button('Row 1 done, from code', () => {
            // a write from code: the cell's update() gets it in the next frame
            const row = datasource.getRows()[0];
            row.status = 'done';
            row.progress = 100;
        });
        ui.button('Undo', () => datasource.undo());
        let readonly = false;
        ui.button('Toggle readonly', () => {
            readonly = !readonly;
            gridInterface.updateConfig({ readonly });
            ui.log(`grid readonly: ${readonly} - the select is disabled, the editor does not open`);
        });
    }
};
