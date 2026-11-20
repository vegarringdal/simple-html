const path = require('node:path');
const td = require('typedoc');
const { renderMarkdown, tsCodeBlocks } = require('./markdown');

/**
 * The API pages of the docs site, from typedoc: typedoc parses src/index.ts and its JSDoc (the
 * model `typedoc --json` writes out), this file turns that into the small model the site renders.
 */

const ROOT = path.resolve(__dirname, '../..');
const KIND = td.ReflectionKind;

/**
 * Runs typedoc's converter over the public API, with the options of typedoc.json.
 * Only typedoc.json and the tsconfig are read: not the command line, it belongs to our script.
 * @param {object} [options] more typedoc options, e.g. { treatWarningsAsErrors: true }
 */
async function convertProject(options = {}) {
    const app = await td.Application.bootstrapWithPlugins(
        {
            entryPoints: [path.join(ROOT, 'src/index.ts')],
            tsconfig: path.join(ROOT, 'tsconfig-typedoc.json'),
            options: path.join(ROOT, 'typedoc.json'),
            ...options
        },
        [new td.TypeDocReader(), new td.TSConfigReader()]
    );
    const project = await app.convert();
    if (!project) {
        throw new Error('typedoc could not convert src/index.ts, see the errors above');
    }
    return { app, project };
}

// ------------------------------------------------------------------ comments -> markdown

/**
 * The page of a symbol: #api/Datasource, and #api/Datasource.filter for a member of it
 */
function apiHref(reflection) {
    const names = [];
    for (let r = reflection; r && !r.isProject(); r = r.parent) {
        // a signature or parameter is not part of the name, nor an object type (__type)
        if (r.isDeclaration() && r.kind !== KIND.TypeLiteral) {
            names.unshift(r.name);
        }
    }
    return `#api/${names.slice(0, 2).join('.')}`;
}

/**
 * Comment text to markdown, {@link X} becomes a link to the page of X
 */
function partsToMarkdown(parts) {
    return parts
        .map((part) => {
            if (part.kind !== 'inline-tag' || !part.tag.startsWith('@link')) {
                return part.text;
            }
            const text = part.tag === '@linkcode' ? `\`${part.text}\`` : part.text;
            let href;
            if (typeof part.target === 'string') {
                href = part.target;
            } else if (part.target instanceof td.Reflection) {
                href = apiHref(part.target);
            }
            return href ? `[${text}](${href})` : text;
        })
        .join('');
}

// functions and methods have their comment on the signature, accessors on get/set
function commentOf(reflection) {
    return (
        reflection.comment ||
        reflection.signatures?.find((signature) => signature.comment)?.comment ||
        reflection.getSignature?.comment ||
        reflection.setSignature?.comment
    );
}

/**
 * The ids of the samples a symbol shows in its JSDoc: `@sample filtering`
 */
function sampleIds(reflection) {
    const tags = commentOf(reflection)?.blockTags.filter((tag) => tag.tag === '@sample') || [];
    return tags.flatMap((tag) => partsToMarkdown(tag.content).trim().split(/\s+/)).filter(Boolean);
}

const TAG_TITLES = {
    '@remarks': '',
    '@returns': 'Returns',
    '@default': 'Default',
    '@defaultValue': 'Default',
    '@deprecated': 'Deprecated',
    '@see': 'See',
    '@throws': 'Throws',
    '@example': 'Example'
};

// a list of parameters or type parameters and their text, the ones that have one
function namedList(title, reflections = []) {
    const documented = reflections.filter((r) => r.comment);
    if (!documented.length) {
        return '';
    }
    // continuation lines are indented, so a code block in the text stays in its list item
    const items = documented.map((r) => `- \`${r.name}\` ${partsToMarkdown(r.comment.summary).replace(/\n/g, '\n  ')}`);
    return `\n\n**${title}**\n\n${items.join('\n')}`;
}

/**
 * The JSDoc of a symbol or member as html: the text, its parameters, then the block tags
 * (@returns, @default, @example ...). @sample is not in it, see sampleIds().
 */
function docHtml(reflection) {
    const comment = commentOf(reflection);
    // a function, or a property with a function type: (row, field) => ...
    const functionType = reflection.type?.type === 'reflection' ? reflection.type.declaration : undefined;
    const signature = (reflection.signatures || functionType?.signatures)?.[0];
    let markdown = comment ? partsToMarkdown(comment.summary) : '';
    markdown += namedList('Type parameters', reflection.typeParameters || signature?.typeParameters);
    markdown += namedList('Parameters', signature?.parameters);

    for (const tag of comment?.blockTags || []) {
        if (tag.tag === '@sample') {
            continue;
        }
        const title = tag.tag in TAG_TITLES ? TAG_TITLES[tag.tag] : tag.tag.slice(1);
        let text = partsToMarkdown(tag.content).trim();
        // typedoc makes a code block of `@default false`, one line reads better as inline code
        const oneLine = /^```\w*\n([^\n]*)\n```$/.exec(text);
        if (oneLine && tag.tag !== '@example') {
            text = `\`${oneLine[1]}\``;
        }
        // a code block needs a line of its own
        const separator = text.startsWith('```') ? '\n\n' : ' ';
        markdown += `\n\n${title ? `**${title}**${separator}` : ''}${text}`;
    }
    return markdown.trim() ? renderMarkdown(markdown) : '';
}

// ------------------------------------------------------------------ signatures as text

// GridEvents has members like 'cell-click'
function propertyName(name) {
    return /^[A-Za-z_$][\w$]*$/.test(name) ? name : `'${name}'`;
}

function typeParameters(params) {
    if (!params?.length) {
        return '';
    }
    const list = params.map((p) => `${p.name}${p.type ? ` extends ${p.type}` : ''}${p.default ? ` = ${p.default}` : ''}`);
    return `<${list.join(', ')}>`;
}

