// reads the guide and the source files (TS 6 includes no @types by default)
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { fillText, findText, getText, setTexts, TEXTS, type Texts } from '../texts';

/**
 * The texts: the lookup (a grid's texts, the page's from setTexts(), the defaults), the {name}
 * values, and two checks that keep the texts complete - every id is documented in the texts guide,
 * and no template has English of its own. The render test with every text replaced is in
 * src/grid/__tests__/texts.test.ts.
 */

const ROOT = path.resolve(__dirname, '../..');

// setTexts() is one for the page: back to the defaults, so no other test sees these
afterEach(() => {
    setTexts({});
});

describe('texts - the lookup', () => {
    it('expect the default when no texts are set', () => {
        expect(getText('row.copy')).toEqual('Copy:');
        expect(findText('row.copy')).toEqual('Copy:');
    });

    it("expect the page's texts to win over the defaults", () => {
        setTexts({ 'row.copy': 'Kopier:' });
        expect(getText('row.copy')).toEqual('Kopier:');
        // the ids left out keep their default
        expect(getText('row.paste')).toEqual('Paste:');
    });

    it("expect a grid's texts to win over the page's", () => {
        setTexts({ 'row.copy': 'Kopier:', 'row.paste': 'Lim inn:' });
        const grid: Texts = { 'row.copy': 'Copy (grid):' };
        expect(getText('row.copy', grid)).toEqual('Copy (grid):');
        expect(getText('row.paste', grid)).toEqual('Lim inn:');
        expect(getText('row.clear', grid)).toEqual('Clear:');
    });

    it('expect an empty text to be a text', () => {
        setTexts({ 'row.copy': '' });
        expect(getText('row.copy')).toEqual('');
    });

    it('expect setTexts() to replace the texts set before, not to add to them', () => {
        setTexts({ 'row.copy': 'Kopier:' });
        setTexts({ 'row.paste': 'Lim inn:' });
        expect(getText('row.copy')).toEqual('Copy:');
        expect(getText('row.paste')).toEqual('Lim inn:');

        setTexts({});
        expect(getText('row.paste')).toEqual('Paste:');
    });

    it('expect setTexts() to copy the object', () => {
        const texts: Texts = { 'row.copy': 'Kopier:' };
        setTexts(texts);
        texts['row.copy'] = 'changed later';
        expect(getText('row.copy')).toEqual('Kopier:');
    });

    it('expect an id of your own to be found once it has a text, undefined before', () => {
        expect(findText('my.message')).toBeUndefined();
        setTexts({ 'my.message': 'Mine' });
        expect(findText('my.message')).toEqual('Mine');
    });

    it('expect TEXTS to be frozen: the defaults are changed with setTexts()', () => {
        expect(Object.isFrozen(TEXTS)).toBe(true);
    });
});

describe('texts - values', () => {
    it('expect {name} to be filled in from the values', () => {
        expect(getText('row.summary.count', undefined, { count: 3 })).toEqual('Count: 3');
        expect(getText('footer.rowCount', undefined, { shown: 2, total: 10 })).toEqual('2/10');
    });

    it('expect the values to go where the translation puts them', () => {
        setTexts({ 'footer.rowCount': 'Viser {shown} av {total}' });
        expect(getText('footer.rowCount', undefined, { shown: 2, total: 10 })).toEqual('Viser 2 av 10');
    });

    it('expect a name without a value to stay as it is', () => {
        expect(fillText('{count} of {max}', { count: 1 })).toEqual('1 of {max}');
    });
});

describe('texts - what setTexts() takes', () => {
    it('expect a TypeError for what is not an object of texts', () => {
        // JSON from a backend can be anything
        for (const json of ['null', '[]', '"text"', '3']) {
            expect(() => setTexts(JSON.parse(json))).toThrow(TypeError);
        }
    });

    it('expect a TypeError naming the id whose text is not a string', () => {
        expect(() => setTexts(JSON.parse('{ "row.copy": null }'))).toThrow(/'row\.copy'/);
        expect(() => setTexts(JSON.parse('{ "row.copy": 3 }'))).toThrow(TypeError);
    });

    it('expect the texts to stay as they were when setTexts() throws', () => {
        setTexts({ 'row.copy': 'Kopier:' });
        expect(() => setTexts(JSON.parse('{ "row.paste": false }'))).toThrow(TypeError);
        expect(getText('row.copy')).toEqual('Kopier:');
    });
});

describe('texts - the ids', () => {
    it('expect every id to be different from the others also in upper case (getFilterString upper cases)', () => {
        const ids = Object.keys(TEXTS);
        expect(new Set(ids.map((id) => id.toUpperCase())).size).toEqual(ids.length);
    });

    it('expect every id and its English text in the tables of the texts guide, and nothing else', () => {
        const guide = fs.readFileSync(path.join(ROOT, 'guides/12-texts.md'), 'utf8');
        // a row of an id table: | `id` | `English` | ...
        const documented = new Map<string, string>();
        for (const [, id, english] of guide.matchAll(/^\| `([\w.]+)` \| `([^`]*)` \|/gm)) {
            expect(documented.has(id), `${id} is in the guide twice`).toBe(false);
            documented.set(id, english);
        }
        expect([...documented.keys()].sort()).toEqual(Object.keys(TEXTS).sort());
        for (const [id, english] of Object.entries(TEXTS)) {
            expect(documented.get(id), id).toEqual(english);
        }
    });
});

/**
 * The static text of the html`` and svg`` templates in src: the text between the tags, and the text
 * of the attributes a user sees or hears. `\0` stands for a ${} in the template
 */
function templateTexts(): { where: string; text: string }[] {
    const found: { where: string; text: string }[] = [];
    const files = fs
        .readdirSync(path.join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
        .filter((file) => file.endsWith('.ts') && !file.split(path.sep).includes('__tests__'));

    for (const file of files) {
        const source = ts.createSourceFile(
            file,
            fs.readFileSync(path.join(ROOT, 'src', file), 'utf8'),
            ts.ScriptTarget.Latest,
            true
        );
        const visit = (node: ts.Node) => {
            if (ts.isTaggedTemplateExpression(node) && ['html', 'svg'].includes(node.tag.getText())) {
                const template = node.template;
                const parts = ts.isNoSubstitutionTemplateLiteral(template)
                    ? [template.text]
                    : [template.head.text, ...template.templateSpans.map((span) => span.literal.text)];
                const markup = parts.join('\0').replace(/<!--[\s\S]*?-->/g, '');
                const where = `src/${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

                // between the tags
                for (const text of markup.replace(/<[^>]*>/g, '\0').split('\0')) {
                    found.push({ where, text: text.trim() });
                }
                // in the attributes
                for (const [, , value] of markup.matchAll(/\b(placeholder|title|alt|aria-label|data-tooltip)="([^"]*)"/g)) {
                    found.push({ where, text: value });
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    return found;
}

describe('texts - no English in the templates', () => {
    it('expect the templates to have no text of their own: every text comes from the texts', () => {
        const texts = templateTexts();
        // the scan finds templates at all
        expect(texts.length).toBeGreaterThan(50);

        // an entity like &#10005; (✕) is not a word
        const english = texts.filter(({ text }) => /[A-Za-z]/.test(text.replace(/&#?\w+;/g, '')));
        expect(english.map(({ where, text }) => `${where}: ${text}`)).toEqual([]);
    });
});
