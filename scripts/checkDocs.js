const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { buildApiModel, convertProject, exampleBlocks } = require('./site/api');
const { readGuides, USER_GUIDE_DIR } = require('./site/guides');
const { headingIds, repoFile, siteHref, tsCodeBlocks } = require('./site/markdown');

/**
 * `npm run check:docs` (it builds dist first): the docs can not rot.
 *
 * 1. typedoc validation (src/index.ts and src/sql.ts), warnings are errors: every export documented, no broken {@link}s,
 *    nothing in the public API that uses a type that is not exported, no unknown tags.
 * 2. every ```ts block in guides/*.md (not ```ts nocheck) and every ```ts block of an @example in
 *    the JSDoc is written to a module of its own in a temp folder, and typechecked against the
 *    published typings: '@simple-html/grid' is dist/index.d.ts, '@simple-html/grid/sql' dist/sql.d.ts, as
 *    for `npm run check:typings`.
 *    A block may use `datasource`, `gridInterface` and `host` without declaring them (GLOBALS), and
 *    import 'lit-html' (the grid's dependency).
 * 3. the samples a guide (```sample <id>) or a JSDoc (@sample <id>) names exist, and so do the
 *    pages and headings the links in the guides go to (NN-slug.md, NN-slug.md#heading, #heading,
 *    #guide/<id>, #sample/<id>, #api/<name>, #api/<name>.<member>), and the files of the repo they
 *    link to (../MIGRATION.md, ../MIGRATION.md#heading - the site links those to github).
 * 4. the user guide (user-guide/*.md): no code in it (a ```tryit <id> box of samples/demo/tryIt.ts is fine,
 *    its id must be there), its links go to its own pages and headings (NN-slug.md, NN-slug.md#heading,
 *    #heading) or a sample (#sample/<id>).
 *
 * Errors are reported with the guide file and line, or the symbol and file:line of the JSDoc.
 */

const ROOT = path.resolve(__dirname, '..');

// what every block may use without declaring it. A script, not a module: a block that declares
// its own `datasource` shadows this one instead of clashing with it
const GLOBALS = `
declare const datasource: import('@simple-html/grid').Datasource<any>;
declare const gridInterface: import('@simple-html/grid').GridInterface<any>;
declare const host: HTMLElement;
// import '@simple-html/grid/grid.css'
declare module '*.css';
`;

const COMPILER_OPTIONS = {
    target: 'es2025',
    module: 'esNext',
    moduleResolution: 'bundler',
    lib: ['es2025', 'dom'],
    strict: true,
    // the typings themselves are checked by check:typings
    skipLibCheck: true,
    noEmit: true,
    types: [],
    // lit-html is the grid's dependency, a user has it: the custom cells guide renders with it
    paths: {
        '@simple-html/grid': [path.join(ROOT, 'dist/index.d.ts')],
        '@simple-html/grid/sql': [path.join(ROOT, 'dist/sql.d.ts')],
        'lit-html': [path.join(ROOT, 'node_modules/lit-html/lit-html.d.ts')]
    }
};

// ------------------------------------------------------------------ 2. code blocks

/**
 * @returns {{ where: string, line: number, code: string }[]} line: the line in `where` the code
 *   starts at, 0 when `where` is a symbol and not a file
 */
function codeBlocks(guides, project) {
    const blocks = [];
    for (const guide of guides) {
        for (const block of tsCodeBlocks(guide.text)) {
            blocks.push({ where: guide.file, line: block.line, code: block.code });
        }
    }
    for (const example of exampleBlocks(project)) {
        blocks.push({ where: example.where, line: 0, code: example.code });
    }
    return blocks;
}

/**
 * Compiles every block as a module of its own
 * @returns {string[]} the errors, with the place of each in the guide or the JSDoc
 */
