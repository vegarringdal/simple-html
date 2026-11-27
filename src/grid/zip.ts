/**
 * A ZIP file from plain inputs: names and bytes in, the bytes of the .zip out. The Excel export
 * (xlsx.ts) uses it, an .xlsx file is a ZIP of XML parts.
 *
 * The format is PKWARE's APPNOTE.TXT (https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT,
 * version 6.3.10), the subset every reader knows: for each file a local file header (4.3.7) and its
 * data, then the central directory (4.3.12) and the end of central directory record (4.3.16). No
 * ZIP64, no encryption, no data descriptors (the sizes and the CRC are known before the header is
 * written), no comments, no extra fields. Every number is unsigned little endian (4.4.1.1).
 *
 * A file is deflated (method 8) with the browser's `CompressionStream('deflate-raw')`, the raw
 * DEFLATE stream of RFC 1951 without a zlib header - what method 8 holds. Without it (an old
 * browser) the file is stored (method 0), as it also is when deflating does not make it smaller.
 */

/**
 * One file of the ZIP.
 */
export interface ZipEntry {
    /** the path in the ZIP, with `/` between the folders: `xl/workbook.xml` */
    name: string;
    /** the bytes of the file */
    data: Uint8Array;
}

/**
 * How {@link zip} writes the files.
 */
export interface ZipOptions {
    /** deflate the files that get smaller by it, default `true`. `false` stores every file */
    deflate?: boolean;
    /** the modification time of every file, default now. ZIP keeps it in local time */
    date?: Date;
}

// the signatures of the records (APPNOTE 4.3.7, 4.3.12, 4.3.16)
const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

// the fixed part of each record, in bytes: the name follows it
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_RECORD_SIZE = 22;

// compression method (4.4.5)
const STORED = 0;
const DEFLATED = 8;

// version needed to extract (4.4.3.2): 1.0 is the default, 2.0 for a deflated file
const VERSION_STORED = 10;
const VERSION_DEFLATED = 20;

// version made by (4.4.2): upper byte 0 (MS-DOS: the external attributes are DOS attributes, all 0
// here), lower byte the APPNOTE version this writer follows the features of: 2.0
const VERSION_MADE_BY = 20;

// general purpose bit 11 (4.4.4): the name is UTF-8. Set only for a name with characters outside
// ASCII: an ASCII name is the same bytes either way, and Excel's own files leave it off
const UTF8_FLAG = 0x0800;

// the largest values the 2 and 4 byte fields hold: beyond them a ZIP needs ZIP64
const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;

/**
 * The bytes of a ZIP file of the entries, in the order given.
 *
 * @throws a `RangeError` for more than 65 535 files, a name longer than 65 535 bytes, or a ZIP of
 * 4 GiB or more: those need ZIP64, which this writer does not write
 *
 * @example
 * const bytes = await zip([{ name: 'hello.txt', data: new TextEncoder().encode('hello') }]);
 * new Blob([bytes], { type: 'application/zip' });
 */
