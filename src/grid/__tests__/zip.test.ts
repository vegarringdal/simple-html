import zlib from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { crc32, deflateRaw, dosDateTime, zip } from '../zip';
import { readZip } from './zipTestHelpers';

/**
 * zip.ts: the ZIP is read back by hand (zipTestHelpers.ts, from APPNOTE.TXT): the end record, the
 * central directory, the local headers, the CRCs (zlib.crc32) and the data (zlib.inflateRawSync).
 */

const text = (value: string) => new TextEncoder().encode(value);

// a fixed time, so the DOS time and date are known: 2026-11-20 13:45:12 local
const date = new Date(2026, 10, 20, 13, 45, 12);

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('zip - the records', () => {
    it('expect a stored file: method 0, version 1.0, the sizes, the CRC and the data as they are', async () => {
        const data = text('hello');
        const entries = readZip(await zip([{ name: 'hello.txt', data }], { deflate: false, date }));

        expect(entries.length).toBe(1);
        const [entry] = entries;
        expect(entry.name).toBe('hello.txt');
        expect(entry.method).toBe(0);
        expect(entry.versionNeeded).toBe(10);
        expect(entry.versionMadeBy).toBe(20);
        expect(entry.flags).toBe(0);
        expect(entry.size).toBe(5);
        expect(entry.compressedSize).toBe(5);
        expect(entry.crc).toBe(zlib.crc32(data));
        expect(entry.offset).toBe(0);
        expect(Array.from(entry.data)).toEqual(Array.from(data));
    });

    it('expect a deflated file: method 8, version 2.0, a raw DEFLATE stream zlib inflates', async () => {
        const data = text('<row><c>Ann</c></row>'.repeat(200));
        const [entry] = readZip(await zip([{ name: 'sheet.xml', data }], { date }));

        expect(entry.method).toBe(8);
        expect(entry.versionNeeded).toBe(20);
        expect(entry.compressedSize).toBeLessThan(data.length / 10);
        expect(entry.size).toBe(data.length);
        expect(new TextDecoder().decode(entry.data)).toBe(new TextDecoder().decode(data));
    });

    it('expect a file deflating does not make smaller to be stored', async () => {
        // a CRC table's worth of bytes that do not repeat: deflate makes them longer
        const data = new Uint8Array(new Uint32Array(Array.from({ length: 64 }, (_, i) => crc32(new Uint8Array([i])))).buffer);
        const [entry] = readZip(await zip([{ name: 'noise.bin', data }], { date }));
        expect(entry.method).toBe(0);
        expect(entry.compressedSize).toBe(data.length);
    });

    it('expect an empty file: size 0, CRC 0, stored', async () => {
        const [entry] = readZip(await zip([{ name: 'empty.txt', data: new Uint8Array(0) }], { date }));
        expect(entry.size).toBe(0);
        expect(entry.compressedSize).toBe(0);
        expect(entry.crc).toBe(0);
        expect(entry.method).toBe(0);
    });

    it('expect an empty ZIP: the end record only', async () => {
        const bytes = await zip([], { date });
        expect(bytes.length).toBe(22);
        expect(readZip(bytes)).toEqual([]);
    });

    it('expect the names as UTF-8, the language encoding flag (bit 11) on a name with more than ASCII', async () => {
        const entries = readZip(
            await zip(
                [
                    { name: 'xl/workbook.xml', data: text('a') },
                    { name: 'æøå/Ærø 😀.txt', data: text('b') }
                ],
                { date }
            )
        );
        expect(entries.map((entry) => entry.name)).toEqual(['xl/workbook.xml', 'æøå/Ærø 😀.txt']);
        expect(entries[0].flags).toBe(0);
        expect(entries[1].flags).toBe(0x0800);
        expect(Array.from(entries[1].nameBytes)).toEqual(Array.from(text('æøå/Ærø 😀.txt')));
    });

    it('expect many files: each local header where the central directory says, the files in order', async () => {
        const files = Array.from({ length: 300 }, (_, i) => ({ name: `part${i}.xml`, data: text(`<p>${i}</p>`.repeat(i)) }));
        const entries = readZip(await zip(files, { date }));

        expect(entries.map((entry) => entry.name)).toEqual(files.map((file) => file.name));
        entries.forEach((entry, i) => {
            expect(new TextDecoder().decode(entry.data)).toBe(`<p>${i}</p>`.repeat(i));
        });
        // each local header right after the data of the one before: 30 bytes + the name + the data
        for (let i = 1; i < entries.length; i++) {
            const before = entries[i - 1];
            expect(entries[i].offset).toBe(before.offset + 30 + before.nameBytes.length + before.compressedSize);
        }
    });

    it('expect the modification time in MS-DOS format, local time, 2 second steps', async () => {
        const [entry] = readZip(await zip([{ name: 'a.txt', data: text('a') }], { date }));
        expect(entry.time >> 11).toBe(13);
        expect((entry.time >> 5) & 0x3f).toBe(45);
        expect((entry.time & 0x1f) * 2).toBe(12);
        expect((entry.date >> 9) + 1980).toBe(2026);
        expect((entry.date >> 5) & 0xf).toBe(11);
        expect(entry.date & 0x1f).toBe(20);
    });

    it('expect a RangeError for more files than the 2 byte count holds', async () => {
        const files = Array.from({ length: 65_536 }, () => ({ name: 'a', data: new Uint8Array(0) }));
        await expect(zip(files, { deflate: false })).rejects.toThrow(RangeError);
    });
});

