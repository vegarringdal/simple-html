/**
 * tiny dependency-free typescript syntax highlighter for the code panels
 * returns html with <span class="tok-*"> wrappers, input is fully escaped
 */

const KEYWORDS = new Set([
    'import',
    'from',
    'export',
    'const',
    'let',
    'var',
    'function',
    'return',
    'new',
    'if',
    'else',
    'for',
    'while',
    'do',
    'type',
    'interface',
    'class',
    'extends',
    'implements',
    'true',
    'false',
    'null',
    'undefined',
    'this',
    'typeof',
    'instanceof',
    'as',
    'of',
    'in',
    'async',
    'await',
    'switch',
    'case',
    'break',
    'continue',
    'default',
    'delete',
    'void',
    'static',
    'readonly',
    'enum',
    'yield',
    'try',
    'catch',
    'finally',
    'throw'
]);

function esc(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wrap(cls: string, text: string): string {
    return '<span class="' + cls + '">' + esc(text) + '</span>';
}

export function highlightTs(code: string): string {
    const re =
        /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")|(\b\d[\d_]*(?:\.\d[\d_]*)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)/g;

    let out = '';
    let last = 0;
    let match = re.exec(code);
    while (match) {
        out += esc(code.slice(last, match.index));
        const full = match[0];
        if (match[1]) {
            out += wrap('tok-comment', full);
        } else if (match[2]) {
            out += wrap('tok-string', full);
        } else if (match[3]) {
            out += wrap('tok-number', full);
        } else if (KEYWORDS.has(full)) {
            out += wrap('tok-keyword', full);
        } else if (/^[A-Z]/.test(full)) {
            out += wrap('tok-type', full);
        } else if (code[re.lastIndex] === '(') {
            out += wrap('tok-fn', full);
        } else {
            out += esc(full);
        }
        last = re.lastIndex;
        match = re.exec(code);
    }
    out += esc(code.slice(last));
    return out;
}
