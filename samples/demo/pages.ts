import api, { type ApiMember, type ApiSymbol } from 'docs:api';
import type { Guide } from 'docs:guides';
import type { BuildInfo } from 'docs:status';
import { highlightTs } from './highlight';
import { SAMPLES, type Sample } from './sampleList';
import { renderTryIt } from './tryIt';

/**
 * The three kinds of pages of the docs site. Each renders into the main element of the shell
 * (index.ts), which is empty when they are called.
 */

// ------------------------------------------------------------------ samples

/**
 * Puts text on the clipboard, resolves `false` when it could not: `navigator.clipboard` is only there in
 * a secure context (https, localhost - not the dev server opened on plain http from another machine),
 * and the browser can refuse the write. Both used to end in an uncaught error
 */
function copySource(text: string): Promise<boolean> {
    if (!navigator.clipboard) {
        return Promise.resolve(false);
    }
    return navigator.clipboard.writeText(text).then(
        () => true,
        () => false
    );
}

/**
 * The source of a sample in a dark panel that folds, with a copy button. Folded at the start: the
 * running sample is what the page is for, the source opens with a click
 */
function sourcePanel(sample: Sample) {
    const panel = document.createElement('details');
    panel.className = 'code-panel';
    panel.open = false;

    const summary = document.createElement('summary');
    summary.className = 'code-summary';
    panel.appendChild(summary);

    const label = document.createElement('span');
    label.textContent = 'Source';
    summary.appendChild(label);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'copy';
    copyBtn.onclick = (e) => {
        // do not fold the panel
        e.preventDefault();
        e.stopPropagation();
        copySource(sample.source).then((copied) => {
            copyBtn.textContent = copied ? 'copied!' : 'copy failed';
        });
    };
    summary.appendChild(copyBtn);

    const scroll = document.createElement('div');
    scroll.className = 'code-scroll';
    scroll.innerHTML = `<pre><code>${highlightTs(sample.source)}</code></pre>`;
    panel.appendChild(scroll);

    return panel;
}

/**
 * Runs a sample: its buttons, log and grid go in a new stage element in parent.
 * The stage is on the page before run() is called, the grid needs that to get its size.
 */
function runSample(sample: Sample, parent: HTMLElement) {
    const stage = document.createElement('section');
    stage.className = sample.fullPage ? 'stage stage-full' : 'stage';
    parent.appendChild(stage);
    sample.run(stage);
    // once the grid is rendered
    requestAnimationFrame(() => fitSampleGrids(stage));
}

/** px of rows a sample's grid shows at least: 15 rows of the grid's default 22px */
const SAMPLE_ROWS_HEIGHT = 15 * 22;

/**
 * Makes each grid of a stage tall enough for 15 rows. The css's min-height of `.demo-grid-host` counts
 * the grid's default heights around the rows; a sample with more there (labels of stacked fields, a
 * totals row) gets the rest here
 */
function fitSampleGrids(stage: HTMLElement) {
    for (const host of stage.querySelectorAll<HTMLElement>('.demo-grid-host')) {
        const body = host.querySelector<HTMLElement>('.simple-html-grid-body-scroller');
        const missing = body ? SAMPLE_ROWS_HEIGHT - body.clientHeight : 0;
        if (missing > 0) {
            // both: a guide's host has a height of its own, a sample page's grows with the window (flex)
            const height = `${host.offsetHeight + missing}px`;
            host.style.minHeight = height;
            host.style.height = height;
        }
    }
}

/**
 * #sample/<id>: the title and description, the source, and the running sample under it
 */
export function renderSamplePage(main: HTMLElement, sample: Sample) {
    const header = document.createElement('header');
    header.className = 'main-header';
    const title = document.createElement('h1');
    title.textContent = sample.title;
    const description = document.createElement('p');
    description.textContent = sample.description;
    header.append(title, description);

    main.append(header, sourcePanel(sample));
    runSample(sample, main);
}

/**
 * A sample in a guide, in the place of its ```sample <id> block: the source and the running sample
 */
function renderSampleBlock(block: HTMLElement) {
    const id = block.dataset.sample || '';
    const sample = SAMPLES.find((s) => s.id === id);
    if (!sample) {
        block.classList.add('doc-missing');
        block.textContent = `unknown sample: "${id}"`;
        return;
    }
    const title = document.createElement('div');
    title.className = 'doc-sample-title';
    title.innerHTML = `<span>Live sample: ${escapeHtml(sample.title)}</span><a href="#sample/${id}">open as its own page</a>`;
    block.append(title, sourcePanel(sample));
    runSample(sample, block);
}

// ------------------------------------------------------------------ shared by guides and API

function escapeHtml(text: string) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// the code blocks the highlighter knows, the rest is shown as it is
const HIGHLIGHTED = new Set(['ts', 'typescript', 'js', 'javascript', 'json']);

function highlightCodeBlocks(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>('pre.code-block').forEach((pre) => {
        const code = pre.querySelector('code');
        if (code && HIGHLIGHTED.has(pre.dataset.lang || '')) {
            code.innerHTML = highlightTs(code.textContent || '');
        }
    });
}

/**
 * A scrolling page with an article: the guides and the API pages
 */
function article(main: HTMLElement, title: string) {
    const scroll = document.createElement('div');
    scroll.className = 'doc-scroll';
    const doc = document.createElement('article');
    doc.className = 'doc';
    const heading = document.createElement('h1');
    heading.textContent = title;
    doc.appendChild(heading);
    scroll.appendChild(doc);
    main.appendChild(scroll);
    return doc;
}

// ------------------------------------------------------------------ guides

