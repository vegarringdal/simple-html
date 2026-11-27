const fs = require('node:fs');
const path = require('node:path');
const { renderMarkdown } = require('./markdown');

const ROOT = path.resolve(__dirname, '../..');
const GUIDES_DIR = path.join(ROOT, 'guides');
// the user guide, for the people using a grid: user-guide/NN-slug.md, as the guides
const USER_GUIDE_DIR = path.join(ROOT, 'user-guide');

// guides/01-getting-started.md: the number is the order in the sidebar, the rest the page id
const GUIDE_FILE = /^(\d+)-([a-z0-9-]+)\.md$/;

/**
 * The guides, in sidebar order. A guide is guides/NN-slug.md and its first line is `# Title`.
 * A file in guides/ that does not follow that is an error, so a typo does not just hide a guide.
 * @param {string} [dir] another folder than guides/
 * @returns {{ file: string, id: string, title: string, text: string, body: string }[]}
 *   file: the path from the repo root, id: the slug, text: the whole file, body: the file without
 *   its title line - the page shows the title itself
 */
function readGuides(dir = GUIDES_DIR) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const files = fs.readdirSync(dir).filter((file) => file.endsWith('.md'));
    const guides = files.map((name) => {
        const file = path.relative(ROOT, path.join(dir, name));
        const match = GUIDE_FILE.exec(name);
        if (!match) {
            throw new Error(`${file}: a guide is named NN-slug.md, e.g. 01-getting-started.md`);
        }
        const text = fs.readFileSync(path.join(dir, name), 'utf8');
        const firstLine = text.split(/\r?\n/, 1)[0];
        if (!firstLine.startsWith('# ')) {
            throw new Error(`${file}:1: the first line of a guide is its title: "# Title"`);
        }
        const body = text.replace(/^[^\n]*\n?/, '');
        return { order: Number(match[1]), file, id: match[2], title: firstLine.slice(2).trim(), text, body };
    });
    guides.sort((a, b) => a.order - b.order);
    return guides.map(({ order, ...guide }) => guide);
}

/**
 * The guides as the site shows them: the html of the body of each
 * @param {string} [dir] another folder than guides/
 * @param {string} [route] the site's route of the pages: 'guide', 'user-guide' for the user guide
 * @returns {{ id: string, title: string, html: string }[]}
 */
function renderGuides(dir = GUIDES_DIR, route = 'guide') {
    return readGuides(dir).map((guide) => ({
        id: guide.id,
        title: guide.title,
        html: renderMarkdown(guide.body, guide.id, route)
    }));
}

module.exports = { readGuides, renderGuides, GUIDES_DIR, USER_GUIDE_DIR };
