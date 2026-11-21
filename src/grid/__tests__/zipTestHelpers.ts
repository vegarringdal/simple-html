import zlib from 'node:zlib';
import { expect } from 'vitest';

/**
 * A ZIP reader for the tests, written from APPNOTE.TXT and not from zip.ts: it finds the end of
 * central directory record, reads the central directory, and for each entry the local file header it
 * points to - the fields of both must agree. The data is inflated with node's zlib (raw DEFLATE) and
 * its CRC checked with zlib.crc32.
 */

/** an entry as the ZIP holds it */
export interface ReadEntry {
    name: string;
    /** the raw bytes of the name */
    nameBytes: Uint8Array;
    versionMadeBy: number;
    versionNeeded: number;
    flags: number;
    method: number;
    time: number;
    date: number;
    crc: number;
    compressedSize: number;
    size: number;
    offset: number;
    /** the bytes after inflating (method 8) or as stored (method 0) */
    data: Uint8Array;
}

/**
 * every entry of the ZIP, in the order of the central directory; fails the test when the ZIP is not
 * what APPNOTE describes
 */
export function readZip(bytes: Uint8Array): ReadEntry[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = (at: number) => view.getUint16(at, true);
    const u32 = (at: number) => view.getUint32(at, true);

    // the end of central directory record: the last 22 bytes, there is no comment
    const end = bytes.length - 22;
    expect(u32(end), 'end of central directory signature').toBe(0x06054b50);
    expect(u16(end + 4), 'number of this disk').toBe(0);
    expect(u16(end + 6), 'disk of the central directory').toBe(0);
    const count = u16(end + 10);
    expect(u16(end + 8), 'entries on this disk = entries').toBe(count);
    const directorySize = u32(end + 12);
    const directoryOffset = u32(end + 16);
    expect(u16(end + 20), 'comment length').toBe(0);
    // the central directory ends where the end record starts
    expect(directoryOffset + directorySize).toBe(end);

    const entries: ReadEntry[] = [];
    let at = directoryOffset;
    for (let i = 0; i < count; i++) {
        expect(u32(at), 'central file header signature').toBe(0x02014b50);
        const nameLength = u16(at + 28);
        const extraLength = u16(at + 30);
        const commentLength = u16(at + 32);
        expect([extraLength, commentLength, u16(at + 34)], 'extra, comment, disk start').toEqual([0, 0, 0]);
        const nameBytes = bytes.slice(at + 46, at + 46 + nameLength);
        // bit 11: the name is UTF-8, else IBM 437 - the same bytes as ASCII for an ASCII name
        const name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
        const entry = {
            versionMadeBy: u16(at + 4),
            versionNeeded: u16(at + 6),
            flags: u16(at + 8),
            method: u16(at + 10),
            time: u16(at + 12),
            date: u16(at + 14),
            crc: u32(at + 16),
            compressedSize: u32(at + 20),
            size: u32(at + 24),
            internalAttributes: u16(at + 36),
            externalAttributes: u32(at + 38),
            offset: u32(at + 42)
        };
        at += 46 + nameLength + extraLength + commentLength;

        // the local file header has the same fields
        const local = entry.offset;
        expect(u32(local), 'local file header signature').toBe(0x04034b50);
        expect(u16(local + 4)).toBe(entry.versionNeeded);
        expect(u16(local + 6)).toBe(entry.flags);
        expect(u16(local + 8)).toBe(entry.method);
        expect(u16(local + 10)).toBe(entry.time);
        expect(u16(local + 12)).toBe(entry.date);
        expect(u32(local + 14)).toBe(entry.crc);
        expect(u32(local + 18)).toBe(entry.compressedSize);
        expect(u32(local + 22)).toBe(entry.size);
        expect(u16(local + 26)).toBe(nameLength);
        const localExtra = u16(local + 28);
        expect(Array.from(bytes.slice(local + 30, local + 30 + nameLength))).toEqual(Array.from(nameBytes));

        const start = local + 30 + nameLength + localExtra;
        const raw = bytes.slice(start, start + entry.compressedSize);
        expect([0, 8]).toContain(entry.method);
        const data = entry.method === 8 ? new Uint8Array(zlib.inflateRawSync(raw)) : raw;
        expect(data.length, `the uncompressed size of ${name}`).toBe(entry.size);
        expect(zlib.crc32(data) >>> 0, `the CRC of ${name}`).toBe(entry.crc);
        entries.push({ ...entry, name, nameBytes, data });
    }
    expect(at, 'the central directory size').toBe(end);
    return entries;
}

/**
 * the parts of an .xlsx file as text, by name
 */
export function readParts(bytes: Uint8Array): Record<string, string> {
    const parts: Record<string, string> = {};
    for (const entry of readZip(bytes)) {
        parts[entry.name] = new TextDecoder('utf-8', { fatal: true }).decode(entry.data);
    }
    return parts;
}

/**
 * every character XML 1.0 can not hold
 */
const NOT_XML_CHAR = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/u;

/**
 * The XML document of a part, checked to be well-formed: happy-dom's DOMParser finds unclosed and
 * crossed elements and a second root (a parsererror element), but takes an unknown entity, a
 * repeated attribute and a control character - those are checked here
 */
export function parseXml(text: string): Document {
    expect(text.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')).toBe(true);
    expect(NOT_XML_CHAR.test(text), 'a character XML can not hold').toBe(false);
    // every & starts one of XML's five entities or a character reference
    expect(text.match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g), 'an & that is no entity').toBeNull();
    // no attribute twice in a start tag
    for (const tag of text.match(/<[^!?/][^>]*>/g) ?? []) {
        const names = Array.from(tag.matchAll(/\s([\w:]+)="/g), (match) => match[1]);
        expect(new Set(names).size, `a repeated attribute in ${tag}`).toBe(names.length);
    }
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    expect(doc.getElementsByTagName('parsererror').length, 'a parse error').toBe(0);
    return doc;
}
