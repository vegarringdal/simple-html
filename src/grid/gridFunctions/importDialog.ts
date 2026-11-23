import { html, nothing, render, type TemplateResult } from 'lit-html';
import type { TextId } from '../../texts';
import type { CsvSeparator } from '../csv';
import type { Grid } from '../grid';
import { type ImportSource, openImportFile, readCsvText } from '../importFile';
import { IMPORT_LIMITS, ImportFileError, type ImportFileProblem } from '../importLimits';
import type { ImportCell } from '../xlsxRead';
import { keepDialogInView, moveDialog, resizeHandles, showDialog } from './dialogFrame';
import { getColumnLabel } from './getColumnLabel';
import { gridText } from './gridText';
import {
    addImportedRows,
    cellText,
    headerFields,
    type ImportOptions,
    type ImportPlan,
    importFields,
    isBlankCell,
    planImport,
    positionFields
} from './importRows';
import { removeContextMenu } from './removeContextMenu';
import { closeTextEditor } from './textEditor';
import { attachTooltips, hideTooltip, tooltipsEnabled } from './tooltip';

/**
 * The import dialog: rows from a CSV or an Excel file, or pasted from a spreadsheet, become new rows of
 * the grid - see guides/24-import.md. A modal `<dialog class="simple-html-grid filter-editor-content
 * import-dialog">` on the body, of the filter editor's kind (dialogFrame.ts): its title bar, body and
 * footer have the filter editor's classes and look; moved by the title bar, resized from every edge and
 * corner, Esc closes it, the focus goes back to where it was.
 *
 * Opened by `gridInterface.openImport()`, *Import rows…* in the header menu and *Paste › As new rows…* in
 * the row menu (with `GridConfig.importMenu`) - that one with the rows on the clipboard, their columns
 * from the right clicked cell's column on.
 *
 * - **The rows**: *Choose file…* (an `<input type="file">`), a file dropped on the dialog, or rows pasted
 *   in it (Ctrl+V) - a CSV file, an .xlsx workbook (its sheet picked when it has more), tab separated
 *   text. Read by importFile.ts, within its limits; a file it does not read is said in words
 * - **The options**: *First row is a header* (found: the first row names fields), the separator of CSV
 *   (found from the first lines, or picked), the decimal mark when a number field is picked, the order of
 *   dates with `/` when a date field is
 * - **The columns**: a table of the first rows, a picker of the field over each column - matched by the
 *   header's names, or by position from a field, and said which - *Skip* or a field. A field picked for
 *   a second column is taken off the first
 * - **The problems**: how many rows, how many with problems, the first problems in words - a value that
 *   is not of its field's type, a validation rule broken - and the cells of the table that have one
 *   marked. *Rows with problems*: imported and marked, or skipped
 * - **Import N rows** adds them (importRows.ts): new rows, one step of the undo history, the first one
 *   selected - and closes. Cancel closes without
 *
 * What is read is held by the dialog only, never put in the page as markup: every text of the file is a
 * text binding of lit.
 */

/** the rows the table shows */
const PREVIEW_ROWS = 8;

/** the problems listed in words */
const LISTED_PROBLEMS = 8;

/** the texts of the separators */
const SEPARATOR_TEXTS: Record<CsvSeparator, TextId> = {
    ',': 'import.separator.comma',
    ';': 'import.separator.semicolon',
    '\t': 'import.separator.tab'
};

/** the texts of the problems of a file */
const FILE_PROBLEM_TEXTS: Record<ImportFileProblem, TextId> = {
    tooLarge: 'import.error.tooLarge',
    xls: 'import.error.xls',
    broken: 'import.error.broken',
    unsupported: 'import.error.unsupported'
};

/**
 * What the dialog shows and the user picked, changed in place
 */
