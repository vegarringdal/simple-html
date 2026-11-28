// Real browser check of the lines of the aggregates (aggregates.ts): the user - "padding is a bit much when
// multiple aggregates", "maybe using bold is a bit much too". A group row is its name's line (cellHeight)
// and a line of text (multilineLineHeight) per aggregate; the values in the weight of the cells, the
// name bold. The text of each line is inside its row, the lines a text line apart.
// Usage: node aggregate-lines-check.js <site url> [shots dir]
const path = require('node:path');
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const scheme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, colorScheme: scheme });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/aggregates`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.evaluate(() => {
            const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            gi.getDatasource().group([{ attribute: 'country', title: 'Country' }]);
        });
        await page.waitForTimeout(300);
        const look = await page.evaluate(() => {
            const row = document.querySelector('.stage .simple-html-grid-group-aggregates')?.closest('.simple-html-grid-row');
            if (!row) {
                return null;
            }
            const rowBox = row.getBoundingClientRect();
            const name = row.querySelector('.simple-html-grid-group-name');
            const cells = [...row.querySelectorAll('.simple-html-grid-aggregate')].filter((cell) => cell.textContent.trim());
            const lines = [...new Set(cells.map((cell) => Math.round(cell.getBoundingClientRect().top - rowBox.top)))].sort(
                (a, b) => a - b
            );
            const value = cells[0]?.querySelector('.simple-html-grid-aggregate-value');
            // every line's text inside the row: the bottom of the last text
            const textBottoms = cells.map((cell) => {
                const range = document.createRange();
                range.selectNodeContents(cell.querySelector('.simple-html-grid-aggregate-value'));
                return range.getBoundingClientRect().bottom - rowBox.top;
            });
            return {
                height: Math.round(rowBox.height),
                lines,
                nameWeight: getComputedStyle(name.querySelector('.simple-html-grid-group-text') ?? name).fontWeight,
                valueWeight: value ? getComputedStyle(value).fontWeight : null,
                textInside: Math.max(...textBottoms) <= rowBox.height
            };
        });
        check(`${scheme}: a group row with aggregates`, look !== null);
        if (look) {
            const aggregateLines = look.lines.length;
            check(`${scheme}: 22 + 15 per line`, look.height === 22 + 15 * aggregateLines, JSON.stringify(look));
            check(
                `${scheme}: the lines a text line apart`,
                look.lines.every((top, i) => i === 0 || top - look.lines[i - 1] === 15),
                look.lines.join(',')
            );
            check(
                `${scheme}: the name bold, the values not`,
                Number(look.nameWeight) >= 700 && Number(look.valueWeight) < 700,
                `${look.nameWeight} / ${look.valueWeight}`
            );
            check(`${scheme}: every text inside its row`, look.textInside);
        }
        // a narrow column (the user's screenshot: "S.. 1 217 217 261...."): the label goes whole, not cut,
        // then the value ends in an ellipsis - and both stay on the cell's line
        const narrow = await page.evaluate(async () => {
            const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            const balance = gi.__getGridConfig().layout.center.find((column) => column.fields[0] === 'balance');
            balance.width = 70;
            gi.rebuild();
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return [...document.querySelectorAll('.stage [data-aggregate="sum:balance"]')]
                .filter((cell) => cell.textContent.trim())
                .map((cell) => {
                    const box = cell.getBoundingClientRect();
                    const label = cell.querySelector('.simple-html-grid-aggregate-label');
                    const value = cell.querySelector('.simple-html-grid-aggregate-value');
                    const labelBox = label.getBoundingClientRect();
                    const valueBox = value.getBoundingClientRect();
                    const labelShown = labelBox.top < box.bottom && labelBox.bottom > box.top;
                    return {
                        labelShown,
                        labelCut: labelShown && label.scrollWidth > label.clientWidth + 0.5,
                        valueOnLine: valueBox.top >= box.top - 0.5 && valueBox.bottom <= box.bottom + 0.5,
                        valueCut: value.scrollWidth > value.clientWidth
                    };
                });
        });
        check(`${scheme}: narrow - sums shown`, narrow.length > 0, String(narrow.length));
        check(
            `${scheme}: narrow - no label cut, a label shown whole or not at all`,
            narrow.every((cell) => !cell.labelCut),
            JSON.stringify(narrow[0])
        );
        check(
            `${scheme}: narrow - the label of a long sum hidden`,
            narrow.some((cell) => !cell.labelShown),
            JSON.stringify(narrow[0])
        );
        check(
            `${scheme}: narrow - every value on its line`,
            narrow.every((cell) => cell.valueOnLine),
            JSON.stringify(narrow[0])
        );
        if (shots) {
            await page.screenshot({
                path: `${shots}/aggregate-lines-${scheme}.png`,
                clip: { x: 230, y: 250, width: 1070, height: 400 }
            });
        }
        await page.close();
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