/**
 * #guide/<id>: the guide's html, with its code highlighted and its samples running
 */
export function renderGuidePage(main: HTMLElement, guide: Guide) {
    const doc = article(main, guide.title);
    // the css of one guide: the tables of the feature overview, .doc[data-guide='features']
    doc.dataset.guide = guide.id;
    doc.insertAdjacentHTML('beforeend', guide.html);
    highlightCodeBlocks(doc);
    doc.querySelectorAll<HTMLElement>('.doc-sample').forEach(renderSampleBlock);
    doc.querySelectorAll<HTMLElement>('.doc-tryit').forEach(renderTryIt);
}

// ------------------------------------------------------------------ status

/**
 * The date of a commit as the page shows it, `2026-11-21 17:50`; '' for no date
 */
function commitDate(iso: string) {
    return iso ? iso.slice(0, 16).replace('T', ' ') : '';
}

/**
 * What the site is built from, for the top of the sidebar: `v6_maybe @ b577f41`, the commit linked on
 * github, and its date - "local changes" when it was built from files that were not all committed
 */
export function buildLine(build: BuildInfo): HTMLElement {
    const line = document.createElement('div');
    line.className = 'sidebar-build';
    // the docs of a branch (gh-pages dev/<branch>/): said, with the way to the released ones
    if (build.dev) {
        const dev = document.createElement('a');
        dev.className = 'sidebar-build-dev';
        dev.href = '../../';
        dev.textContent = 'dev';
        dev.title = 'the docs of a branch, not released - the released docs are here';
        line.append(dev, ' ');
    }
    if (build.version) {
        line.append(`v${build.version} · `);
    }
    const label = `${build.branch} @ ${build.commit}`;
    if (build.url) {
        const link = document.createElement('a');
        link.href = build.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = label;
        line.appendChild(link);
    } else {
        line.append(label);
    }
    const date = commitDate(build.date);
    line.append(date ? ` · ${date}` : '');
    if (build.localChanges) {
        line.append(' · local changes');
    }
    line.title = 'the branch and the commit the site is built from';
    return line;
}

/**
 * The work in progress page: what the site is built from, what the plan is on now, the open items
 * of the plan and the known issues (made when the site is built, scripts/site/status.js)
 */
export function renderStatusPage(main: HTMLElement, status: { build: BuildInfo; now: string; html: string }) {
    const doc = article(main, 'Work in progress');
    const intro = document.createElement('p');
    intro.className = 'doc-status';
    intro.append('Built from ', buildLine(status.build), '. Made from the repo when the site is built: ');
    const code = (text: string) => {
        const el = document.createElement('code');
        el.textContent = text;
        return el;
    };
    intro.append(code('V6_PLAN.md'), ' and ', code('IMPORVEMENT.md'), '.');
    doc.appendChild(intro);
    if (status.now) {
        const now = document.createElement('p');
        now.innerHTML = '<strong>Now:</strong> ';
        now.append(status.now);
        doc.appendChild(now);
    }
    doc.insertAdjacentHTML('beforeend', status.html);
    highlightCodeBlocks(doc);
}

// ------------------------------------------------------------------ API

const API_NAMES = new Set(api.symbols.map((symbol) => symbol.name));

/**
 * Signatures, highlighted, with the names of the other exports linked to their pages
 */
function signatureBlock(signatures: string[]) {
    const html = highlightTs(signatures.join('\n')).replace(/<span class="tok-type">(\w+)<\/span>/g, (span, name: string) =>
        API_NAMES.has(name) ? `<a class="tok-type" href="#api/${name}">${name}</a>` : span
    );
    return `<pre class="code-block doc-signature"><code>${html}</code></pre>`;
}

/**
 * "See it running": links to the samples of a symbol, from its @sample tags
 */
function sampleLinks(ids: string[]) {
    if (!ids.length) {
        return '';
    }
    const links = ids.map((id) => {
        const sample = SAMPLES.find((s) => s.id === id);
        return sample
            ? `<a href="#sample/${id}">${escapeHtml(sample.title)}</a>`
            : `<span class="doc-missing">unknown sample: "${escapeHtml(id)}"</span>`;
    });
    return `<p class="doc-samples">See it running: ${links.join(', ')}</p>`;
}

function memberHtml(member: ApiMember) {
    return `<section class="doc-member" id="api-member-${escapeHtml(member.name)}">
        <h3>${escapeHtml(member.name)}</h3>
        ${signatureBlock(member.signatures)}
        ${member.doc}
        ${sampleLinks(member.samples)}
    </section>`;
}

/**
 * #api/<name>: how the symbol is declared, its JSDoc, its samples, and the same for its members
 */
export function renderApiPage(main: HTMLElement, symbol: ApiSymbol) {
    const doc = article(main, symbol.name);
    let html = `<p class="doc-kind">${escapeHtml(symbol.kind)}</p>`;
    html += signatureBlock(symbol.signatures) + symbol.doc + sampleLinks(symbol.samples);
    for (const group of symbol.memberGroups) {
        html += `<h2>${escapeHtml(group.title)}</h2>`;
        html += group.members.map(memberHtml).join('');
    }
    doc.insertAdjacentHTML('beforeend', html);
    highlightCodeBlocks(doc);
}

/**
 * A place on the page of a route: #api/<name>.<member> is a member of the symbol,
 * #guide/<id>/<section> a heading of the guide (scripts/site/markdown.js gives them their ids)
 */
export function scrollToPlace(route: string, place: string) {
    const id = route.startsWith('api/') ? `api-member-${place}` : `section-${place}`;
    document.getElementById(id)?.scrollIntoView();
}
