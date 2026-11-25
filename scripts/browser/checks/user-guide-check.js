// Real browser check of the user guide on the docs site (user-guide/NN-slug.md, #user-guide/<id>):
// - the sidebar's User Guide section lists every page of the folder, in order
// - each page renders: its title, no code blocks, no page errors
// - every link of a page to another page of the user guide (#user-guide/<id>/<heading>) opens that page
//   and finds its heading
// Usage: node user-guide-check.js <site url> [screenshot dir]
const fs = require('node:fs');
const path = require('node:path');
const [, , base, shots] = process.argv;
if (!base) {
    console.log('usage: node user-guide-check.js <site url> [screenshot dir]');
    process.exit(2);
}
const { chromium } = require('playwright');
if (shots) {
    fs.mkdirSync(shots, { recursive: true });
}

const results = [];
const check = (name, ok, detail = '') =>
    results.push(
        `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`
    );

// the pages as the folder has them: id and title
const dir = path.resolve(__dirname, '../../../user-guide');
const pages = fs
    .readdirSync(dir)
    .filter((file) => /^\d+-[a-z0-9-]+\.md$/.test(file))
    .sort()
    .map((file) => ({
        id: file.replace(/^\d+-/, '').replace(/\.md$/, ''),
        title: fs.readFileSync(path.join(dir, file), 'utf8').split('\n', 1)[0].replace(/^# /, '').trim()
    }));

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    try {
        await page.goto(`${base}#user-guide/${pages[0].id}`);
        await page.waitForSelector('main h1');
        const listed = await page.$$eval('a[href^="#user-guide/"]', (links) =>
            links.filter((link) => link.closest('nav, aside, .sidebar')).map((link) => link.getAttribute('href'))
        );
        check(
            `the sidebar lists the ${pages.length} pages of the user guide, in order`,
            JSON.stringify(listed) === JSON.stringify(pages.map((p) => `#user-guide/${p.id}`)),
            listed
        );

        const links = new Set();
        for (const each of pages) {
            await page.goto(`${base}#user-guide/${each.id}`);
            await page.waitForFunction((title) => document.querySelector('main h1')?.textContent?.trim() === title, each.title);
            const found = await page.evaluate(() => ({
                code: document.querySelectorAll('main pre').length,
                headings: document.querySelectorAll('main h2').length,
                links: [...document.querySelectorAll('main a[href^="#user-guide/"]')].map((a) => a.getAttribute('href'))
            }));
            check(`${each.id}: "${each.title}", its sections, no code`, found.code === 0 && found.headings > 0, found.code);
            for (const link of found.links) {
                links.add(link);
            }
        }

        // every link between the pages: the page, and its heading
        const broken = [];
        for (const link of links) {
            await page.goto(`${base}${link}`);
            const [, id, heading] = /^#user-guide\/([a-z0-9-]+)(?:\/(.+))?$/.exec(link) ?? [];
            const title = pages.find((p) => p.id === id)?.title;
            const ok = await page
                .waitForFunction(
                    ([t, h]) =>
                        document.querySelector('main h1')?.textContent?.trim() === t &&
                        (!h || document.getElementById(`section-${h}`) !== null),
                    [title, heading],
                    { timeout: 3000 }
                )
                .then(() => true)
                .catch(() => false);
            if (!ok) {
                broken.push(link);
            }
        }
        check(`the ${links.size} links between the pages open a page and its heading`, broken.length === 0, broken);
        if (shots) {
            await page.goto(`${base}#user-guide/${pages[1].id}`);
            await page.screenshot({ path: path.join(shots, 'user-guide.png') });
        }
    } catch (error) {
        check('the run', false, String(error?.stack ?? error));
    }
    check('no page errors', errors.length === 0, errors);
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((line) => line.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();
