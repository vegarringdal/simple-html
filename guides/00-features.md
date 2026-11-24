# Feature overview

What `@simple-html/grid` can do, at a glance: a table per area, each feature in a line, with a link to
the guide that explains it and a live sample to try it in. The [Full grid](#sample/full-grid) sample has
most of it in one grid: 50 columns, 5 000 rows. New to the grid? Start with
[Getting started](01-getting-started.md).

On a Mac, Ctrl is Cmd and Alt is Option.

## Data and setup

| Feature | What it does | See |
| --- | --- | --- |
| No framework needed | Plain TypeScript or JavaScript: `createGrid()` puts a grid in any element of the page. Its only dependency is lit-html | [guide](01-getting-started.md#a-first-grid) · [sample](#sample/basic-grid) |
| Typed fields | Text, number, date, date and time, and yes/no fields: each sorts, filters, aligns and is edited as its type | [guide](04-datasource.md#fields-and-types) · [sample](#sample/basic-grid) |
| Config as plain data | The columns, the options and the fields are JSON: store them in a backend. What has to be code is a hook beside them | [guide](02-grid-config.md#saving-the-config) |
| Many rows | Only the rows on screen are drawn, so thousands of rows scroll fast | [sample](#sample/full-grid) |
| Load and add rows | Replace the rows, add more at the end, or merge what a server sends | [guide](04-datasource.md#data-in-setdata) · [sample](#sample/rows-data) |
| Keys | A key field ties the selection and the edits to the row, also when fresh rows come from the server | [guide](04-datasource.md#keys) |
| The current row | The row the user is on, for a panel or form beside the grid | [guide](04-datasource.md#the-current-row) · [sample](#sample/detail-form) |
| Two grids, one set of rows | Two grids share their rows, each with its own filter, sort and selection | [guide](04-datasource.md#sharing-the-rows-between-two-datasources) |
| Hooks | Your code for what data can not say: readonly cells and css classes from the row, changes to the menus | [guide](02-grid-config.md#hooks) · [sample](#sample/cell-styling) |
| Events | Know when rows change, are sorted, filtered or selected, and when cells are clicked or focused | [guide](09-events.md) · [sample](#sample/events) |

## Columns and layout

| Feature | What it does | See |
| --- | --- | --- |
| Pinned columns | Columns pinned left or right stay in place while the rest scroll sideways | [guide](02-grid-config.md#columns-and-layout) · [sample](#sample/column-layout) |
| Stacked fields | One column shows several fields, one above the other | [guide](02-grid-config.md#columns-and-layout) · [sample](#sample/column-layout) |
| Move, resize, pin, hide | Drag a label to move a column, drag its edge to resize it; pin and hide it from the header menu | [guide](02-grid-config.md#moving-and-resizing-columns) · [sample](#sample/column-layout) |
| Column chooser | Every column in a list with a search: drag one into the header to show it, rename it | [guide](10-menus.md#the-column-chooser) · [sample](#sample/column-layout) |
| Fit to the content | Columns as wide as their text and rows as tall as their lines, like Excel's AutoFit - or a double click on a column's edge | [guide](02-grid-config.md#column-widths-and-row-heights) · [sample](#sample/multiline) |
| Sizes and parts | Row and header heights; hide the labels, the filters, the column numbers or the footer | [guide](02-grid-config.md#grid-options) · [sample](#sample/misc-options) |

## Display and formatting

| Feature | What it does | See |
| --- | --- | --- |
| Formatters | Numbers with a decimal point or comma, dates as `2026-11-22` or `22.11.2026`: how values are shown, and how what is typed is read | [guide](08-formatting.md#the-built-in-formatters) · [sample](#sample/formatters) |
| A formatter of your own | Show and read a field your way - a country in upper case, a phone number without spaces - registered once by a name | [guide](08-formatting.md#a-formatter-of-your-own) · [sample](#sample/custom-formatter) |
| Display formats | Show a date as Norwegian, US, a week or the days until; a number with decimals and a thousands separator. The value stays as it is | [guide](08-formatting.md#display-formats) · [sample](#sample/full-grid) |
| Templates and links | A text column shows a template of fields - `{name} ({id})` - and links to a web address, an email or a phone number | [guide](08-formatting.md#templates-and-links) · [sample](#sample/full-grid) |
| Colour rules | Colour a cell from its value - a negative balance in red, waiting orders on orange - from 14 colours or any colour picked; or from other fields of the row, or a formula. No code | [guide](08-formatting.md#colour-rules) · [sample](#sample/full-grid) |
| Data bars | A bar in a number cell as long as the value's place among the column's numbers, negative values left of 0, as Excel's | [guide](08-formatting.md#data-bars) · [sample](#sample/full-grid) |
| Colour scales | A heat map: the cell's background from red to yellow to green - two or three colours - by the value | [guide](08-formatting.md#colour-scales) · [sample](#sample/full-grid) |
| Icon sets | Arrows, traffic lights, flags or ✓ ! ✕ before the value by thresholds, said in words to a screen reader | [guide](08-formatting.md#icon-sets) · [sample](#sample/full-grid) |
| Calculated columns | A column computed from other fields with a safe formula - `{price} * {qty}`, `IF(...)`, `DAYS({due}, TODAY())` - sorted, filtered, grouped and exported as any column, never saved | [guide](23-calculated-columns.md) · [sample](#sample/calculated-columns) |
| Labels and placeholders | Rename a column; show a hint in an empty cell or an empty header filter | [guide](08-formatting.md#label-placeholder-blank--0-checkboxes-multiline-read-only) · [sample](#sample/required-placeholders) |
| Checkboxes | Yes/no fields are checkboxes; so can a column of `1` / `0` or `Y` / `N` be | [guide](08-formatting.md#checkboxes) · [sample](#sample/full-grid) |
| Multiline text | Notes and addresses: the first line in the cell, more lines in its tooltip and in a bigger editor | [guide](05-editing.md#multiline-text) · [sample](#sample/multiline) |
| Blank or 0 | Show 0 as an empty cell, or an empty cell as 0 | [guide](08-formatting.md#showing-0-or-an-empty-cell-numberoverride) · [sample](#sample/misc-options) |
| Dim repeated values | A value the same as in the row above is greyed out, easy to read when sorted | [guide](02-grid-config.md#grid-options) · [sample](#sample/misc-options) |
| Cell and row styling | Css classes on cells and rows from their values: a tint, bold, italic | [guide](02-grid-config.md#readonly-and-css-classes-from-the-row) · [sample](#sample/cell-styling) |
| Custom cells | Draw cells with your own code - plain DOM, lit-html, React, Solid: a badge, a progress bar, a select | [guide](21-custom-cells.md) · [sample](#sample/custom-cells) |
| A type per row | One column whose cells are text, a number, a date or a checkbox, by another field of the row | [guide](08-formatting.md#the-type-from-another-field) · [sample](#sample/dynamic-cell-types) |
| Tooltips | On the buttons, validation messages on a cell, the lines of a multiline cell | [guide](02-grid-config.md#grid-options) · [sample](#sample/tooltips) |

## Filtering

| Feature | What it does | See |
| --- | --- | --- |
| Header filters | A filter under each label: type and press Enter. `*` and `_` are wildcards | [guide](06-filtering.md#header-filters) · [sample](#sample/filtering) |
| Operators | Equals, contains, begins with, greater than, between, blank ... picked from the symbol in the filter or its menu | [guide](06-filtering.md#the-operator-in-the-cell) · [sample](#sample/filter-operator-header) |
| Value list | Tick the values to show, as in a spreadsheet, each with its count. A search narrows the list, or filters on the text | [guide](06-filtering.md#the-value-list) · [sample](#sample/filtering) |
| Range block | For numbers and dates: an operator and a value, or from and to, in one go | [guide](06-filtering.md#the-range-block) · [sample](#sample/filtering) |
| Date and range pickers | A calendar for a date filter; two months side by side for a range | [guide](06-filtering.md#the-range-picker) · [sample](#sample/filtering) |
| Quick dates | One click for Today, This week, Last month, This quarter, Last 30 days, Overdue ... - kept as "this month", so a saved view still means this month next month | [guide](06-filtering.md#quick-dates) · [sample](#sample/filtering) |
| Filter as shown | Type the filter as the cells show it: `2026-W47` is that week, `1 234,5` that number | [guide](06-filtering.md#filter-as-shown) · [sample](#sample/full-grid) |
| Filter as you type | Filters after a short pause, no Enter needed - per column, turned on by the user or you | [guide](06-filtering.md#filter-as-you-type) · [sample](#sample/filter-operator-header) |
| Match case | `Oslo` matches `Oslo`, not `OSLO`: upper and lower case as typed | [guide](06-filtering.md#match-case) · [sample](#sample/filtering) |
| Filter on a cell | Right click a cell: filter on its value, or add it to the filter there is | [guide](06-filtering.md#filters-from-the-row-menu) · [sample](#sample/context-menu) |
| Filter editor | A dialog for any filter: AND and OR groups, nested, with undo and redo | [guide](06-filtering.md#the-filter-editor) · [sample](#sample/filtering) |
| Filter in the footer | The row count and the filter as chips: click them to edit, ✕ to clear | [guide](06-filtering.md#the-footer) · [sample](#sample/filtering) |
| Changed rows only | Show only the new, edited and deleted rows, to check them before saving | [guide](06-filtering.md#changed-rows-only) · [sample](#sample/editing) |
| Filters from code | `where()`, `and()`, `or()`: plain data you can store, or send to a server | [guide](06-filtering.md#filters-from-code) · [sample](#sample/filtering) |
| The filter as text | One line that says what the rows are filtered by | [guide](06-filtering.md#the-filter-as-text) |

## Sorting and grouping

| Feature | What it does | See |
| --- | --- | --- |
| Sort | Click a label; again for the other way; Shift+click to sort on one more column | [guide](07-sorting-grouping.md#sorting) · [sample](#sample/sorting-grouping) |
| Group | Drag a label to the panel above the header; group in groups, drag the chips to reorder them | [guide](07-sorting-grouping.md#grouping) · [sample](#sample/sorting-grouping) |
| Expand and collapse | Each group, or all of them from the header menu | [guide](07-sorting-grouping.md#grouping) · [sample](#sample/sorting-grouping) |
| Aggregates | Sum, average, min, max or count of a column, in every group row | [guide](18-aggregates.md#in-the-group-rows) · [sample](#sample/aggregates) |
| Totals row | A row under the rows with the aggregates of every row the filter lets through | [guide](18-aggregates.md#the-totals-row) · [sample](#sample/aggregates) |
| Aggregates from the menu | The user turns each aggregate and the totals row on and off in the header menu | [guide](18-aggregates.md#from-the-header-menu) · [sample](#sample/aggregates) |

## Selection and clipboard

| Feature | What it does | See |
| --- | --- | --- |
| Select rows | Click a row number, Ctrl+click for one more, Shift+click for the rows between; the corner selects all. Many, one or none | [guide](17-selection-and-clipboard.md#selecting-rows) · [sample](#sample/selection) |
| Select columns | Click the column numbers under the filters: Ctrl+click and Shift+click as for rows | [guide](17-selection-and-clipboard.md#selecting-columns) · [sample](#sample/ranges) |
| Ranges of cells | Drag over cells, Shift+click to extend, Ctrl+click for one more range - or Alt+Shift+arrows | [guide](17-selection-and-clipboard.md#ranges-of-cells) · [sample](#sample/ranges) |
| Summary in the footer | Count, sum, average, min and max of the selected cells, as a spreadsheet's status bar | [guide](17-selection-and-clipboard.md#the-summary-in-the-footer) · [sample](#sample/ranges) |
| Copy | Ctrl+C copies the cells with their column labels: a table in Excel, Google Sheets and Word | [guide](17-selection-and-clipboard.md#copy) · [sample](#sample/ranges) |
| Paste | Ctrl+V pastes cells copied in Excel or in the grid; one value fills a whole range | [guide](17-selection-and-clipboard.md#paste) · [sample](#sample/ranges) |
| Fill down | Ctrl+D, or drag the small square at the corner of a range, as in a spreadsheet | [guide](17-selection-and-clipboard.md#fill-down) · [sample](#sample/ranges) |
| Clear | Delete empties every cell of the ranges, readonly cells skipped | [guide](17-selection-and-clipboard.md#delete) · [sample](#sample/ranges) |

## Editing

| Feature | What it does | See |
| --- | --- | --- |
| Edit in the cells | Turn editing on and type: what is typed is read as the field's type, a number or a date | [guide](05-editing.md#how-the-user-edits) · [sample](#sample/editing) |
| Editors | A date picker, checkboxes, a bigger editor for text of several lines | [guide](05-editing.md#how-the-user-edits) · [sample](#sample/full-grid) |
| Lookups | Pick a value from a list with a search: store a code, show its name, copy more fields from the row picked | [guide](20-lookups.md) · [sample](#sample/lookups) |
| Dropdown grid | Pick from a grid of its own under the cell - several columns, its filters - or just type to search it | [guide](20-lookups.md#the-dropdown-grid) · [sample](#sample/dropdown-grid) |
| Validation | Rules per field: required, min, max, length, a pattern or your own. The error shows on the cell and its row | [guide](05-editing.md#validation) · [sample](#sample/validation) |
| Required fields | Empty cells that must be filled in are striped until they have a value | [guide](05-editing.md#required-fields-and-placeholders) · [sample](#sample/required-placeholders) |
| Undo and redo | Ctrl+Z and Ctrl+Y for typing, paste, clear, fill and delete; the grid goes to what changed | [guide](05-editing.md#undo-and-redo) · [sample](#sample/editing) |
| Put a value back | Click the marker of an edited cell for its original value, or undo the edits of a row | [guide](05-editing.md#reverting-a-cell-or-a-row) · [sample](#sample/editing) |
| Change tracking | New, edited and deleted rows are shown on the row number, edited cells get a marker | [guide](05-editing.md#change-tracking) · [sample](#sample/editing) |
| New and deleted rows | Add empty rows; a delete marks the row, so it can be undone until it is saved | [guide](05-editing.md#new-rows) · [sample](#sample/rows-data) |
| Saving | Collect the new, edited and deleted rows for the server in one call, then take in the ids it gives | [guide](05-editing.md#saving) · [sample](#sample/saving) |
| Errors from the server | Show a server's message on the rows it refused | [guide](05-editing.md#errors-from-a-server) · [sample](#sample/validation) |
| Edit permissions | Allow adding, changing and deleting rows each on its own: add only, say | [guide](05-editing.md#edit-permissions-add-change-delete) · [sample](#sample/edit-permissions) |
| Readonly columns and rows | A column readonly, or cells readonly from their row with a hook | [guide](02-grid-config.md#readonly-and-css-classes-from-the-row) · [sample](#sample/cell-styling) |

## Find

| Feature | What it does | See |
| --- | --- | --- |
| Find in the grid | Ctrl+F opens a find bar: every cell that shows the text is marked, with a count; Enter goes to the next | [guide](19-find.md#the-keys) · [sample](#sample/find) |
| Match case | Find the text with upper and lower case as typed | [guide](19-find.md#match-case) · [sample](#sample/find) |
| Filter rows | Show only the rows with a match | [guide](19-find.md#filter-rows) · [sample](#sample/find) |
| Rows loaded later | Filter rows filters the rows a backend sends after it was turned on, in the browser | [guide](19-find.md#filter-rows-and-a-backend) · [sample](#sample/find) |

## Detail form

| Feature | What it does | See |
| --- | --- | --- |
| The row as a form | A panel at the right of the rows: a label and a value for each field picked - also fields that are no column, and long notes in full | [guide](02-grid-config.md#the-detail-form) · [sample](#sample/detail-form) |
| Edit in the form | The same rules, validation and undo as the cells | [guide](02-grid-config.md#the-detail-form) · [sample](#sample/detail-form) |
| Resize and collapse | Drag its edge, fold it to a strip; on a narrow screen it goes under the rows | [guide](02-grid-config.md#the-detail-form) · [sample](#sample/detail-form) |

## Grid config dialog

| Feature | What it does | See |
| --- | --- | --- |
| Column settings | The gear in the footer: per column its label, display format, template and link, checkbox, multiline, read only, placeholder and colour rules | [guide](08-formatting.md#the-grid-config-dialog) · [sample](#sample/full-grid) |
| Detail form settings | The fields of the detail form and their order, its width | [guide](08-formatting.md#the-grid-config-dialog) · [sample](#sample/detail-form) |
| Kept with the state | What the user sets there is saved and restored with the rest of the state | [guide](03-state.md#display-formats-in-the-state) · [sample](#sample/full-grid) |

## Menus

| Feature | What it does | See |
| --- | --- | --- |
| Row menu | Right click a cell or a row number: undo, select, copy, paste, clear, delete, filter on the value, sizes, export | [guide](10-menus.md#row-menu-menu_idsrow) · [sample](#sample/context-menu) |
| Header menu | Right click a label: pin, hide, remove the sort, the column chooser, sizes, display format, aggregates, grouping | [guide](10-menus.md#header-menu-menu_idsheader) · [sample](#sample/context-menu) |
| Filter menu | Right click a header filter: the operator, blank, match case, the value list or range block, the filter editor | [guide](10-menus.md#filter-menu-menu_idsfilter) · [sample](#sample/filtering) |
| Column number menu | Right click a column number: select columns, copy them or their labels | [guide](10-menus.md#column-menu-menu_idscolumn) · [sample](#sample/ranges) |
| Change the menus | A hook hides, reorders, renames or adds entries | [guide](10-menus.md#changing-the-grids-menus) · [sample](#sample/context-menu) |
| Menus of your own | Open a menu in the same style, with submenus - or a grid in it, to pick from | [guide](10-menus.md#a-menu-of-your-own-openmenu-and-closemenu) · [sample](#sample/context-menu) |
| Submenus and keys | Submenus open beside their item; arrows, Enter and Esc work in every menu | [guide](10-menus.md#the-keyboard) · [sample](#sample/context-menu) |

## Export

| Feature | What it does | See |
| --- | --- | --- |
| Excel | An .xlsx file of real numbers and dates, the header row frozen with Excel's filter, the columns as wide as in the grid | [guide](15-export.md#excel) · [sample](#sample/export) |
| Colours in Excel | The colour rules as the cells' colours, the data bars, colour scales and icon sets as Excel's own conditional formatting, the number formats too | [guide](15-export.md#colours) · [sample](#sample/full-grid) |
| CSV | Text for any program: the values as shown or as they are, a comma, a semicolon or a tab between them | [guide](15-export.md#csv) · [sample](#sample/export) |
| Safe for spreadsheets | Text starting with `=`, `+`, `-` or `@` is written so a spreadsheet does not run it as a formula | [guide](15-export.md#formulas-csv-injection) · [sample](#sample/export) |
| From the menu | Right click a cell: Export › Excel, all rows or the selected rows | [guide](15-export.md#from-the-row-menu) · [sample](#sample/export) |
| What you see | The rows the filter lets through, sorted, the columns in their order - or the selected rows | [guide](15-export.md#the-rows) · [sample](#sample/export) |
| Import | Rows pasted from Excel, or a CSV or Excel file, become new rows: see where each column goes, what is wrong, then import - one undo step | [guide](24-import.md) · [sample](#sample/import) |

## State

| Feature | What it does | See |
| --- | --- | --- |
| Save and restore | What the user changed - column order and widths, sorting, grouping, filters, formats, aggregates, the detail form - as plain data to store and give back | [guide](03-state.md#getstate-setstate-and-resetstate) · [sample](#sample/grid-state) |
| Start and reset | The state a grid starts in, and a reset back to it | [guide](03-state.md#the-state-the-grid-starts-in) · [sample](#sample/grid-state) |
| Named views | "My open orders", "Late deliveries": save views of the grid and switch with one click in the footer - Save, Save as, Revert, Rename, Delete, a default view; shared views of yours; kept in the browser or your backend | [guide](03-state.md#views) · [sample](#sample/views) |

## Live data

| Feature | What it does | See |
| --- | --- | --- |
| Merge rows from a server | Update, add and remove rows by key; the selection, open groups and scroll position stay | [guide](16-live-data.md#merging-rows-by-key-upsert) · [sample](#sample/live-data) |
| Changes flash | A cell a merge changed flashes once | [guide](16-live-data.md#how-the-grid-shows-them) · [sample](#sample/live-data) |
| The user's edits are kept | A merge never overwrites an edit not yet saved; it reports the clash instead | [guide](16-live-data.md#conflicts) · [sample](#sample/live-data) |
| No refresh needed | A value set from code shows in the grid on its own | [guide](16-live-data.md#values-show-on-their-own) · [sample](#sample/live-data) |

## Theming

| Feature | What it does | See |
| --- | --- | --- |
| Two themes | The default theme and TreDeSpace, each light and dark: four looks | [guide](13-theming.md#themes) · [sample](#sample/theming) |
| Dark mode | The grid follows the page's colour scheme: one line of css | [guide](13-theming.md#dark-mode) · [sample](#sample/theming) |
| Colours of your own | Every colour is a css variable: change the ones you want | [guide](13-theming.md#a-theme-of-your-own) · [sample](#sample/theming) |

On the docs site the sidebar's *Grid theme* and *Toggle dark/light* switch every grid.

## Texts and translation

| Feature | What it does | See |
| --- | --- | --- |
| Every text translatable | Menus, dialogs, footer, tooltips, date picker, validation messages and what a screen reader reads | [guide](12-texts.md#translating) · [sample](#sample/translation) |
| The page or one grid | Texts for every grid of the page, or for one grid in its config | [guide](12-texts.md#where-a-text-comes-from) · [sample](#sample/translation) |
| Names of months and days | Dates in a display format follow the language set | [guide](08-formatting.md#the-language-of-the-names) · [sample](#sample/translation) |
| Messages of your own | Your validation messages are texts too, translated like the rest | [guide](12-texts.md#messages-of-your-own) · [sample](#sample/validation) |

## Accessibility

| Feature | What it does | See |
| --- | --- | --- |
| Screen readers | A grid of rows, cells and column headers, as WAI-ARIA describes it - a tree grid when grouped; the sort, the selection and the row state are read out | [guide](14-accessibility.md#what-a-screen-reader-gets) |
| The keyboard | Cells, filters, headers, menus, dialogs and the find bar all work from the keyboard | [guide](14-accessibility.md#the-keyboard) · [sample](#sample/full-grid) |
| Focus | A visible focus ring, and Tab goes through the grid as it is shown | [guide](14-accessibility.md#focus) · [sample](#sample/theming) |
| Shortcuts help | `?` (where it types nothing) or Ctrl+/ shows every key of the grid, grouped and searchable - as a Mac writes them on a Mac | [guide](14-accessibility.md#the-keyboard-shortcuts-help) · [sample](#sample/full-grid) |

## Touch

| Feature | What it does | See |
| --- | --- | --- |
| Swipe | Scroll the rows or the columns with a finger; the swipe coasts on | [guide](01-getting-started.md#touch) · [sample](#sample/full-grid) |
| Long press | Holding a finger still opens the menu a right click opens | [guide](10-menus.md#with-a-finger) · [sample](#sample/full-grid) |
| Select with a finger | Tap row or column numbers; *Select ›* in the menus does what Shift and Ctrl do | [guide](17-selection-and-clipboard.md#with-a-finger) · [sample](#sample/ranges) |
| Move columns | Hold a label a moment, then drag it | [guide](02-grid-config.md#moving-and-resizing-columns) · [sample](#sample/column-layout) |

## SQL helpers

| Feature | What it does | See |
| --- | --- | --- |
| A WHERE from the filter | `toSqlWhere()` turns the grid's filter into the WHERE of a query and its parameters, for a server that loads only the rows asked for | [guide](22-sql.md#a-where-from-the-filter) · [sample](#sample/sql) |
| Four databases | PostgreSQL, Oracle, SQLite and SQL Server | [guide](22-sql.md#the-dialects) · [sample](#sample/sql) |
| Safe from SQL injection | Values are always parameters, the columns a list you give, names checked and quoted, the size limited | [guide](22-sql.md#security) · [sample](#sample/sql) |
| The same rows as the grid | Case, blanks, dates and time zones compare as the grid compares them | [guide](22-sql.md#how-each-type-compares) · [sample](#sample/sql) |

## Keyboard shortcuts

The ones used most - `?` or Ctrl+/ in the grid shows them all. Every key, by where the focus is: [The keyboard](14-accessibility.md#the-keyboard).

| Keys | What they do |
| --- | --- |
| Tab / Shift+Tab | the next / previous cell |
| Enter | in a cell that can be edited: the cell below |
| Alt+arrows | the cell beside, above or below - the plain arrows move the caret in the cell |
| Ctrl+Home / Ctrl+End | the first / last cell of the grid |
| Alt+Home / Alt+End | the first / last cell of the row |
| PageUp / PageDown | a page of rows up / down |
| Ctrl+ArrowUp / Ctrl+ArrowDown | the edge of the data in the column |
| Alt+Shift+arrows | a range of cells; Shift with the keys above moves its end |
| Ctrl+C / Ctrl+V | copy / paste cells, to and from Excel too |
| Delete | empties the cells of the ranges |
| Ctrl+D | fill down |
| Ctrl+Z / Ctrl+Y | undo / redo |
| Ctrl+F, F3 / Shift+F3 | find, the next / previous match |
| Enter, F2 | in a multiline cell: its editor, where Ctrl+Enter saves |
| Alt+ArrowDown, F4 | in a lookup cell: its list |
| F4 | in a header filter: pick the operator |
| Enter / Space on a label | sort; with Shift, sort on one more column |
| Shift+F10, the menu key | the menu of the cell, label, header filter or column number |
| Esc | closes a menu; clears the ranges |