interface ImportState {
    /** the file's name, or the text of pasted rows; null before there are rows */
    name: string | null;
    /** the rows' source: CSV text or a workbook */
    source: ImportSource | null;
    /** a file is being read */
    reading: boolean;
    /** what is wrong with the file, or the clipboard that had no rows */
    error: ImportFileProblem | 'clipboard' | null;
    /** the sheet of a workbook */
    sheet: number;
    /** the separator picked, `'auto'` the one found */
    separator: CsvSeparator | 'auto';
    /** the separator found in the CSV text */
    found: CsvSeparator | null;
    /** the rows of the sheet or the text */
    rows: ImportCell[][];
    /** the first row names the columns */
    header: boolean;
    /** the field of each column, null skips it */
    fields: (string | null)[];
    /** the fields were matched by the header's names, else by position */
    byName: boolean;
    /** the field the columns start at by position: the right clicked cell's, else the first */
    start: string | undefined;
    decimalMark: 'auto' | '.' | ',';
    dateOrder: 'DMY' | 'MDY';
    invalidRows: 'import' | 'skip';
    /** the rows read with what is picked */
    plan: ImportPlan | null;
    /** counts the files read, so a file read after another one wins */
    load: number;
}

/**
 * Opens the dialog. Open already, it starts over. Only in an editable grid where the user may add rows
 * (`gridInterface.__canAddRows()`)
 * @param source the rows: a file, the text of rows (CSV or tab separated), or none - the user picks a file
 * or pastes. `''` is a clipboard without rows: the dialog says so
 * @param start the field the columns start at by position, default the first of the layout
 */
export function openImportDialog(ctx: Grid, source?: Blob | string, start?: string) {
    if (!ctx.gridInterface.__canAddRows()) {
        return;
    }
    // a modal dialog: the editor of a multiline cell would be inert under it, saved as a click outside it does
    closeTextEditor(ctx);
    removeContextMenu(ctx);
    closeImportDialog(ctx);
    const state: ImportState = {
        name: null,
        source: null,
        reading: false,
        error: null,
        sheet: 0,
        separator: 'auto',
        found: null,
        rows: [],
        header: false,
        fields: [],
        byName: false,
        start,
        decimalMark: 'auto',
        dateOrder: 'DMY',
        invalidRows: 'import',
        plan: null,
        load: 0
    };
    const dialog = createDialog(ctx);
    const update = () => renderImportDialog(ctx, dialog, state, update);
    if (typeof source === 'string') {
        useText(ctx, state, source);
    }
    update();
    showDialog(dialog);
    if (source instanceof Blob) {
        void readFile(ctx, state, source, update);
    }
}

/**
 * Closes the dialog without importing, and takes it off the page. Does nothing when it is not open. Used
 * by its buttons, after Esc and when the grid leaves the page
 */
export function closeImportDialog(ctx: Grid) {
    const dialog = ctx.importDialog;
    if (!dialog) {
        return;
    }
    ctx.importDialog = null;
    hideTooltip();
    // close() before remove(): closing a modal dialog gives the focus back to the element that had it
    dialog.close();
    dialog.remove();
}

/**
 * Makes the dialog and puts it on the body, closed: openImportDialog renders it and shows it
 */
function createDialog(ctx: Grid): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.classList.add('simple-html-grid', 'filter-editor-content', 'import-dialog');
    // showModal() moves the focus to the dialog itself (autofocus), Tab goes on into it
    dialog.setAttribute('autofocus', '');
    dialog.tabIndex = -1;
    dialog.setAttribute('aria-labelledby', idOf(ctx, 'title'));
    if (tooltipsEnabled(ctx)) {
        dialog.classList.add('simple-html-grid-tooltips');
        attachTooltips(dialog);
    }
    // Esc: the browser closes the dialog. After the buttons, ctx.importDialog is not this dialog anymore
    dialog.addEventListener('close', () => {
        if (ctx.importDialog === dialog) {
            closeImportDialog(ctx);
        }
    });
    document.body.appendChild(dialog);
    ctx.importDialog = dialog;
    return dialog;
}

/** an id unique in the page: a page can have several grids */
function idOf(ctx: Grid, part: string) {
    return `${ctx.ariaIdPrefix}-import-${part}`;
}

/**
 * Reads a file into the dialog: its text or its workbook, then the rows of its first sheet. A file read
 * after it wins: a read that is not the last one is dropped
 */