describe('zip - without CompressionStream', () => {
    it("expect every file stored when the browser has no CompressionStream('deflate-raw')", async () => {
        vi.stubGlobal('CompressionStream', undefined);
        const data = text('aaaa'.repeat(100));
        expect(await deflateRaw(data)).toBeNull();
        const [entry] = readZip(await zip([{ name: 'a.txt', data }], { date }));
        expect(entry.method).toBe(0);
        expect(entry.size).toBe(400);
    });

    it("expect every file stored when CompressionStream does not know 'deflate-raw' (Chrome 80-102)", async () => {
        const Original = CompressionStream;
        vi.stubGlobal(
            'CompressionStream',
            class extends Original {
                constructor(format: CompressionFormat) {
                    if (format === 'deflate-raw') {
                        throw new TypeError(`'${format}' is not a valid enum value of type CompressionFormat`);
                    }
                    super(format);
                }
            }
        );
        const [entry] = readZip(await zip([{ name: 'a.txt', data: text('aaaa'.repeat(100)) }], { date }));
        expect(entry.method).toBe(0);
    });
});

describe('crc32 and dosDateTime', () => {
    it('expect the CRC-32 check value, and the CRC zlib computes', () => {
        expect(crc32(text('123456789'))).toBe(0xcbf43926);
        expect(crc32(new Uint8Array(0))).toBe(0);
        const bytes = text('Ærøskøbing 😀 '.repeat(1000));
        expect(crc32(bytes)).toBe(zlib.crc32(bytes));
    });

    it('expect the DOS date range 1980-2107: before and invalid is 1980-01-01, after is 2107-12-31 23:59:58', () => {
        expect(dosDateTime(new Date(1979, 11, 31, 23, 59, 59))).toEqual({ time: 0, day: (1 << 5) | 1 });
        expect(dosDateTime(new Date(Number.NaN))).toEqual({ time: 0, day: (1 << 5) | 1 });
        expect(dosDateTime(new Date(2108, 0, 1))).toEqual({
            time: (23 << 11) | (59 << 5) | 29,
            day: (127 << 9) | (12 << 5) | 31
        });
        expect(dosDateTime(new Date(1980, 0, 1, 0, 0, 1))).toEqual({ time: 0, day: (1 << 5) | 1 });
    });
});