function typecheck(blocks) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-docs-'));
    try {
        const files = blocks.map((block, index) => {
            const file = path.join(dir, `block${index}.ts`);
            // `export {}` makes it a module, also when the block has no import
            fs.writeFileSync(file, `${block.code}\nexport {};\n`);
            return file;
        });
        const globals = path.join(dir, 'globals.d.ts');
        fs.writeFileSync(globals, GLOBALS);

        const { options, errors } = ts.convertCompilerOptionsFromJson(COMPILER_OPTIONS, dir);
        if (errors.length) {
            throw new Error(ts.flattenDiagnosticMessageText(errors[0].messageText, '\n'));
        }
        const program = ts.createProgram([globals, ...files], options);
        return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n    ');
            const index = diagnostic.file ? files.indexOf(path.resolve(diagnostic.file.fileName)) : -1;
            if (index === -1) {
                return `${diagnostic.file?.fileName || 'tsc'}: TS${diagnostic.code} ${message}`;
            }
            const block = blocks[index];
            const line = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line;
            const place = block.line ? `${block.where}:${block.line + line}` : `${block.where}, line ${line + 1} of it`;
            return `${place}: TS${diagnostic.code} ${message}`;
        });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// ------------------------------------------------------------------ 3. samples and links

// the id of each sample, the `id: '...'` of the DemoSample in its file
function sampleIds() {
    const dir = path.join(ROOT, 'samples/demo/samples');
    return fs.readdirSync(dir).map((file) => /\n {4}id: '([^']+)'/.exec(fs.readFileSync(path.join(dir, file), 'utf8'))?.[1]);
}

/**
 * @returns {string[]} the samples and links that go nowhere
 */
