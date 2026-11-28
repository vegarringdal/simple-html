/**
 * The modules scripts/site/esbuildPlugin.js makes when the site is built.
 */

/** the text of a file: `import source from './basicGrid.ts?raw'` */
declare module '*?raw' {
    const text: string;
    export default text;
}

/** guides/NN-slug.md, in sidebar order, rendered to html (scripts/site/guides.js) */
declare module 'docs:guides' {
    export interface Guide {
        /** the slug of the file name: 01-getting-started.md -> getting-started */
        id: string;
        /** the `# Title` line */
        title: string;
        /** the rest of the file. A ```sample <id> block is an empty div.doc-sample[data-sample=id] */
        html: string;
    }
    const guides: Guide[];
    export default guides;
}

/** user-guide/NN-slug.md, the guide for the people using a grid: as the guides, its links to #user-guide/.. */
declare module 'docs:user-guide' {
    import type { Guide } from 'docs:guides';
    const userGuide: Guide[];
    export default userGuide;
}

/** the API pages, from typedoc (scripts/site/api.js) */
declare module 'docs:api' {
    export interface ApiMember {
        name: string;
        /** how it is declared, one line per signature */
        signatures: string[];
        /** the JSDoc as html, '' when it has none */
        doc: string;
        /** the ids of the samples its JSDoc names with @sample */
        samples: string[];
    }
    export interface ApiSymbol extends ApiMember {
        /** typedoc's group: Classes, Interfaces, Type Aliases, Variables, Functions - '@simple-html/grid/sql' for the sql entry */
        group: string;
        /** Class, Interface, Type Alias, Variable, Function */
        kind: string;
        /** Constructors, Properties, Accessors, Methods - own members, not inherited ones */
        memberGroups: { title: string; members: ApiMember[] }[];
    }
    const api: { symbols: ApiSymbol[] };
    export default api;
}

/** what the site is built from, and the known limits page (scripts/site/status.js) */
declare module 'docs:status' {
    export interface BuildInfo {
        /** the branch, 'unknown' when git could not say */
        branch: string;
        /** the short hash of the commit */
        commit: string;
        sha: string;
        /** the commit's date, ISO */
        date: string;
        /** built from files that were not all committed (a local build) */
        localChanges: boolean;
        /** the commit on github, '' when unknown */
        url: string;
        /** the version in package.json */
        version: string;
        /** the docs of a branch, deployed under dev/ on gh-pages */
        dev: boolean;
        /** when the site was built, ISO */
        built: string;
    }
    const status: {
        build: BuildInfo;
        /** the "Known limits and next" section of DESIGN.md, as html */
        html: string;
    };
    export default status;
}