export async function zip(entries: ZipEntry[], options: ZipOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
    const { deflate = true, date = new Date() } = options;
    if (entries.length > MAX_UINT16) {
        throw new RangeError(`zip: at most ${MAX_UINT16} files, got ${entries.length}`);
    }
    const { time, day } = dosDateTime(date);

    // each file as it is written: compressed or stored, with its CRC of the bytes before compression
    const files = [];
    for (const entry of entries) {
        const name = new TextEncoder().encode(entry.name);
        if (name.length > MAX_UINT16) {
            throw new RangeError(`zip: a name is at most ${MAX_UINT16} bytes, '${entry.name.slice(0, 40)}...' is longer`);
        }
        const deflated = deflate ? await deflateRaw(entry.data) : null;
        const useDeflated = deflated !== null && deflated.length < entry.data.length;
        files.push({
            name,
            flags: isAscii(entry.name) ? 0 : UTF8_FLAG,
            method: useDeflated ? DEFLATED : STORED,
            version: useDeflated ? VERSION_DEFLATED : VERSION_STORED,
            crc: crc32(entry.data),
            size: entry.data.length,
            data: useDeflated ? deflated : entry.data,
            offset: 0
        });
    }

    let size = END_RECORD_SIZE;
    for (const file of files) {
        size += LOCAL_HEADER_SIZE + CENTRAL_HEADER_SIZE + 2 * file.name.length + file.data.length;
    }
    if (size > MAX_UINT32) {
        throw new RangeError('zip: the file would be 4 GiB or more, that needs ZIP64');
    }

    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);
    let at = 0;
    const u16 = (value: number) => {
        view.setUint16(at, value, true);
        at += 2;
    };
    const u32 = (value: number) => {
        view.setUint32(at, value, true);
        at += 4;
    };
    const put = (data: Uint8Array) => {
        bytes.set(data, at);
        at += data.length;
    };

    // the local file headers (4.3.7), each followed by the file's data
    for (const file of files) {
        file.offset = at;
        u32(LOCAL_FILE_HEADER);
        u16(file.version);
        u16(file.flags);
        u16(file.method);
        u16(time);
        u16(day);
        u32(file.crc);
        u32(file.data.length); // compressed size
        u32(file.size); // uncompressed size
        u16(file.name.length);
        u16(0); // extra field length
        put(file.name);
        put(file.data);
    }

    // the central directory (4.3.12): the same fields again, and where each local header is
    const centralDirectory = at;
    for (const file of files) {
        u32(CENTRAL_FILE_HEADER);
        u16(VERSION_MADE_BY);
        u16(file.version);
        u16(file.flags);
        u16(file.method);
        u16(time);
        u16(day);
        u32(file.crc);
        u32(file.data.length);
        u32(file.size);
        u16(file.name.length);
        u16(0); // extra field length
        u16(0); // file comment length
        u16(0); // disk number start
        u16(0); // internal file attributes: bit 0 clear, binary data (4.4.14)
        u32(0); // external file attributes: no DOS attributes (4.4.15)
        u32(file.offset);
        put(file.name);
    }

    // the end of central directory record (4.3.16): one disk, every entry on it
    const centralDirectorySize = at - centralDirectory;
    u32(END_OF_CENTRAL_DIRECTORY);
    u16(0); // number of this disk
    u16(0); // the disk the central directory starts on
    u16(files.length); // entries on this disk
    u16(files.length); // entries in all
    u32(centralDirectorySize);
    u32(centralDirectory);
    u16(0); // comment length

    return bytes;
}

/**
 * The bytes deflated, a raw DEFLATE stream (RFC 1951) as ZIP's method 8 holds it, by the browser's
 * `CompressionStream('deflate-raw')`. `null` when there is no such stream: no `CompressionStream`,
 * or one without `'deflate-raw'` (the constructor throws a TypeError for a format it does not know;
 * Chrome 80-102 had `'deflate'` and `'gzip'` only).
 */
export async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
    if (typeof CompressionStream === 'undefined') {
        return null;
    }
    let stream: CompressionStream;
    try {
        stream = new CompressionStream('deflate-raw');
    } catch {
        return null;
    }

    // write and read at the same time: the stream holds back the writing until its output is read.
    // The stream's type wants an ArrayBuffer under the bytes, not a SharedArrayBuffer: the bytes here
    // come from a TextEncoder
    const writer = stream.writable.getWriter();
    const written = writer.write(data as Uint8Array<ArrayBuffer>).then(() => writer.close());
    const reader = stream.readable.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        chunks.push(value);
    }
    await written;

    const out = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
    let at = 0;
    for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.length;
    }
    return out;
}

/**
 * the CRC table of the polynomial 0xEDB88320 (0x04C11DB7 bit reversed), made the first time it is used
 */
let crcTable: Uint32Array | undefined;

/**
 * The CRC-32 of the bytes, as ZIP has it (APPNOTE 4.4.7): the register starts as all ones and the
 * result is its one's complement. The same CRC as zlib's `crc32()`.
 *
 * @example
 * crc32(new TextEncoder().encode('123456789')); // 0xcbf43926
 */
export function crc32(data: Uint8Array): number {
    const table = crcTable ?? makeCrcTable();
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

/**
 * the CRC of each byte value, for crc32()
 */
function makeCrcTable(): Uint32Array {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    crcTable = table;
    return table;
}

/**
 * A date as the MS-DOS time and date ZIP keeps (APPNOTE 4.4.6), in local time:
 * - time: the hour in bits 11-15, the minute in 5-10, the seconds / 2 in 0-4 (2 second steps)
 * - date: the year - 1980 in bits 9-15, the month (1-12) in 5-8, the day in 0-4
 *
 * The years it holds are 1980-2107: a date before is written as 1980-01-01 00:00:00, one after as
 * 2107-12-31 23:59:58, an invalid Date as 1980-01-01.
 */
export function dosDateTime(date: Date): { time: number; day: number } {
    const year = date.getFullYear();
    if (Number.isNaN(year) || year < 1980) {
        return { time: 0, day: (1 << 5) | 1 };
    }
    if (year > 2107) {
        return { time: (23 << 11) | (59 << 5) | 29, day: (127 << 9) | (12 << 5) | 31 };
    }
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
}

/**
 * true when the text is ASCII only (U+0000 to U+007F)
 */
function isAscii(text: string): boolean {
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) > 0x7f) {
            return false;
        }
    }
    return true;
}