function checkReferences(guides, api) {
    const samples = new Set(sampleIds());
    const guideFiles = new Set(guides.map((guide) => path.basename(guide.file)));
    // the headings of each guide: #guide/<id>/<heading>
    const headings = new Map(guides.map((guide) => [guide.id, new Set(headingIds(guide.body))]));
    const pages = new Set([
        ...guides.map((guide) => `guide/${guide.id}`),
        ...[...samples].map((id) => `sample/${id}`),
        ...api.symbols.map((symbol) => `api/${symbol.name}`),
        ...api.symbols.flatMap((symbol) =>
            symbol.memberGroups.flatMap((group) => group.members.map((member) => `api/${symbol.name}.${member.name}`))
        )
    ]);
    const errors = [];

    const goesNowhere = (target, guide) => {
        // a guide file is named as it is, so the link works on github too
        const guideFile = /^(?:\.\/)?(\d+-[a-z0-9-]+\.md)(?:#.*)?$/.exec(target)?.[1];
        if (guideFile && !guideFiles.has(guideFile)) {
            return true;
        }
        // a file of the repo: the site links it to github, so it has to exist - and so does the heading
        // of a markdown file
        const inRepo = repoFile(target);
        if (inRepo) {
            const file = path.join(ROOT, inRepo.file);
            if (!fs.existsSync(file)) {
                return true;
            }
            return !!inRepo.anchor && file.endsWith('.md') && !headingIds(fs.readFileSync(file, 'utf8')).includes(inRepo.anchor);
        }
        // the link as the site has it
        const href = siteHref(target, guide.id);
        if (!href.startsWith('#')) {
            return false; // another site
        }
        const heading = /^#guide\/([a-z0-9-]+)\/(.+)$/.exec(href);
        return heading ? !headings.get(heading[1])?.has(heading[2]) : !pages.has(href.slice(1));
    };

    for (const guide of guides) {
        guide.text.split(/\r?\n/).forEach((line, index) => {
            const where = `${guide.file}:${index + 1}`;
            const sample = /^\s*```sample\s+(\S+)/.exec(line);
            if (sample && !samples.has(sample[1])) {
                errors.push(`${where}: no sample has the id "${sample[1]}"`);
            }
            for (const [, target] of line.matchAll(/\]\(([^)\s]+)\)/g)) {
                if (goesNowhere(target, guide)) {
                    errors.push(`${where}: the link ${target} goes nowhere, there is no such page, file or heading`);
                }
            }
        });
    }

    for (const symbol of api.symbols) {
        const named = [symbol, ...symbol.memberGroups.flatMap((group) => group.members)];
        for (const member of named) {
            for (const id of member.samples.filter((sampleId) => !samples.has(sampleId))) {
                const name = member === symbol ? symbol.name : `${symbol.name}.${member.name}`;
                errors.push(`${name}: @sample ${id}, no sample has that id`);
            }
        }
    }
    return errors;
}

/**
 * The user guide (user-guide/NN-slug.md), for the people who use a grid: no code in it, and every link to
 * one of its pages or headings (`02-filtering.md#change-the-operator`) or to a sample of the site
 * @returns {string[]} what is wrong, with the file and line
 */
function checkUserGuide(pages) {
    const files = new Set(pages.map((page) => path.basename(page.file)));
    const headings = new Map(pages.map((page) => [page.id, new Set(headingIds(page.body))]));
    const samples = new Set(sampleIds());
    // the "Try it" boxes: the ids of samples/demo/tryIt.ts
    const tryIts = new Set(
        [...fs.readFileSync(path.join(ROOT, 'samples/demo/tryIt.ts'), 'utf8').matchAll(/^\s{8}id: '([a-z0-9-]+)'/gm)].map(
            (m) => m[1]
        )
    );
    const errors = [];
    for (const page of pages) {
        let inTryIt = false;
        page.text.split(/\r?\n/).forEach((line, index) => {
            const where = `${page.file}:${index + 1}`;
            const tryIt = /^\s*```tryit\s+(\S+)\s*$/.exec(line);
            if (tryIt) {
                inTryIt = true;
                if (!tryIts.has(tryIt[1])) {
                    errors.push(`${where}: no "Try it" has the id "${tryIt[1]}" (samples/demo/tryIt.ts)`);
                }
            } else if (inTryIt && /^\s*```\s*$/.test(line)) {
                inTryIt = false;
            } else if (/^\s*```/.test(line)) {
                errors.push(
                    `${where}: no code in the user guide - it is for the people using a grid (a \`\`\`tryit <id> box is fine)`
                );
            }
            for (const [, target] of line.matchAll(/\]\(([^)\s]+)\)/g)) {
                if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
                    continue; // another site
                }
                const sample = /^#sample\/(.+)$/.exec(target);
                if (sample) {
                    if (!samples.has(sample[1])) {
                        errors.push(`${where}: no sample has the id "${sample[1]}"`);
                    }
                    continue;
                }
                const file = /^(?:\.\/)?(\d+-([a-z0-9-]+)\.md)(?:#(.+))?$/.exec(target);
                const own = target.startsWith('#') ? [null, null, page.id, target.slice(1)] : null;
                const link = file ?? own;
                if (!link || (file && !files.has(file[1])) || (link[3] && !headings.get(link[2])?.has(link[3]))) {
                    errors.push(`${where}: the link ${target} goes nowhere, there is no such page of the user guide or heading`);
                }
            }
        });
    }
    return errors;
}

// ------------------------------------------------------------------

async function run() {
    if (!fs.existsSync(path.join(ROOT, 'dist/index.d.ts'))) {
        throw new Error('dist/index.d.ts is missing: npm run build first');
    }

    console.log('1. typedoc validation, warnings are errors');
    // notExported, invalidLink and the other validations are on by default, notDocumented is not
    const { app, project } = await convertProject({ treatWarningsAsErrors: true, validation: { notDocumented: true } });
    app.validate(project);
    const typedocOk = !app.logger.hasErrors() && !app.logger.hasWarnings();
    console.log(typedocOk ? 'ok' : 'failed, see the warnings and errors above');

    const guides = readGuides();
    const blocks = codeBlocks(guides, project);
    console.log(`\n2. typecheck the ${blocks.length} \`\`\`ts blocks of the guides and the @examples`);
    const typeErrors = typecheck(blocks);
    console.log(typeErrors.length ? typeErrors.join('\n') : 'ok');

    console.log('\n3. samples and links');
    const referenceErrors = checkReferences(guides, buildApiModel(project));
    console.log(referenceErrors.length ? referenceErrors.join('\n') : 'ok');

    const userGuide = readGuides(USER_GUIDE_DIR);
    console.log(`\n4. the user guide: ${userGuide.length} pages, their links, no code`);
    const userGuideErrors = checkUserGuide(userGuide);
    console.log(userGuideErrors.length ? userGuideErrors.join('\n') : 'ok');

    const failed = !typedocOk || typeErrors.length || referenceErrors.length || userGuideErrors.length;
    console.log(
        `\ndocs check ${failed ? 'failed' : 'passed'}: ${typeErrors.length} code block errors, ${referenceErrors.length + userGuideErrors.length} broken references`
    );
    process.exit(failed ? 1 : 0);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
