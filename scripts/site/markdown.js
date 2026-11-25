const path = require('node:path');
const { Marked } = require('marked');

// where a link to a file of the repo goes on the site: the file on github, on the docs' branch
const REPO_FILE_URL = 'https://github.com/airemote/simple-html/blob/v6_maybe/';

/**
 * Markdown -> html for the docs site: the guides, and the JSDoc text on the API pages.
 *
 * Fenced code blocks:
 * - ```sample <id>  an empty <div class="doc-sample" data-sample="<id>">, the site puts the live
 *                   sample in it: the running grid and its source
 * - any other       <pre class="code-block" data-lang="<language>"><code>, the site highlights
 *                   ts/js/json blocks with samples/demo/highlight.ts
 *
 * Headings get the id github gives them, with `section-` in front: `## Grid options` is
 * `section-grid-options`. Links are written the way they work on github, siteHref() makes the
 * links of the site of them.
 */

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const marked = new Marked({
    renderer: {
        code({ text, lang }) {
            // the info string: "ts", "ts nocheck", "sample filtering"
            const [language = '', argument = ''] = (lang || '').trim().split(/\s+/);
            if (language === 'sample') {
                return `<div class="doc-sample" data-sample="${escapeHtml(argument)}"></div>\n`;
            }
            return `<pre class="code-block" data-lang="${escapeHtml(language)}"><code>${escapeHtml(text)}</code></pre>\n`;
        },
        // id: set by renderMarkdown
        heading({ tokens, depth, id }) {
            return `<h${depth} id="section-${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
        }
    }
});

/**
 * The anchor github gives a heading: lower case, no punctuation, a dash for each space.
 * `## Changing options: \`updateConfig()\`` -> changing-options-updateconfig
 * @param {Map<string, number>} seen the slugs of the document so far, a second one gets -1, -2 ...
 */
function headingSlug(text, seen) {
    const slug = text
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
        .replace(/ /g, '-');
    const count = seen.get(slug) || 0;
    seen.set(slug, count + 1);
    return count ? `${slug}-${count}` : slug;
}

/**
 * The file of the repo a relative link in a guide goes to, when it is not a guide: the guides are in
 * guides/, so `../MIGRATION.md#package` is `{ file: 'MIGRATION.md', anchor: 'package' }`.
 * null for a guide file, a hash, an absolute path, a link to another site, and a path out of the repo.
 */
function repoFile(href, folder = 'guides') {
    if (/^(?:\.\/)?\d+-[a-z0-9-]+\.md(?:#.*)?$/.test(href) || /^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) {
        return null;
    }
    const [target, anchor = ''] = href.split('#');
    const file = path.posix.normalize(path.posix.join(folder, target));
    if (!target || file.startsWith('../')) {
        return null;
    }
    return { file, anchor };
}

/**
 * A link in a guide as the site has it. Links are written for github, and the site has one page
 * per guide and hash routing (samples/demo/index.ts):
 * - 02-datasource.md            -> #guide/datasource
 * - 02-datasource.md#selection  -> #guide/datasource/selection
 * - #selection, in the guide    -> #guide/<guideId>/selection
 * - ../MIGRATION.md#package, a file of the repo that is no guide (MIGRATION.md, CHANGELOG.md,
 *   README.md ...) -> the file on github: https://github.com/airemote/simple-html/blob/v6_maybe/MIGRATION.md#package.
 *   The site has no page for it, the relative link would 404
 * - #guide/.., #sample/.., #api/.., and links to other sites stay as they are
 */
function siteHref(href, guideId, route = 'guide') {
    const file = /^(?:\.\/)?\d+-([a-z0-9-]+)\.md(?:#(.+))?$/.exec(href);
    if (file) {
        return `#${route}/${file[1]}${file[2] ? `/${file[2]}` : ''}`;
    }
    const inRepo = repoFile(href, route === 'user-guide' ? 'user-guide' : 'guides');
    if (inRepo) {
        return `${REPO_FILE_URL}${inRepo.file}${inRepo.anchor ? `#${inRepo.anchor}` : ''}`;
    }
    if (guideId && href.startsWith('#') && !/^#(guide|user-guide|sample|api)\//.test(href)) {
        return `#${route}/${guideId}/${href.slice(1)}`;
    }
    return href;
}

/**
 * @param {string} markdown
 * @param {string} [guideId] the guide it is, for its links to its own headings
 * @param {string} [route] the site's route of its pages: 'guide' (guides/), 'user-guide' (user-guide/)
 * @returns {string} html
 */
function renderMarkdown(markdown, guideId, route = 'guide') {
    const tokens = marked.lexer(markdown);
    const seen = new Map();
    marked.walkTokens(tokens, (token) => {
        if (token.type === 'heading') {
            token.id = headingSlug(token.text, seen);
        }
        if (token.type === 'link') {
            token.href = siteHref(token.href, guideId, route);
        }
    });
    return marked.parser(tokens);
}

/**
 * The anchors of the headings of a markdown text, without `section-`: what #<anchor> links to
 */
function headingIds(markdown) {
    const seen = new Map();
    const ids = [];
    marked.walkTokens(marked.lexer(markdown), (token) => {
        if (token.type === 'heading') {
            ids.push(headingSlug(token.text, seen));
        }
    });
    return ids;
}

/**
 * The ```ts blocks of a markdown text, the ones the docs check compiles. Not ```ts nocheck, and
 * not the other languages.
 * @param {string} markdown
 * @returns {{ line: number, code: string }[]} line: the 1-based line of the block's first code line
 */
function tsCodeBlocks(markdown) {
    const blocks = [];
    let open = null;
    markdown.split(/\r?\n/).forEach((line, index) => {
        const fence = /^\s*```(.*)$/.exec(line);
        if (!fence) {
            open?.lines.push(line);
        } else if (!open) {
            open = { info: fence[1].trim(), line: index + 2, lines: [] };
        } else {
            if (open.info === 'ts') {
                blocks.push({ line: open.line, code: open.lines.join('\n') });
            }
            open = null;
        }
    });
    return blocks;
}

module.exports = { escapeHtml, headingIds, renderMarkdown, repoFile, siteHref, tsCodeBlocks };
