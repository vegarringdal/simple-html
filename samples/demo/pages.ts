import api, { type ApiMember, type ApiSymbol } from 'docs:api';
import type { Guide } from 'docs:guides';
import { highlightTs } from './highlight';
import { SAMPLES, type Sample } from './sampleList';

/**
 * The three kinds of pages of the docs site. Each renders into the main element of the shell
 * (index.ts), which is empty when they are called.
 */

// ------------------------------------------------------------------ samples

/**
 * The source of a sample in a dark panel that folds, with a copy button
 */
function sourcePanel(sample: Sample) {
    const panel = document.createElement('details');
    panel.className = 'code-panel';
    panel.open = true;

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
        navigator.clipboard.writeText(sample.source).then(() => {
            copyBtn.textContent = 'copied!';
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
    stage.className = 'stage';
    parent.appendChild(stage);
    sample.run(stage);
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
    doc.insertAdjacentHTML('beforeend', guide.html);
    highlightCodeBlocks(doc);
    doc.querySelectorAll<HTMLElement>('.doc-sample').forEach(renderSampleBlock);
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
