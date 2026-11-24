// Real browser check of the import (importDialog.ts, importRows.ts, xlsxRead.ts) on the "Import CSV and
// Excel" sample (#sample/import), in light, dark and TreDeSpace, and on a phone:
//
// - Paste › As new rows…: a TSV clipboard as Excel puts it (CRLF after each row) - the dialog by position
//   from the clicked column, the problem of a value that is no number, Import -> new rows with the values
//   parsed (a decimal comma, a date with dots), the row error, Ctrl+Z takes them out, Ctrl+Y back
// - Import rows… (header menu) and a CSV through Choose file (setInputFiles): the header found (by name),
//   the separator found, the problems listed and marked, a field skipped by hand, the rows with problems
//   skipped -> the rows imported
// - an .xlsx file (the grid's own export) through Choose file: typed dates and numbers
// - a file dropped on the dialog (a DataTransfer with a File)
// - screenshots of the dialog: pasted rows, the CSV with its problems, the workbook; the grid after; a phone
//
// Usage: node import-check.js <site url> [screenshot dir]
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node import-check.js <site url> [screenshot dir]');
    process.exit(2);
}
const { chromium } = require('playwright');
if (shots) {
    fs.mkdirSync(shots, { recursive: true });
}

const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);

const GRID = '.stage simple-html-grid';
const DIALOG = 'dialog.import-dialog';

