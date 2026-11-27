import { describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { Entity } from '../../datasource/entity';
import { NumberFormatterDot } from '../../datasource/numberFormatterDot';
import { TextFormatter } from '../../datasource/textFormatter';
import {
    cellFieldText,
    type FieldText,
    fieldTextOf,
    fillTemplate,
    isWholeAddress,
    LINK_PROTOCOLS,
    linkOf,
    parseTemplate,
    templateFields,
    templateFormatter,
    templateProblem,
    urlTemplateProblem
} from '../cellTemplate';

/**
 * The templates of a text column (cellTemplate.ts): the placeholders, the text of a template, the
 * address of a link - its encoding, the schemes it may have, what `new URL()` cleans up - and hostile
 * values, in the data and in the template. The grid side is in linkColumn.test.ts.
 */

/** the text of the fields from a plain object: '' for a field it does not have */
const valuesOf =
    (values: Record<string, string>): FieldText =>
    (field) =>
        values[field] ?? '';

describe('templates - the placeholders', () => {
    it('expect a template in its pieces: the text between the placeholders and the placeholders', () => {
        expect(parseTemplate('{name} ({id})')).toEqual([{ field: 'name' }, { text: ' (' }, { field: 'id' }, { text: ')' }]);
        expect(parseTemplate('no placeholder')).toEqual([{ text: 'no placeholder' }]);
        expect(parseTemplate('')).toEqual([]);
        expect(parseTemplate('{a}{b}')).toEqual([{ field: 'a' }, { field: 'b' }]);
    });

    it('expect a brace that is not part of a placeholder to be text', () => {
        expect(parseTemplate('{}')).toEqual([{ text: '{}' }]);
        expect(parseTemplate('{a')).toEqual([{ text: '{a' }]);
        expect(parseTemplate('a}')).toEqual([{ text: 'a}' }]);
        // the inner one is the placeholder
        expect(parseTemplate('{a{b}}')).toEqual([{ text: '{a' }, { field: 'b' }, { text: '}' }]);
    });

    it('expect a name as written: spaces, dots and any other character but a brace', () => {
        expect(templateFields('{first name}{a.b}{ x }{ø}')).toEqual(['first name', 'a.b', ' x ', 'ø']);
    });

    it('expect the fields of a template once each, in order', () => {
        expect(templateFields('{b} {a} {b} {value}')).toEqual(['b', 'a', 'value']);
    });

    it('expect the text of a template: each placeholder its field, a field without a value empty', () => {
        const fieldText = valuesOf({ firstname: 'Ann', lastname: 'Lee' });
        expect(fillTemplate('{firstname} {lastname}', fieldText)).toEqual('Ann Lee');
        expect(fillTemplate('{firstname} {middle} {lastname}', fieldText)).toEqual('Ann  Lee');
        expect(fillTemplate('{value} kg', valuesOf({ value: '12' }))).toEqual('12 kg');
    });

    it('expect the text of a value to stay text: html in it is no html, braces in it are no placeholders', () => {
        const fieldText = valuesOf({ name: '<img src=x onerror=alert(1)>', id: '{id}' });
        expect(fillTemplate('{name} ({id})', fieldText)).toEqual('<img src=x onerror=alert(1)> ({id})');
    });

    it('expect a placeholder of the grid own properties (__...) to be a problem of the template', () => {
        expect(templateProblem('{name}')).toBeNull();
        expect(templateProblem('{name} {__rowState}')).toEqual({ problem: 'internal', field: '__rowState' });
        expect(urlTemplateProblem('https://x.com/{__controller}')).toEqual({ problem: 'internal', field: '__controller' });
    });
});

describe('templates - the fields of a row', () => {
    const datasource = new Datasource({
        fields: { id: 'number', born: 'date', price: { type: 'number', formatter: 'numberComma' } }
    });
    datasource.setData([{ id: 12, name: 'Ann', born: new Date(2026, 10, 22), price: 2.5, empty: null }]);
    const row = datasource.getAllData()[0] as Entity;
    const text = fieldTextOf(row, (field) => datasource.getFormatter(field));

    it("expect each field through its formatter: the value as the field's formatter writes it", () => {
        expect(text('id')).toEqual('12');
        expect(text('name')).toEqual('Ann');
        expect(text('born')).toEqual('2026-11-22');
        expect(text('price')).toEqual('2,5');
        expect(text('empty')).toEqual('');
    });

    it('expect a field the row does not have to be empty: not one of its prototype, not one of the grid', () => {
        expect(text('missing')).toEqual('');
        expect(text('constructor')).toEqual('');
        expect(text('toString')).toEqual('');
        expect(text('__proto__')).toEqual('');
        expect(text('__rowState')).toEqual('');
        expect(text('__controller')).toEqual('');
    });

    it("expect {value} and the column's own field to be the value given, the other fields the row's", () => {
        const fieldText = cellFieldText('name', 'Bob', TextFormatter, text);
        expect(fieldText('value')).toEqual('Bob');
        expect(fieldText('name')).toEqual('Bob');
        expect(fieldText('id')).toEqual('12');
    });

    it("expect the formatter of a template: format the template, the value's {value}; editing the field's", () => {
        const formatter = templateFormatter(NumberFormatterDot, 'id', '#{value} {name}', text);
        expect(formatter.format(12)).toEqual('#12 Ann');
        // an original value, say: the other fields stay the row's
        expect(formatter.format(7)).toEqual('#7 Ann');
        expect(formatter.formatForEdit?.(12)).toEqual('12');
        expect(formatter.parse('13')).toEqual(13);
    });
});

describe('templates - the address of a link', () => {
    it('expect the schemes https, http, mailto and tel only', () => {
        expect(LINK_PROTOCOLS).toEqual(['https:', 'http:', 'mailto:', 'tel:']);
    });

    it('expect a template that starts with an allowed scheme, or is one placeholder, to be valid', () => {
        for (const template of [
            'https://crm.example.com/customer/{id}',
            'http://x.com/{id}',
            'HTTPS://X.COM/{id}',
            'mailto:{email}',
            'tel:{phone}',
            '{website}',
            'https://duckduckgo.com/?q={company}'
        ]) {
            expect(urlTemplateProblem(template), template).toBeNull();
        }
        expect(isWholeAddress('{website}')).toBe(true);
        expect(isWholeAddress('{website}/about')).toBe(false);
    });

    it('expect an empty address, one without its scheme in front, and one of another scheme to be problems', () => {
        expect(urlTemplateProblem('')).toEqual({ problem: 'empty' });
        expect(urlTemplateProblem('   ')).toEqual({ problem: 'empty' });
        // relative, a host without a scheme, a scheme from a value, text before the scheme
        for (const template of [
            '/customer/{id}',
            'www.example.com/{id}',
            '{scheme}://x.com',
            '{base}/customer/{id}',
            ' https://x.com'
        ]) {
            expect(urlTemplateProblem(template), template).toEqual({ problem: 'start' });
        }
        for (const [template, protocol] of [
            ['javascript:alert({id})', 'javascript:'],
            ['JavaScript:alert(1)', 'javascript:'],
            ['data:text/html,{x}', 'data:'],
            ['vbscript:{x}', 'vbscript:'],
            ['ftp://x.com/{id}', 'ftp:'],
            ['file:///etc/{x}', 'file:'],
            ['blob:{x}', 'blob:']
        ]) {
            expect(urlTemplateProblem(template), template).toEqual({ problem: 'protocol', protocol });
        }
    });

    it('expect a scheme of lookalike characters to be no scheme: the template does not start with one', () => {
        // a fullwidth colon, a fullwidth j, a cyrillic а in https
        for (const template of ['javascript：alert(1)', 'ｊavascript:alert(1)', 'hаttps://x.com']) {
            expect(urlTemplateProblem(template), template).not.toBeNull();
            expect(linkOf(template, valuesOf({}))).toEqual({ problem: 'invalid' });
        }
    });

    it('expect the values in the address encoded: they can not end the path, add a query or change the host', () => {
        expect(linkOf('https://crm.example.com/customer/{id}', valuesOf({ id: '12' }))).toEqual({
            href: 'https://crm.example.com/customer/12'
        });
        expect(linkOf('https://crm.example.com/customer/{id}', valuesOf({ id: 'a/b?c=d#e' }))).toEqual({
            href: 'https://crm.example.com/customer/a%2Fb%3Fc%3Dd%23e'
        });
        expect(linkOf('https://duckduckgo.com/?q={company}', valuesOf({ company: 'Acme & Co + 1' }))).toEqual({
            href: 'https://duckduckgo.com/?q=Acme%20%26%20Co%20%2B%201'
        });
        // a value in the host: an @ in it (the user of another host) is encoded, a host can not have it - no link
        expect(linkOf('https://{sub}.example.com/', valuesOf({ sub: 'evil.com@x' }))).toEqual({ problem: 'invalid' });
        expect(linkOf('https://{sub}.example.com/', valuesOf({ sub: 'shop' }))).toEqual({ href: 'https://shop.example.com/' });
    });

    it('expect the @ of a mailto: and the + of a tel: address kept, the rest encoded: no header, no parameter', () => {
        expect(linkOf('mailto:{email}', valuesOf({ email: 'ann@example.com' }))).toEqual({ href: 'mailto:ann@example.com' });
        expect(linkOf('mailto:{email}', valuesOf({ email: 'ann@example.com?bcc=eve@evil.com' }))).toEqual({
            href: 'mailto:ann@example.com%3Fbcc%3Deve@evil.com'
        });
        expect(linkOf('mailto:{email}?subject={subject}', valuesOf({ email: 'a@b.no', subject: 'Order 12 & more' }))).toEqual({
            href: 'mailto:a@b.no?subject=Order%2012%20%26%20more'
        });
        expect(linkOf('tel:{phone}', valuesOf({ phone: '+47 123 45 678' }))).toEqual({ href: 'tel:+47%20123%2045%20678' });
        expect(linkOf('tel:{phone}', valuesOf({ phone: '+47;ext=1' }))).toEqual({ href: 'tel:+47%3Bext%3D1' });
        // in https the + is encoded: a query reads it as a space
        expect(linkOf('https://x.com/?q={q}', valuesOf({ q: 'a+b@c' }))).toEqual({ href: 'https://x.com/?q=a%2Bb%40c' });
    });

    it('expect a placeholder that is empty in the row to give no link', () => {
        expect(linkOf('https://x.com/{id}', valuesOf({}))).toEqual({ problem: 'blank', field: 'id' });
        expect(linkOf('{website}', valuesOf({ website: '   ' }))).toEqual({ problem: 'blank', field: 'website' });
    });

    it('expect a value . or .. to give no link: the browser would read it as a step up the path', () => {
        expect(linkOf('https://x.com/customer/{id}/orders', valuesOf({ id: '..' }))).toEqual({ problem: 'invalid' });
        expect(linkOf('https://x.com/customer/{id}', valuesOf({ id: '.' }))).toEqual({ problem: 'invalid' });
        // encoded dots are text, not a step
        expect(linkOf('https://x.com/customer/{id}', valuesOf({ id: '%2e%2e' }))).toEqual({
            href: 'https://x.com/customer/%252e%252e'
        });
    });

    it('expect a value with half an emoji (a lone surrogate) to give no link: encodeURIComponent throws for it', () => {
        expect(() => encodeURIComponent('\uD800')).toThrow(URIError);
        expect(linkOf('https://x.com/{id}', valuesOf({ id: 'a\uD800' }))).toEqual({ problem: 'invalid' });
        // a whole emoji is fine
        expect(linkOf('https://x.com/{id}', valuesOf({ id: '😀' }))).toEqual({ href: 'https://x.com/%F0%9F%98%80' });
    });

    it('expect a whole address from a field taken as it is, checked: an allowed scheme, absolute', () => {
        expect(linkOf('{website}', valuesOf({ website: 'https://example.com/a b' }))).toEqual({
            href: 'https://example.com/a%20b'
        });
        expect(linkOf('{website}', valuesOf({ website: '  https://example.com  ' }))).toEqual({ href: 'https://example.com/' });
        expect(linkOf('{email}', valuesOf({ email: 'mailto:ann@example.com' }))).toEqual({ href: 'mailto:ann@example.com' });
        // relative, no scheme: no link
        expect(linkOf('{website}', valuesOf({ website: 'www.example.com' }))).toEqual({ problem: 'invalid' });
        expect(linkOf('{website}', valuesOf({ website: '/admin' }))).toEqual({ problem: 'invalid' });
        expect(linkOf('{website}', valuesOf({ website: '//evil.com' }))).toEqual({ problem: 'invalid' });
    });

    it('expect a hostile address in the data to give no link: javascript:, data:, vbscript:, file:', () => {
        for (const [value, protocol] of [
            ['javascript:alert(1)', 'javascript:'],
            ['JAVASCRIPT:alert(1)', 'javascript:'],
            [' javascript:alert(1)', 'javascript:'],
            // the URL parser takes tabs and line breaks out before it reads the scheme
            ['java\tscript:alert(1)', 'javascript:'],
            ['java\nscript:alert(1)', 'javascript:'],
            ['\u0000javascript:alert(1)', 'javascript:'],
            ['data:text/html,<script>alert(1)</script>', 'data:'],
            ['vbscript:msgbox(1)', 'vbscript:'],
            ['file:///etc/passwd', 'file:']
        ]) {
            expect(linkOf('{website}', valuesOf({ website: value })), JSON.stringify(value)).toEqual({
                problem: 'protocol',
                protocol
            });
        }
        // an entity or a percent-encoded colon is no scheme: no absolute address
        for (const value of ['javascript&#58;alert(1)', 'javascript%3Aalert(1)', 'java&#x09;script:alert(1)']) {
            expect(linkOf('{website}', valuesOf({ website: value })), value).toEqual({ problem: 'invalid' });
        }
    });

    it('expect hostile values inside a template encoded: no new attribute, no script, no line break', () => {
        const href = (value: string) => linkOf('https://x.com/{id}', valuesOf({ id: value }));
        expect(href('" onmouseover="alert(1)')).toEqual({ href: 'https://x.com/%22%20onmouseover%3D%22alert(1)' });
        expect(href('<img src=x onerror=alert(1)>')).toEqual({ href: 'https://x.com/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E' });
        expect(href('a\nb%0a')).toEqual({ href: 'https://x.com/a%0Ab%250a' });
        expect(href('javascript:alert(1)')).toEqual({ href: 'https://x.com/javascript%3Aalert(1)' });
    });

    it('expect an international host as punycode, the one linked to: a lookalike shows where it goes', () => {
        // a cyrillic а in example
        expect(linkOf('{website}', valuesOf({ website: 'https://exаmple.com/' }))).toEqual({
            href: 'https://xn--exmple-4nf.com/'
        });
    });
});