async function readFile(ctx: Grid, state: ImportState, file: Blob, update: () => void) {
    const load = ++state.load;
    state.reading = true;
    state.error = null;
    update();
    try {
        const source = await openImportFile(file);
        const csv = source.format === 'csv' ? readCsvText(source.text) : null;
        const rows = source.format === 'csv' ? (csv?.rows ?? []) : await source.workbook.readSheet(0);
        if (load !== state.load) {
            return;
        }
        state.name = file instanceof File ? file.name : '';
        state.source = source;
        state.sheet = 0;
        state.separator = 'auto';
        state.found = csv?.separator ?? null;
        useRows(ctx, state, rows);
    } catch (error) {
        if (load !== state.load) {
            return;
        }
        state.error = error instanceof ImportFileError ? error.problem : 'broken';
    }
    state.reading = false;
    update();
}

/**
 * Pasted text as the rows: CSV or tab separated, the separator found. Empty text says the clipboard had
 * no rows
 */
function useText(ctx: Grid, state: ImportState, text: string) {
    state.load++;
    state.reading = false;
    if (text.trim() === '') {
        state.error = 'clipboard';
        return;
    }
    try {
        const { separator, rows } = readCsvText(text);
        state.error = null;
        state.name = gridText(ctx, 'import.clipboard');
        state.source = { format: 'csv', text };
        state.separator = 'auto';
        state.found = separator;
        useRows(ctx, state, rows);
    } catch (error) {
        state.error = error instanceof ImportFileError ? error.problem : 'broken';
    }
}

/**
 * New rows in the dialog - a file, another sheet, another separator: the header found, the fields matched
 */
function useRows(ctx: Grid, state: ImportState, rows: ImportCell[][]) {
    const first = rows.find((row) => !row.every(isBlankCell));
    const named = first ? headerFields(ctx.gridInterface, first) : null;
    state.rows = rows;
    state.header = named !== null;
    matchFields(ctx, state);
}

/**
 * The fields of the columns: by the header's names, when it has a header that names a field, else by
 * position from the start field. Then the rows read again
 */
function matchFields(ctx: Grid, state: ImportState) {
    const first = state.rows.find((row) => !row.every(isBlankCell));
    const named = state.header && first ? headerFields(ctx.gridInterface, first) : null;
    const width = Math.max(0, ...state.rows.map((row) => row.length));
    state.byName = named !== null;
    state.fields = named ?? positionFields(ctx.gridInterface, width, state.start);
    plan(ctx, state);
}

/** the options the rows are read with */
function optionsOf(state: ImportState): ImportOptions {
    return {
        header: state.header,
        fields: state.fields,
        decimalMark: state.decimalMark === 'auto' ? undefined : state.decimalMark,
        dateOrder: state.dateOrder,
        invalidRows: state.invalidRows
    };
}

/** the rows read again, with what is picked now */
function plan(ctx: Grid, state: ImportState) {
    state.plan = planImport(ctx.gridInterface, state.rows, optionsOf(state));
}

/**
 * Renders the dialog: see the top of the file
 */