// the sample's CSV, as a file to pick
const files = fs.mkdtempSync(path.join(os.tmpdir(), 'import-check-'));
const csvPath = path.join(files, 'people.csv');
fs.writeFileSync(
    csvPath,
    [
        'company;country;age;balance;date;active;fruit',
        'Fjord AS;Norway;34;1 234,50;20.11.2026;true;Apple',
        'Nordlys;Sweden;abc;12,5;2026-01-31;false;Pear',
        '"=HYPERLINK(""http://example.com"")";Denmark;-3;0;31.02.2026;maybe;Mango',
        'Kyst og Fjell;Iceland;51;-7,25;01.03.2026;true;Cherry'
    ].join('\r\n')
);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const [theme, gridTheme] of [
        ['light', 'default'],
        ['dark', 'default'],
        ['dark', 'tredespace']
    ]) {
        const name = gridTheme === 'default' ? theme : `${gridTheme}-${theme}`;
        const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
        await page.addInitScript(
            ([t, g]) => {
                localStorage.setItem('simple-html-demo-theme', t);
                localStorage.setItem('simple-html-demo-grid-theme', g);
            },
            [theme, gridTheme]
        );
        await page.goto(`${base}#sample/import`);
        await page.waitForSelector(`${GRID} .simple-html-grid-col-cell`);
        await page.waitForTimeout(400);
        const t = (text) => `${name}: ${text}`;

        const ds = (fn, arg) =>
            page.evaluate(
                ([source, a]) => {
                    const datasource = document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource();
                    return new Function('datasource', 'arg', source)(datasource, a);
                },
                [fn, arg]
            );
        const newRows = () =>
            ds(
                `return datasource.getAllData().filter((row) => row.__isNew || row.__rowState === 'N' || (row.__controller && row.__controller.__isNew)).map((row) => ({
                    company: row.company, age: row.age ?? null, balance: row.balance ?? null,
                    date: row.date1 instanceof Date ? row.date1.getFullYear() + '-' + (row.date1.getMonth() + 1) + '-' + row.date1.getDate() : null,
                    active: row.isActive ?? null, state: row.__rowState, error: row.__rowError ?? null }))`
            );
        const dialogText = (selector) =>
            page.$eval(`${DIALOG} ${selector}`, (el) => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
        const pickers = () => page.$$eval(`${DIALOG} .import-field`, (selects) => selects.map((s) => s.value));
        const problems = () =>
            page.$$eval(`${DIALOG} .import-problems li`, (items) =>
                items.map((li) => li.textContent.replace(/\s+/g, ' ').trim())
            );
        const importButton = () => page.locator(`${DIALOG} .import-button`);
        const cell = (row, field) =>
            page.evaluateHandle(
                ([r, f]) =>
                    [...document.querySelectorAll(`.stage input[data-attribute="${f}"]`)].find(
                        (i) => i.closest('.simple-html-grid-col-cell').$row === r && i.offsetParent
                    ),
                [row, field]
            );
        const shot = async (file) => {
            if (shots) {
                const box = await page.locator(DIALOG).boundingBox();
                await page.screenshot({ path: `${shots}/${file}-${name}.png`, clip: box ?? undefined });
            }
        };

        // ---- Paste › As new rows…: a block of rows from Excel, by position from the clicked column
        await page.evaluate(() =>
            navigator.clipboard.writeText(
                'Pasted One\tNorway\t33\t1 234,5\t20.11.2026\ttrue\tApple\r\nPasted Two\tSweden\tabc\t2\t2026-01-02\tfalse\tPear\r\n'
            )
        );
        await (await cell(0, 'company')).click({ button: 'right' });
        await page.waitForSelector('.simple-html-grid-popover .simple-html-grid-menu');
        await page.hover('.simple-html-grid-popover [data-menu-id="row.paste"]');
        await page.waitForTimeout(300);
        await page.click('.simple-html-grid-popover [data-menu-id="row.paste.newRows"]');
        await page.waitForSelector(`${DIALOG}[open] .import-table`);
        check(
            t('Paste › As new rows…: the source is the pasted rows'),
            (await dialogText('.import-source-name')) === 'Pasted rows'
        );
        check(
            t('by position from the clicked column'),
            (await dialogText('.import-hint:not(.import-drop)'))?.includes('by position, from Company'),
            await page.$$eval(`${DIALOG} .import-hint`, (h) => h.map((x) => x.textContent.trim()))
        );
        const pasted = await pickers();
        check(
            t('every column has its field'),
            pasted.join() === 'company,country,age,balance,date1,isActive,favoriteFruit',
            pasted
        );
        check(
            t('the problem of a value that is no number'),
            (await problems()).includes('Row 2, Age: Not a number: abc'),
            await problems()
        );
        check(t('the cell with the problem marked'), (await page.$$(`${DIALOG} .import-cell-problem`)).length === 1);
        await shot('import-paste');
        const before = await ds('return datasource.length()');
        await importButton().click();
        await page.waitForTimeout(300);
        check(t('Import closes the dialog'), (await page.$(DIALOG)) === null);
        let added = await newRows();
        check(t('two new rows'), (await ds('return datasource.length()')) === before + 2 && added.length === 2, added);
        check(
            t('the values parsed as typing: a decimal comma, a date with dots, a boolean'),
            added[0]?.company === 'Pasted One' &&
                added[0]?.balance === 1234.5 &&
                added[0]?.date === '2026-11-20' &&
                added[0]?.active === true,
            added[0]
        );
        check(
            t('the value not read is empty, in the row error'),
            added[1]?.age === null && added[1]?.error === 'Not imported: Age: Not a number: abc',
            added[1]
        );
        const marker = await page.$$eval('.stage .simple-html-row-error', (els) => els.length);
        check(t('the row number of the row with a problem marked'), marker >= 1, marker);
        if (shots) {
            await page.screenshot({ path: `${shots}/import-grid-after-${name}.png` });
        }
        // undo in the grid: Ctrl+Z in a cell takes both rows out
        await (await cell(0, 'company')).click();
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(200);
        added = await newRows();
        check(
            t('Ctrl+Z takes the import out: both rows marked'),
            added.every((row) => row.state === 'D'),
            added.map((r) => r.state)
        );
        const changes = await ds('return datasource.getChanges().newEntities.length');
        check(t('nothing to save after the undo'), changes === 0, changes);
        await page.keyboard.press('Control+y');
        await page.waitForTimeout(200);
        added = await newRows();
        check(
            t('Ctrl+Y brings them back'),
            added.length === 2 && added.every((row) => row.state === 'N'),
            added.map((r) => r.state)
        );

        // ---- Import rows… in the header menu, a CSV file through Choose file
        await page.keyboard.press('Escape');
        await page.click(`${GRID} [data-attribute-header="age"]`, { button: 'right' });
        await page.waitForSelector('.simple-html-grid-popover [data-menu-id="header.import"]');
        await page.click('.simple-html-grid-popover [data-menu-id="header.import"]');
        await page.waitForSelector(`${DIALOG}[open]`);
        check(
            t('Import rows… opens it empty, Import greyed out'),
            (await importButton().getAttribute('aria-disabled')) === 'true'
        );
        await page.setInputFiles(`${DIALOG} input[type="file"]`, csvPath);
        await page.waitForSelector(`${DIALOG} .import-table`);
        check(t('the file name'), (await dialogText('.import-source-name')) === 'people.csv');
        const hint = await page.$$eval(`${DIALOG} .import-hint`, (h) => h.map((x) => x.textContent.trim()));
        check(
            t('the header found: matched by name'),
            hint.some((h) => h.includes('matched to the fields by name')),
            hint
        );
        const separator = await page
            .$eval(`${DIALOG} .import-option select`, (s) => s.selectedOptions[0]?.textContent.trim())
            .catch(() => null);
        check(t('the separator found'), separator === 'Found: Semicolon', separator);
        check(
            t('the columns matched by their names'),
            (await pickers()).join() === 'company,country,age,balance,date1,isActive,favoriteFruit',
            await pickers()
        );
        const listed = await problems();
        check(
            t('the problems listed: a number, a rule, a day, a boolean'),
            [
                'Row 3, Age: Not a number: abc',
                'Row 4, date: Not a date: 31.02.2026',
                'Row 4, active: Not true or false: maybe',
                'Row 4, Age: Must be at least 0'
            ].every((p) => listed.includes(p)),
            listed
        );
        check(
            t('the count'),
            (await dialogText('.import-summary')) === '4 rows, 2 with problems',
            await dialogText('.import-summary')
        );
        await shot('import-csv-problems');
        // a field skipped by hand, the rows with problems skipped
        await page.selectOption(`${DIALOG} .import-field >> nth=6`, '');
        await page.selectOption(`${DIALOG} .import-options select >> nth=-1`, 'skip');
        check(
            t('Import counts the rows left'),
            (await importButton().textContent()).trim() === 'Import 2 rows',
            await importButton().textContent()
        );
        await importButton().click();
        await page.waitForTimeout(300);
        added = await newRows();
        const csvRows = added.slice(2);
        check(
            t('the CSV rows without problems imported, the skipped field empty'),
            csvRows.length === 2 &&
                csvRows[0].company === 'Fjord AS' &&
                csvRows[1].company === 'Kyst og Fjell' &&
                csvRows[1].balance === -7.25,
            csvRows
        );
        const fruit = await ds(
            "return datasource.getAllData().filter((row) => row.company === 'Fjord AS').map((row) => row.favoriteFruit ?? null)"
        );
        check(t('the column skipped by hand is not written'), fruit[0] === null, fruit);

        // ---- an .xlsx file of the grid's own export, through Choose file
        const xlsx = await page.evaluate(async () => {
            const grid = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            const blob = await grid.getExcel({ rows: 'selected' });
            return Array.from(new Uint8Array(await blob.arrayBuffer()));
        });
        const xlsxPath = path.join(files, 'export.xlsx');
        fs.writeFileSync(xlsxPath, Buffer.from(xlsx));
        await page.click('.stage .demo-toolbar button:has-text("Import rows…")');
        await page.waitForSelector(`${DIALOG}[open]`);
        await page.setInputFiles(`${DIALOG} input[type="file"]`, xlsxPath);
        await page.waitForSelector(`${DIALOG} .import-table`);
        const xlsxPreview = await page.$$eval(`${DIALOG} .import-table tbody tr`, (rows) =>
            rows.map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent.trim()))
        );
        check(
            t('the workbook read: by name, its first rows typed'),
            xlsxPreview.length >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(xlsxPreview[0][4] ?? ''),
            xlsxPreview[0]
        );
        await shot('import-xlsx');
        const count = await ds('return datasource.length()');
        await importButton().click();
        await page.waitForTimeout(300);
        const last = await ds(
            'const row = datasource.getAllData().at(-1); return { date: row.date1 instanceof Date, age: typeof row.age, active: typeof row.isActive, state: row.__rowState }'
        );
        check(
            t('the workbook rows imported, typed'),
            (await ds('return datasource.length()')) > count && last.date && last.age === 'number' && last.active === 'boolean',
            last
        );

        // ---- a file dropped on the dialog
        await page.click('.stage .demo-toolbar button:has-text("Import rows…")');
        await page.waitForSelector(`${DIALOG}[open]`);
        await page.evaluate(() => {
            const transfer = new DataTransfer();
            transfer.items.add(new File(['company,age\r\nDropped AS,7\r\n'], 'dropped.csv', { type: 'text/csv' }));
            const body = document.querySelector('dialog.import-dialog .import-body');
            body.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
            body.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        });
        await page.waitForSelector(`${DIALOG} .import-table`);
        check(
            t('a dropped file is read'),
            (await dialogText('.import-source-name')) === 'dropped.csv' && (await dialogText('.import-summary')) === '1 rows'
        );
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        check(t('Esc closes the dialog'), (await page.$(DIALOG)) === null);
        await context.close();
    }

    // ---- a phone: the sample CSV in the dialog, it fits the width, the table scrolls in its box
    const phone = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2
    });
    const page = await phone.newPage();
    page.on('pageerror', (e) => errors.push(`phone: ${e}`));
    await page.addInitScript(() => {
        localStorage.setItem('simple-html-demo-theme', 'light');
        localStorage.setItem('simple-html-demo-grid-theme', 'default');
    });
    await page.goto(`${base}#sample/import`);
    await page.waitForSelector(`${GRID} .simple-html-grid-col-cell`);
    await page.waitForTimeout(300);
    await page.evaluate(() =>
        document
            .querySelector('.stage simple-html-grid')
            .grid.gridInterface.openImport(
                new File(['company;country;age\r\nFjord AS;Norway;34\r\nNordlys;Sweden;abc\r\n'], 'phone.csv')
            )
    );
    await page.waitForSelector(`${DIALOG} .import-table`);
    const fit = await page.$eval(DIALOG, (d) => ({
        width: d.getBoundingClientRect().width,
        right: d.getBoundingClientRect().right,
        view: window.innerWidth,
        scroll: d.scrollWidth <= d.clientWidth + 1
    }));
    check('phone: the dialog fits the width', fit.width <= fit.view && fit.right <= fit.view + 1 && fit.scroll, fit);
    const button = await page.$eval(`${DIALOG} .import-button`, (b) => b.getBoundingClientRect().height);
    check('phone: the buttons keep their compact size', button <= 26, button);
    if (shots) {
        await page.screenshot({ path: `${shots}/import-phone.png` });
    }
    await phone.close();

    await browser.close();
    fs.rmSync(files, { recursive: true, force: true });
    for (const line of results) {
        console.log(line);
    }
    for (const error of errors) {
        console.log(`ERROR ${error}`);
    }
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed${errors.length ? `, ${errors.length} page errors` : ''}`);
    process.exit(failed || errors.length ? 1 : 0);
})();