function parameters(signature) {
    const list = (signature.parameters || []).map((p) => {
        const optional = p.flags.isOptional || p.defaultValue ? '?' : '';
        return `${p.flags.isRest ? '...' : ''}${p.name}${optional}: ${p.type}`;
    });
    return list.join(', ');
}

// prefix: 'function where', 'new Datasource', 'filter'
function signatureLine(signature, prefix) {
    return `${prefix}${typeParameters(signature.typeParameters)}(${parameters(signature)}): ${signature.type}`;
}

function heritage(keyword, types) {
    return types?.length ? ` ${keyword} ${types.join(', ')}` : '';
}

/**
 * How a top level symbol is declared, one line per signature: `function where(...): FilterCondition`
 */
function declarationLines(r) {
    const name = r.name + typeParameters(r.typeParameters);
    switch (r.kind) {
        case KIND.Class:
            return [`class ${name}${heritage('extends', r.extendedTypes)}${heritage('implements', r.implementedTypes)}`];
        case KIND.Interface:
            return [`interface ${name}${heritage('extends', r.extendedTypes)}`];
        case KIND.TypeAlias:
            // an object type has no type of its own here, its properties are the members
            return [r.type ? `type ${name} = ${r.type}` : `type ${name}`];
        case KIND.Function:
            return r.signatures.map((signature) => signatureLine(signature, `function ${r.name}`));
        case KIND.Variable:
            return [`${r.flags.isConst ? 'const' : 'let'} ${r.name}: ${r.type}`];
        default:
            return [`${KIND.singularString(r.kind).toLowerCase()} ${name}`];
    }
}

/**
 * How a member of a class, interface or object type is declared
 */
function memberLines(member, ownerName) {
    const name = propertyName(member.name);
    const isStatic = member.flags.isStatic ? 'static ' : '';
    const optional = member.flags.isOptional ? '?' : '';
    switch (member.kind) {
        case KIND.Constructor:
            return member.signatures.map((signature) => signatureLine(signature, `new ${ownerName}`));
        case KIND.Method:
            return member.signatures.map((signature) => signatureLine(signature, `${isStatic}${name}${optional}`));
        case KIND.Accessor:
            return [
                member.getSignature && `${isStatic}get ${name}(): ${member.getSignature.type}`,
                member.setSignature && `${isStatic}set ${name}(${parameters(member.setSignature)})`
            ].filter(Boolean);
        default: {
            const readonly = member.flags.isReadonly ? 'readonly ' : '';
            return [`${isStatic}${readonly}${name}${optional}: ${member.type}`];
        }
    }
}

// ------------------------------------------------------------------ the model

/**
 * The model the API pages render (samples/demo/docs.d.ts has its types):
 * every export of src/index.ts, in typedoc's groups (Classes, Interfaces ...), with its
 * signatures as text, its JSDoc as html, the samples it names, and its members.
 * Inherited members are left out, the "extends" in the signature links to them.
 */
function buildApiModel(project) {
    const symbols = [];
    for (const group of project.groups || []) {
        for (const r of group.children) {
            if (!r.isDeclaration()) {
                continue;
            }
            const memberGroups = (r.groups || []).map((memberGroup) => ({
                title: memberGroup.title,
                members: memberGroup.children
                    .filter((member) => member.isDeclaration() && !member.inheritedFrom && !member.flags.isPrivate)
                    .map((member) => ({
                        name: member.name,
                        signatures: memberLines(member, r.name),
                        doc: docHtml(member),
                        samples: sampleIds(member)
                    }))
            }));
            symbols.push({
                name: r.name,
                group: group.title,
                kind: KIND.singularString(r.kind),
                signatures: declarationLines(r),
                doc: docHtml(r),
                samples: sampleIds(r),
                memberGroups: memberGroups.filter((memberGroup) => memberGroup.members.length)
            });
        }
    }
    return { symbols };
}

/**
 * typedoc + buildApiModel, for the site build.
 * Without typescript's type check: typedoc only parses here, the checks (typecheck, check:docs)
 * report type errors, and the site still builds with them.
 */
async function readApiModel() {
    const { project } = await convertProject({ skipErrorChecking: true });
    return buildApiModel(project);
}

/**
 * The ```ts blocks of every @example in the JSDoc, for the docs check
 * @returns {{ where: string, code: string }[]} where: the symbol and the file:line it is declared at
 */
function exampleBlocks(project) {
    const blocks = [];
    const visit = (reflection) => {
        // an inherited member has a copy of the comment of the one it inherits
        if (reflection.isDeclaration() && reflection.inheritedFrom) {
            return;
        }
        const examples = reflection.comment?.blockTags.filter((tag) => tag.tag === '@example') || [];
        const source = reflection.sources?.[0] || reflection.parent?.sources?.[0];
        const file = source ? `${path.relative(ROOT, source.fullFileName)}:${source.line}` : '?';
        // a signature has the name of its function, object types (__type) are not part of the name
        const name = (reflection.isSignature() ? reflection.parent : reflection).getFullName().replace(/\.__type/g, '');
        examples.forEach((tag, index) => {
            for (const block of tsCodeBlocks(partsToMarkdown(tag.content))) {
                const number = examples.length > 1 ? ` ${index + 1}` : '';
                blocks.push({ where: `${file} ${name} @example${number}`, code: block.code });
            }
        });
        reflection.traverse(visit);
        // traverse() does not go into object types, like the payloads in GridEvents
        if (reflection.isDeclaration() && reflection.type?.type === 'reflection') {
            visit(reflection.type.declaration);
        }
    };
    project.traverse(visit);
    return blocks;
}

module.exports = { convertProject, buildApiModel, readApiModel, exampleBlocks };
