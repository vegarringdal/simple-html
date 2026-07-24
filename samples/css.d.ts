/**
 * esbuild handles css imports, typescript needs to be told they exist.
 * TS 6 reports side-effect imports of unknown modules as TS2882.
 */
declare module '*.css';
