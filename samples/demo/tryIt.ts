import { createGrid, Datasource, type GridConfig, type GridInterface, isGroupRow } from '@simple-html/grid';
import { baseFields, baseGridConfig, generateRows } from './demoUtils';

/**
 * The "Try it" boxes of the user guide (user-guide/*.md, a ```tryit <id> block): a live grid of the demo
 * data and a few tasks beside it, each ticked as the reader does it - "Show only the rows of Norway",
 * "Sort by Age, highest first". The box looks at the grid every 400ms (its state, its rows, what is
 * open), so any way of doing a task counts: the filter row, a menu, the filter editor, the keyboard. A
 * task the grid can not see (a download) has a checkbox the reader ticks. "Start again" puts the grid
 * and the tasks back.
 *
 * No code is shown: the user guide is for the people using a grid.
 */

/** what a task looks at: the grid, its datasource, and how many rows the box started with */
interface Look {
    grid: GridInterface<any>;
    datasource: Datasource<any>;
    /** the rows the grid started with */
    start: number;
    /** the tasks done so far, by index: a task can follow another ("then clear it") */
    done: ReadonlySet<number>;
}

interface Task {
    /** what to do, html of our own: <b> for a name of the grid */
    text: string;
    /** done now? Left out: the reader ticks it */
    done?: (look: Look) => boolean;
}

export interface TryIt {
    id: string;
    tasks: Task[];
    /** the grid of the box: the demo's, changed for it */
    config?: (config: GridConfig) => GridConfig;
    /** how many rows, default 200 */
    rows?: number;
}

/** the data rows shown: every one of them matches, and they are some, not all */
function rowsAre(look: Look, test: (row: any) => boolean): boolean {
    const rows = look.datasource.getRows().filter((row) => !isGroupRow(row));
    return rows.length > 0 && rows.length < look.start && rows.every(test);
}

/** the field of the first sort argument, and its direction */
function sortedBy(look: Look, ...fields: { attribute: string; ascending: boolean }[]): boolean {
    const order = look.datasource.getOrderBy();
    return (
        order.length >= fields.length &&
        fields.every((field, index) => order[index]?.attribute === field.attribute && order[index].ascending === field.ascending)
    );
}

/** an element of the page is there: a menu, a dialog */
const open = (selector: string) => document.querySelector(selector) !== null;

/** the fields of the layout, left to right */
function layoutFields(look: Look): string[] {
    const { left = [], center, right = [] } = look.grid.getState().layout;
    return [...left, ...center, ...right].flatMap((column) => column.fields);
}

