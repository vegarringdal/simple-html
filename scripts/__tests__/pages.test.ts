import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// plain node, as the workflows run it
const { targetFor, place, remove, devIndex } = require('../pages.js');

/**
 * scripts/pages.js: where pages.yml puts a build of the docs on gh-pages - master at the root, any
 * other branch under dev/<branch>/, the rest left as it is
 */

const folders: string[] = [];
afterEach(() => {
    for (const folder of folders.splice(0)) {
        fs.rmSync(folder, { recursive: true, force: true });
    }
});

/** a folder with files: { 'a/b.txt': 'text' } */
function folderWith(files: Record<string, string>) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
    folders.push(folder);
    for (const [name, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(folder, name)), { recursive: true });
        fs.writeFileSync(path.join(folder, name), text);
    }
    return folder;
}

/** the files of a folder, without git's, sorted */
function filesOf(folder: string): string[] {
    return (fs.readdirSync(folder, { recursive: true }) as string[])
        .filter((name) => !name.startsWith('.git') && fs.statSync(path.join(folder, name)).isFile())
        .sort();
}

const build = (branch: string, built: string) =>
    folderWith({
        'index.html': `site of ${branch}`,
        'index.js': '',
        'build.json': JSON.stringify({
            branch,
            commit: 'abc1234',
            url: 'https://github.com/a/b/commit/abc',
            version: '6.0.0',
            built
        })
    });

describe('pages', () => {
    it('expect the default branch at the root, any other under dev/ by its name made safe', () => {
        expect(targetFor('master', 'master')).toBe('');
        expect(targetFor('v6_maybe', 'master')).toBe('dev/v6-maybe');
        expect(targetFor('feature/Find_bar', 'master')).toBe('dev/feature-find-bar');
    });

    it("expect master's build to replace the root, the dev folders kept", () => {
        const site = folderWith({ 'old.js': '', '.git/HEAD': '', 'dev/v6-maybe/index.html': 'dev' });
        place(site, build('master', '2026-11-27T10:00:00Z'), '');
        expect(filesOf(site)).toEqual([
            '.nojekyll',
            'build.json',
            'dev/index.html',
            'dev/v6-maybe/index.html',
            'index.html',
            'index.js'
        ]);
        expect(fs.readFileSync(path.join(site, 'dev/v6-maybe/index.html'), 'utf8')).toBe('dev');
    });

    it("expect a branch's build to replace its own dev folder only, dev/ to list them newest first", () => {
        const site = folderWith({ 'index.html': 'master', 'dev/v6-maybe/stale.js': '' });
        place(site, build('v6_maybe', '2026-11-27T10:00:00Z'), 'dev/v6-maybe');
        place(site, build('feature/find', '2026-11-27T12:30:00Z'), 'dev/feature-find');
        expect(filesOf(site)).toEqual([
            '.nojekyll',
            'dev/feature-find/build.json',
            'dev/feature-find/index.html',
            'dev/feature-find/index.js',
            'dev/index.html',
            'dev/v6-maybe/build.json',
            'dev/v6-maybe/index.html',
            'dev/v6-maybe/index.js',
            'index.html'
        ]);
        const index = fs.readFileSync(path.join(site, 'dev/index.html'), 'utf8');
        const links = [...index.matchAll(/<td><a href="([^"]+)">([^<]+)<\/a>/g)].map((match) => `${match[1]} ${match[2]}`);
        expect(links).toEqual(['./feature-find/ feature/find', './v6-maybe/ v6_maybe']);
        expect(index).toContain('<td>2026-11-27 12:30</td>');
    });

    it("expect remove to take a branch's folder down, dev/ gone with the last one", () => {
        const site = folderWith({ 'index.html': 'master' });
        place(site, build('a', '2026-11-27T10:00:00Z'), 'dev/a');
        place(site, build('b', '2026-11-27T11:00:00Z'), 'dev/b');
        expect(remove(site, 'a')).toBe(true);
        expect(remove(site, 'a')).toBe(false);
        expect(fs.readFileSync(path.join(site, 'dev/index.html'), 'utf8')).not.toContain('./a/');
        remove(site, 'b');
        expect(filesOf(site)).toEqual(['.nojekyll', 'index.html']);
    });

    it('expect the list to escape what it shows, a folder without build.json listed by its name', () => {
        const html = devIndex([
            { name: 'x', build: { branch: '<b>&' } },
            { name: 'plain', build: null }
        ]);
        expect(html).toContain('&lt;b&gt;&amp;');
        expect(html).toContain('<a href="./plain/">plain</a>');
    });
});