function renderImportDialog(ctx: Grid, dialog: HTMLDialogElement, state: ImportState, update: () => void) {
    const gridInterface = ctx.gridInterface;
    const datasource = gridInterface.getDatasource();
    const text = (id: TextId, values?: Readonly<Record<string, unknown>>) => gridText(ctx, id, values);
    const labelOf = (field: string) => getColumnLabel(ctx, field);
    const close = () => closeImportDialog(ctx);
    const { plan: read } = state;

    // what is changed: the rows read again, the dialog rendered
    const change = (apply: () => void) => {
        apply();
        plan(ctx, state);
        update();
    };

    const picked = state.fields.filter((field): field is string => field !== null);
    const typeOf = (field: string) => datasource.getField(field).type;
    const problemRows = read ? read.rows.filter((row) => row.problems.length).length : 0;
    const toImport = read ? read.rows.length - (state.invalidRows === 'skip' ? problemRows : 0) : 0;
    const blocked = !read || toImport === 0 || picked.length === 0;

    const doImport = () => {
        if (blocked || !read) {
            return;
        }
        addImportedRows(gridInterface, read, optionsOf(state));
        close();
    };

    // the file input: the button opens it
    const fileInput = html`<input
        type="file"
        class="import-file-input"
        hidden
        accept=".csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        @change=${(event: Event) => {
            const input = event.target as HTMLInputElement;
            const file = input.files?.[0];
            // the same file can be picked again
            input.value = '';
            if (file) {
                void readFile(ctx, state, file, update);
            }
        }}
    />`;

    const select = (
        label: string,
        value: string,
        options: { value: string; label: string }[],
        onChange: (value: string) => void,
        className = ''
    ) =>
        html`<label class="import-option">
            <span class="import-option-label">${label}</span>
            <select
                class=${`filter-editor-value import-select ${className}`}
                data-value=${value}
                @change=${(event: Event) => onChange((event.target as HTMLSelectElement).value)}
            >
                ${options.map((option) => html`<option value=${option.value}>${option.label}</option>`)}
            </select>
        </label>`;

    const sourceLine = () => {
        if (state.reading) {
            return html`<div class="import-hint" role="status">${text('import.reading')}</div>`;
        }
        if (state.error) {
            const id: TextId = state.error === 'clipboard' ? 'import.error.clipboard' : FILE_PROBLEM_TEXTS[state.error];
            return html`<div class="import-error" role="alert">
                ${text(id, {
                    size: IMPORT_LIMITS.fileSize / 1024 / 1024,
                    rows: IMPORT_LIMITS.rows,
                    columns: IMPORT_LIMITS.columns,
                    cells: IMPORT_LIMITS.cells
                })}
            </div>`;
        }
        return nothing;
    };

    const options = () => {
        if (!state.source || !read) {
            return nothing;
        }
        const source = state.source;
        const separator =
            source.format === 'csv'
                ? select(
                      text('import.separator'),
                      state.separator,
                      [
                          {
                              value: 'auto',
                              label: text('import.separator.auto', { separator: text(SEPARATOR_TEXTS[state.found ?? ',']) })
                          },
                          ...(Object.keys(SEPARATOR_TEXTS) as CsvSeparator[]).map((each) => ({
                              value: each,
                              label: text(SEPARATOR_TEXTS[each])
                          }))
                      ],
                      (value) => {
                          state.separator = value as CsvSeparator | 'auto';
                          try {
                              const used = readCsvText(source.text, state.separator === 'auto' ? undefined : state.separator);
                              useRows(ctx, state, used.rows);
                          } catch (error) {
                              state.error = error instanceof ImportFileError ? error.problem : 'broken';
                          }
                          update();
                      }
                  )
                : nothing;
        const sheet =
            source.format === 'xlsx' && source.workbook.sheets.length > 1
                ? select(
                      text('import.sheet'),
                      String(state.sheet),
                      source.workbook.sheets.map((name, index) => ({ value: String(index), label: name })),
                      async (value) => {
                          const load = ++state.load;
                          state.sheet = Number(value);
                          try {
                              const rows = await source.workbook.readSheet(state.sheet);
                              if (load === state.load) {
                                  state.error = null;
                                  useRows(ctx, state, rows);
                              }
                          } catch (error) {
                              state.error = error instanceof ImportFileError ? error.problem : 'broken';
                          }
                          update();
                      }
                  )
                : nothing;
        const decimalMark = picked.some((field) => typeOf(field) === 'number')
            ? select(
                  text('import.decimalMark'),
                  state.decimalMark,
                  [
                      { value: 'auto', label: text('import.decimalMark.auto') },
                      { value: '.', label: text('import.decimalMark.dot') },
                      { value: ',', label: text('import.decimalMark.comma') }
                  ],
                  (value) => change(() => (state.decimalMark = value as ImportState['decimalMark']))
              )
            : nothing;
        const dateOrder = picked.some((field) => typeOf(field) === 'date' || typeOf(field) === 'datetime')
            ? select(
                  text('import.dateOrder'),
                  state.dateOrder,
                  [
                      { value: 'DMY', label: text('import.dateOrder.DMY') },
                      { value: 'MDY', label: text('import.dateOrder.MDY') }
                  ],
                  (value) => change(() => (state.dateOrder = value as ImportState['dateOrder']))
              )
            : nothing;
        return html`<div class="import-options">
            <label class="column-settings-check import-option">
                <input
                    type="checkbox"
                    .checked=${state.header}
                    @change=${(event: Event) => {
                        state.header = (event.target as HTMLInputElement).checked;
                        matchFields(ctx, state);
                        update();
                    }}
                /><span>${text('import.header')}</span>
            </label>
            ${separator} ${sheet} ${decimalMark} ${dateOrder}
        </div>`;
    };

    const table = (): TemplateResult | typeof nothing => {
        if (!state.source || !read) {
            return nothing;
        }
        const width = Math.max(0, ...state.rows.map((row) => row.length));
        if (width === 0) {
            return html`<div class="import-hint">${text('import.noRows')}</div>`;
        }
        const columns = Array.from({ length: width }, (_, i) => i);
        const headerRow = read.header === -1 ? null : state.rows[read.header];
        const nameOf = (column: number) => {
            const cell = headerRow?.[column];
            return headerRow && !isBlankCell(cell ?? null)
                ? cellText(cell ?? null)
                : text('import.column', { number: column + 1 });
        };
        const fieldOptions = importFields(gridInterface);
        const start =
            state.start && importFields(gridInterface).includes(state.start)
                ? state.start
                : state.fields.find((field) => field !== null);
        const shown = read.rows.slice(0, PREVIEW_ROWS);
        return html`<div class="import-hint">
                ${state.byName ? text('import.byName') : text('import.byPosition', { field: start ? labelOf(start) : '' })}
            </div>
            <div class="import-preview simple-html-dialog-scroller">
                <table class="import-table">
                    <thead>
                        <tr>
                            ${columns.map(
                                (column) =>
                                    html`<th>
                                        <select
                                            class="filter-editor-value import-select import-field"
                                            data-value=${state.fields[column] ?? ''}
                                            aria-label=${text('import.field', { column: nameOf(column) })}
                                            @change=${(event: Event) =>
                                                change(() => {
                                                    const value = (event.target as HTMLSelectElement).value;
                                                    const field = value === '' ? null : value;
                                                    // a field goes to one column: the one it was on is skipped
                                                    state.fields = state.fields.map((each) => (each === field ? null : each));
                                                    state.fields[column] = field;
                                                })}
                                        >
                                            <option value="">${text('import.skip')}</option>
                                            ${fieldOptions.map((field) => html`<option value=${field}>${labelOf(field)}</option>`)}
                                        </select>
                                    </th>`
                            )}
                        </tr>
                        ${
                            headerRow
                                ? html`<tr class="import-header-row">
                                  ${columns.map((column) => html`<th>${nameOf(column)}</th>`)}
                              </tr>`
                                : nothing
                        }
                    </thead>
                    <tbody>
                        ${shown.map((row) => {
                            const cells = state.rows[row.index];
                            return html`<tr>
                                ${columns.map((column) => {
                                    const field = state.fields[column];
                                    const problems = field ? row.problems.filter((problem) => problem.field === field) : [];
                                    const tooltip = problems.map((problem) => problem.message).join('\n');
                                    return html`<td
                                        class=${`${field ? '' : 'import-skipped'} ${problems.length ? 'import-cell-problem' : ''}`}
                                        data-tooltip=${tooltip || nothing}
                                    >
                                        ${cellText(cells[column] ?? null)}
                                    </td>`;
                                })}
                            </tr>`;
                        })}
                    </tbody>
                </table>
            </div>`;
    };

    const summary = () => {
        if (!state.source || !read || !state.rows.length) {
            return nothing;
        }
        const problems = read.rows.flatMap((row) => row.problems);
        const count = problemRows
            ? text('import.count.problems', { rows: read.rows.length, problems: problemRows })
            : text('import.count', { rows: read.rows.length });
        return html`<div class="import-summary" role="status">${count}</div>
            ${picked.length ? nothing : html`<div class="import-error">${text('import.noFields')}</div>`}
            ${
                problems.length
                    ? html`<ul class="import-problems">
                          ${problems.slice(0, LISTED_PROBLEMS).map(
                              (problem) =>
                                  html`<li>
                                      ${text('import.problem', { row: problem.row + 1, field: labelOf(problem.field), message: problem.message })}
                                  </li>`
                          )}
                          ${
                              problems.length > LISTED_PROBLEMS
                                  ? html`<li class="import-more">${text('import.problems.more', { count: problems.length - LISTED_PROBLEMS })}</li>`
                                  : nothing
}
                      </ul>
                      <div class="import-options">
                          ${select(
                              text('import.invalidRows'),
                              state.invalidRows,
                              [
                                  { value: 'import', label: text('import.invalidRows.import') },
                                  { value: 'skip', label: text('import.invalidRows.skip') }
                              ],
                              (value) => change(() => (state.invalidRows = value as ImportState['invalidRows']))
                          )}
                      </div>`
                    : nothing
            }`;
    };

    render(
        html`<div class="filter-editor-titlebar" @pointerdown=${(event: PointerEvent) => moveDialog(dialog, event)}>
                <span class="filter-editor-title" id=${idOf(ctx, 'title')} data-tooltip=${text('import.title.tooltip')}
                    >${text('import.title')}</span
                >
                <button
                    type="button"
                    class="filter-editor-close"
                    aria-label=${text('import.close.tooltip')}
                    data-tooltip=${text('import.close.tooltip')}
                    @click=${close}
                >
                    ✕
                </button>
            </div>
            <div
                class="filter-editor-body import-body simple-html-dialog-scroller"
                @dragover=${(event: DragEvent) => {
                    event.preventDefault();
                    dialog.classList.add('import-dropping');
                }}
                @dragleave=${() => dialog.classList.remove('import-dropping')}
                @drop=${(event: DragEvent) => {
                    event.preventDefault();
                    dialog.classList.remove('import-dropping');
                    const file = event.dataTransfer?.files[0];
                    if (file) {
                        void readFile(ctx, state, file, update);
                    } else {
                        useText(ctx, state, event.dataTransfer?.getData('text/plain') ?? '');
                        update();
                    }
                }}
                @paste=${(event: ClipboardEvent) => {
                    // rows pasted into the dialog, not into a field of it: it has none for text
                    event.preventDefault();
                    useText(ctx, state, event.clipboardData?.getData('text/plain') ?? '');
                    update();
                }}
            >
                <div class="import-source">
                    <button
                        type="button"
                        class="simple-html-grid-button"
                        @click=${(event: MouseEvent) =>
                            ((event.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}
                    >
                        ${text('import.chooseFile')}</button
                    >${fileInput}
                    ${state.name ? html`<span class="import-source-name">${state.name}</span>` : nothing}
                </div>
                <div class="import-drop">${text('import.hint')}</div>
                ${sourceLine()} ${options()} ${table()} ${summary()}
            </div>
            <div class="filter-editor-footer">
                <button type="button" class="simple-html-grid-button" @click=${close}>${text('import.cancel')}</button>
                <button
                    type="button"
                    class="simple-html-grid-button simple-html-grid-button-primary import-button"
                    aria-disabled=${blocked ? 'true' : nothing}
                    @click=${doImport}
                >
                    ${text('import.import', { rows: toImport })}
                </button>
            </div>
            ${resizeHandles(dialog)}`,
        dialog
    );
    // the value of each select: its options are rendered after its attributes, a value set with them
    // would find none
    for (const select of dialog.querySelectorAll<HTMLSelectElement>('select[data-value]')) {
        select.value = select.dataset.value ?? '';
    }
    if (dialog.open) {
        // it was centered as it opened, without the rows: grown with them, it is moved up to stay in the window
        keepDialogInView(dialog);
        // the control that had the focus is gone (a picker of a table read again): the dialog gets it
        if (!dialog.contains(document.activeElement)) {
            dialog.focus({ preventScroll: true });
        }
    }
}