export const TRY_ITS: readonly TryIt[] = [
    {
        id: 'getting-started',
        tasks: [
            { text: 'Click a cell of a row.', done: ({ datasource }) => datasource.currentEntity !== null },
            { text: 'Right-click a cell: the <b>row menu</b> opens.', done: () => open('.simple-html-grid-menu') },
            {
                text: 'Click the gear <b>⚙</b> at the right of the footer: <b>Grid config</b> opens.',
                done: () => open('dialog.column-settings')
            },
            {
                text: 'Press <b>Ctrl+/</b> in the grid (⌘/ on a Mac): the keyboard shortcuts.',
                done: () => open('dialog.shortcut-help')
            }
        ]
    },
    {
        id: 'filtering',
        tasks: [
            {
                text: 'Show only the rows of <b>Norway</b>: type <code>norway</code> in the filter under <b>Country</b>, then <b>Enter</b>.',
                done: (look) => rowsAre(look, (row) => row.country === 'Norway')
            },
            {
                text: 'Show the ages from <b>30</b> to <b>40</b>: change the operator of <b>Age</b> to <b>Between</b> and type <code>30..40</code>.',
                done: (look) => rowsAre(look, (row) => row.age >= 30 && row.age <= 40)
            },
            {
                text: 'Right-click the filter of <b>Fruit</b> and check only <b>Apple</b> and <b>Mango</b> in its list.',
                done: (look) =>
                    rowsAre(look, (row) => row.favoriteFruit === 'Apple' || row.favoriteFruit === 'Mango') &&
                    look.datasource.getRows().some((row: any) => row.favoriteFruit === 'Apple') &&
                    look.datasource.getRows().some((row: any) => row.favoriteFruit === 'Mango')
            },
            {
                text: 'Click the checkbox in the filter of <b>Active</b>: only the active rows.',
                done: (look) => rowsAre(look, (row) => row.isActive === true)
            },
            {
                text: 'Clear every filter with <b>✕ Clear</b> in the footer.',
                done: ({ datasource, done }) => done.size > 0 && datasource.getFilter() === null
            }
        ]
    },
    {
        id: 'sorting',
        tasks: [
            {
                text: 'Click the header <b>Age</b>: the youngest first.',
                done: (look) => sortedBy(look, { attribute: 'age', ascending: true })
            },
            {
                text: 'Click it again: the oldest first.',
                done: (look) => sortedBy(look, { attribute: 'age', ascending: false })
            },
            {
                text: 'Click <b>Country</b>, then <b>Shift+click</b> <b>Age</b>: by country, and the ages in each.',
                done: (look) =>
                    look.datasource.getOrderBy().length >= 2 &&
                    look.datasource.getOrderBy()[0].attribute === 'country' &&
                    look.datasource.getOrderBy()[1].attribute === 'age'
            }
        ]
    },
    {
        id: 'grouping',
        tasks: [
            {
                text: 'Drag the header <b>Country</b> up to the panel above the headers: a group for each country.',
                done: ({ datasource }) => datasource.getGrouping()[0]?.attribute === 'country'
            },
            {
                text: 'Drag <b>Fruit</b> next to it: the fruits in each country.',
                done: ({ datasource }) =>
                    datasource
                        .getGrouping()
                        .map((group) => group.attribute)
                        .join() === 'country,favoriteFruit'
            },
            {
                text: 'The groups start closed. Right-click a header and pick <b>Grouping › Expand all</b>.',
                done: ({ datasource }) =>
                    datasource.getGrouping().length > 0 && datasource.getRows().filter((row) => !isGroupRow(row)).length > 0
            },
            {
                text: 'Close them again with <b>Grouping › Collapse all</b>.',
                done: ({ datasource, done }) =>
                    done.has(2) && datasource.getGrouping().length > 0 && datasource.getRows().every((row) => isGroupRow(row))
            },
            {
                text: 'Take the grouping away: the <b>✕</b> of each chip in the panel.',
                done: ({ datasource, done }) => done.has(0) && datasource.getGrouping().length === 0
            }
        ]
    },
    {
        id: 'columns',
        tasks: [
            {
                text: 'Drag the header <b>Age</b> to the left of <b>Company</b>.',
                done: (look) => layoutFields(look).indexOf('age') < layoutFields(look).indexOf('company')
            },
            {
                text: 'Make <b>Company</b> wider: drag the right edge of its header.',
                done: ({ grid }) => {
                    const { left = [], center, right = [] } = grid.getState().layout;
                    return [...left, ...center, ...right].some(
                        (column) => column.fields.includes('company') && column.width > 200
                    );
                }
            },
            {
                text: 'Right-click the header <b>Company</b> and pin it to the left.',
                done: ({ grid }) => (grid.getState().layout.left ?? []).some((column) => column.fields.includes('company'))
            },
            { text: 'Hide the column <b>Phone</b> from its header menu.', done: (look) => !layoutFields(look).includes('phone') }
        ]
    },
    {
        id: 'formatting',
        tasks: [
            {
                text: 'Right-click the header <b>Date</b> and pick <b>Format › Norwegian</b>.',
                done: ({ grid }) => grid.getState().formats.date1?.date === 'norwegian'
            },
            {
                text: 'Open <b>Grid config</b> (⚙), pick <b>Balance</b>, and on its <b>Colours</b> tab add a colour rule: <b>Less than</b> <code>500</code>, red. Then <b>Apply</b>.',
                done: ({ grid }) => (grid.getState().formats.balance?.rules ?? []).length > 0
            },
            {
                text: 'Give <b>Balance</b> a <b>Data bar</b> on the same tab.',
                done: ({ grid }) => grid.getState().formats.balance?.bar !== undefined
            },
            {
                text: 'Show <b>Company</b> as a link (its <b>Display</b> tab): <b>Show as link</b>, an address such as <code>https://duckduckgo.com/?q={company}</code>.',
                done: ({ grid }) => grid.getState().formats.company?.link !== undefined
            }
        ]
    },
    {
        id: 'calculated-columns',
        tasks: [
            {
                text: 'Open <b>Grid config</b> (⚙) and click <b>Add calculated column</b>.',
                done: () => open('dialog.column-settings .column-settings-calculated')
            },
            {
                text: 'Write the formula <code>{balance} / {age}</code> and <b>Apply</b>: the balance per year of age.',
                done: ({ grid }) =>
                    Object.values(grid.getState().calculatedColumns).some(
                        (column) => column.formula.includes('{balance}') && column.formula.includes('{age}')
                    )
            },
            {
                text: 'Add one with a function from the <b>ƒ</b> menu: <code>LEFT({company}, 3)</code>, or <code>ROUND({balance} / 1000)</code>.',
                done: ({ grid }) =>
                    Object.values(grid.getState().calculatedColumns).some((column) => /[A-Z]+\(/.test(column.formula))
            }
        ]
    },
    {
        id: 'editing',
        tasks: [
            {
                text: 'Click a cell of <b>Company</b> and type a new name.',
                done: ({ datasource }) => datasource.getChanges().modifiedEntities.length > 0
            },
            {
                text: 'Take it back with <b>Ctrl+Z</b> (⌘Z on a Mac).',
                done: ({ datasource, done }) => done.has(0) && datasource.getChanges().modifiedEntities.length === 0
            },
            {
                text: 'Click the checkbox of <b>Active</b> in a row.',
                done: ({ datasource }) =>
                    datasource.getChanges().modifiedEntities.some((change: any) => Object.hasOwn(change, 'isActive'))
            },
            {
                text: 'Right-click a row and delete it: it is marked, not gone, until your app saves.',
                done: ({ datasource }) => datasource.getChanges().deletedEntities.length > 0
            }
        ]
    },
    {
        id: 'selecting-and-copying',
        tasks: [
            {
                text: 'Click a row number: the row is selected.',
                done: ({ datasource }) => datasource.getSelectedRows().length > 0
            },
            {
                text: '<b>Shift+click</b> another row number a few rows down: every row between.',
                done: ({ datasource }) => datasource.getSelectedRows().length >= 3
            },
            {
                text: 'Drag over some cells of <b>Age</b> and <b>Balance</b>: a range - its sum is in the footer.',
                done: ({ grid }) =>
                    grid.getRanges().some((range) => range.fromRow !== range.toRow || range.fromField !== range.toField)
            },
            { text: 'Copy it with <b>Ctrl+C</b> (⌘C) and paste it in a spreadsheet or a mail.' }
        ]
    },
    {
        id: 'find',
        tasks: [
            { text: 'Click a cell, then press <b>Ctrl+F</b> (⌘F): the find bar.', done: ({ grid }) => grid.getFind().open },
            {
                text: 'Type <code>acme</code>: the cells are marked, <b>Enter</b> goes to the next.',
                done: ({ grid }) => grid.getFind().text.toLowerCase() === 'acme' && grid.getFind().count > 0
            },
            {
                text: 'Click the funnel <b>Filter rows</b>: only the rows with a match.',
                done: ({ grid }) => grid.getFind().filterRows
            },
            { text: 'Close the bar with <b>Esc</b>.', done: ({ grid, done }) => done.has(0) && !grid.getFind().open }
        ]
    },
    {
        id: 'export',
        tasks: [
            {
                text: 'Filter the grid as you like: on <b>Country</b>, say.',
                done: ({ datasource }) => datasource.getFilter() !== null
            },
            { text: 'Right-click a cell and pick <b>Export › Excel, all rows</b>. Open the file.' },
            { text: 'Select a few rows (their numbers) and export <b>Excel, selected rows</b>.' }
        ]
    },
    {
        id: 'import',
        config: (config) => ({ ...config, importMenu: true }),
        tasks: [
            {
                text: 'Right-click the header <b>Company</b> and pick <b>Import rows…</b>.',
                done: () => open('dialog.import-dialog')
            },
            {
                text: 'Copy a few rows from a spreadsheet - or from this grid - paste them in, and <b>Import</b>.',
                done: ({ datasource, start }) => datasource.getAllData().length > start
            }
        ]
    },
    {
        id: 'views',
        config: (config) => ({ ...config, viewsButton: true }),
        tasks: [
            {
                text: 'Sort or filter the grid, then click the views button at the left of the footer and <b>Save as…</b> a view.',
                done: ({ grid }) => grid.getViews().length > 0
            },
            {
                text: 'Switch back to <b>Standard</b> in the same menu.',
                done: ({ grid, done }) => done.has(0) && grid.getCurrentView() === null
            },
            {
                text: 'Make your view the <b>Default view</b>: the grid opens with it.',
                done: ({ grid }) => grid.getViews().some((view) => view.default)
            }
        ]
    },
    {
        id: 'grid-config',
        tasks: [
            { text: 'Click the gear <b>⚙</b> in the footer.', done: () => open('dialog.column-settings') },
            {
                text: 'Pick <b>Balance</b>, give it a format on its <b>Display</b> tab and press <b>Apply</b>.',
                done: ({ grid }) => grid.getState().formats.balance !== undefined
            },
            {
                text: 'On the <b>Defaults</b> tab, pick a format for every <b>Date</b> column and <b>Apply</b>.',
                done: ({ grid }) => grid.getState().typeFormats.date !== undefined
            }
        ]
    },
    {
        id: 'detail-form',
        config: (config) => ({
            ...config,
            detailForm: { show: true, fields: ['company', 'country', 'age', 'balance', 'date1', 'isActive'], width: 260 }
        }),
        tasks: [
            { text: 'Click a row: the form at the right shows it.', done: ({ datasource }) => datasource.currentEntity !== null },
            {
                text: 'Change its <b>Country</b> in the form.',
                done: ({ datasource }) =>
                    datasource.getChanges().modifiedEntities.some((change: any) => Object.hasOwn(change, 'country'))
            },
            {
                text: 'Collapse the form with its button, and open it again.',
                done: ({ grid, done }) => done.has(0) && grid.getState().detailForm?.expanded === false
            }
        ]
    },
    {
        id: 'keyboard',
        tasks: [
            {
                text: 'Click a cell, then press <b>Ctrl+/</b> (⌘/): every key of the grid.',
                done: () => open('dialog.shortcut-help')
            },
            {
                text: 'Close it with <b>Esc</b>, and move to the next row with <b>Alt+ArrowDown</b>.',
                done: ({ done }) => done.has(0) && !open('dialog.shortcut-help')
            },
            { text: 'Press <b>Ctrl+F</b> (⌘F): the find bar.', done: ({ grid }) => grid.getFind().open }
        ]
    }
];

/** the fields of the boxes: the demo's, with labels as a user would see them */
function fields() {
    return {
        ...baseFields(),
        date1: { type: 'date' as const, label: 'Date' },
        isActive: { type: 'boolean' as const, label: 'Active' },
        favoriteFruit: { label: 'Fruit' }
    };
}

/**
 * Puts a "Try it" box in a div.doc-tryit[data-tryit=<id>] of a user guide page: the grid, the tasks,
 * Start again. Looks at the grid while the box is on the page
 */
export function renderTryIt(block: HTMLElement) {
    const tryIt = TRY_ITS.find((each) => each.id === block.dataset.tryit);
    if (!tryIt) {
        block.classList.add('doc-missing');
        block.textContent = `unknown try it: "${block.dataset.tryit}"`;
        return;
    }
    block.replaceChildren();
    const head = document.createElement('div');
    head.className = 'tryit-head';
    const title = document.createElement('span');
    title.className = 'tryit-title';
    title.textContent = 'Try it';
    const progress = document.createElement('span');
    progress.className = 'tryit-progress';
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'demo-btn tryit-again';
    again.textContent = 'Start again';
    head.append(title, progress, again);

    const list = document.createElement('ol');
    list.className = 'tryit-tasks';
    const host = document.createElement('div');
    host.className = 'tryit-grid';
    block.append(head, list, host);

    let look: Look;
    const done = new Set<number>();
    const items = tryIt.tasks.map((task, index) => {
        const item = document.createElement('li');
        item.className = 'tryit-task';
        const mark = document.createElement('input');
        mark.type = 'checkbox';
        mark.className = 'tryit-mark';
        mark.disabled = task.done !== undefined;
        mark.setAttribute('aria-label', task.done ? 'Done when you have done it' : 'Tick when done');
        mark.addEventListener('change', () => {
            if (mark.checked) {
                done.add(index);
            } else {
                done.delete(index);
            }
            show();
        });
        const text = document.createElement('span');
        // our own html: <b> and <code>, written in TRY_ITS - nothing from the page or the grid
        text.innerHTML = task.text;
        item.append(mark, text);
        list.appendChild(item);
        return { item, mark };
    });

    const show = () => {
        items.forEach(({ item, mark }, index) => {
            mark.checked = done.has(index);
            item.classList.toggle('tryit-done', done.has(index));
        });
        progress.textContent = done.size === tryIt.tasks.length ? 'All done' : `${done.size} of ${tryIt.tasks.length} done`;
    };

    const start = () => {
        host.replaceChildren();
        const datasource = new Datasource({ fields: fields() });
        datasource.setData(generateRows(tryIt.rows ?? 200));
        const base = baseGridConfig();
        const config = tryIt.config ? tryIt.config(base) : base;
        const grid = createGrid(host, { config, datasource });
        look = { grid, datasource, start: datasource.getAllData().length, done };
        done.clear();
        show();
    };
    again.addEventListener('click', start);
    start();

    // the tasks the grid tells, every 400ms while the box is on the page; a task done stays done
    const timer = setInterval(() => {
        if (!block.isConnected) {
            clearInterval(timer);
            return;
        }
        let changed = false;
        tryIt.tasks.forEach((task, index) => {
            if (task.done && !done.has(index)) {
                let now = false;
                try {
                    now = task.done(look);
                } catch {
                    now = false;
                }
                if (now) {
                    done.add(index);
                    changed = true;
                }
            }
        });
        if (changed) {
            show();
        }
    }, 400);
}
