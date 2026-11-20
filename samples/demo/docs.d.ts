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
        /** typedoc's group: Classes, Interfaces, Type Aliases, Variables, Functions */
        group: string;
        /** Class, Interface, Type Alias, Variable, Function */
        kind: string;
        /** Constructors, Properties, Accessors, Methods - own members, not inherited ones */
        memberGroups: { title: string; members: ApiMember[] }[];
    }
    const api: { symbols: ApiSymbol[] };
    export default api;
}
