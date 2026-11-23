import { ImportFileError } from './importLimits';
import { crc32 } from './zip';

/**
 * Reads the files of a ZIP: the import reads .xlsx files with it (xlsxRead.ts), an .xlsx file is a ZIP
 * of XML parts. The other half of zip.ts, the same subset of PKWARE's APPNOTE.TXT (version 6.3.10): the
 * end of central directory record (4.3.16), the central directory (4.3.12), the local file headers
 * (4.3.7), files stored (method 0) or deflated (method 8). Every number is unsigned little endian.
 *
 * The bytes come from a file a user picked, so nothing in them is trusted:
 *
 * - every offset and size is checked against the bytes there are before it is read
 * - an encrypted file, ZIP64 (the 32-bit fields at their maximum), another method than 0 and 8: the
 *   ZIP is not read - an .xlsx file has none of them
 * - a file larger than `maxSize`, the caller's limit for a "zip bomb" (kilobytes that inflate to
 *   gigabytes), is not inflated at all. A deflated file is inflated with the browser's
 *   `DecompressionStream('deflate-raw')`, a stream: it stops as soon as more comes out than the size the
 *   ZIP gives - a ZIP that gives a small size and inflates to more is never held in memory
 * - what comes out must be the size and have the CRC-32 the ZIP gives: damaged data is no file
 *
 * Every problem is an `ImportFileError`: `'broken'`, `'tooLarge'` past `maxSize`, `'unsupported'` without
 * the stream.
 */

/**
 * A file in the ZIP, as its central directory gives it.
 */
export interface UnzipEntry {
    /** the path in the ZIP, `xl/workbook.xml` */
    name: string;
    /** 0 stored, 8 deflated */
    method: number;
    /** the size of its data in the ZIP */
    compressedSize: number;
    /** the size of the file, inflated */
    size: number;
    /** the CRC-32 of the file */
    crc: number;
    /** where its local file header starts */
    offset: number;
}

// the signatures of the records (APPNOTE 4.3.7, 4.3.12, 4.3.16)
const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

// the fixed part of each record, in bytes
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_RECORD_SIZE = 22;

// the end record is the last thing in the ZIP, after it only its comment of at most 65 535 bytes
const MAX_COMMENT = 0xffff;

// general purpose bit 0 (4.4.4): the file is encrypted
const ENCRYPTED_FLAG = 0x0001;

// the value of a 2 and a 4 byte field that says the real one is in the ZIP64 record (4.4.1.4)
const ZIP64_16 = 0xffff;
const ZIP64_32 = 0xffffffff;

/**
 * the error of a ZIP that is not read
 */
function broken(why: string): ImportFileError {
    return new ImportFileError('broken', `The file is not a ZIP that can be read: ${why}`);
}

/**
 * The files of the ZIP, in the order of its central directory: their names, sizes and where they are.
 * The data is read with {@link unzipEntry}.
 *
 * @throws an `ImportFileError` (`'broken'`) when the bytes are not a ZIP this reads: no end record,
 * a record outside the bytes, ZIP64, an encrypted file
 */
export function unzipEntries(bytes: Uint8Array): UnzipEntry[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = (at: number) => view.getUint16(at, true);
    const u32 = (at: number) => view.getUint32(at, true);

    // the end record: searched from the end, past a comment it can have
    let end = -1;
    for (let at = bytes.length - END_RECORD_SIZE; at >= 0 && at >= bytes.length - END_RECORD_SIZE - MAX_COMMENT; at--) {
        if (u32(at) === END_OF_CENTRAL_DIRECTORY) {
            end = at;
            break;
        }
    }
    if (end === -1) {
        throw broken('no end of central directory record');
    }
    const count = u16(end + 10);
    const directorySize = u32(end + 12);
    const directoryOffset = u32(end + 16);
    if (count === ZIP64_16 || directorySize === ZIP64_32 || directoryOffset === ZIP64_32) {
        throw broken('ZIP64 is not read');
    }
    if (directoryOffset + directorySize > end) {
        throw broken('the central directory is outside the file');
    }

    const entries: UnzipEntry[] = [];
    let at = directoryOffset;
    for (let i = 0; i < count; i++) {
        if (at + CENTRAL_HEADER_SIZE > end || u32(at) !== CENTRAL_FILE_HEADER) {
            throw broken('a central directory entry is missing');
        }
        const flags = u16(at + 8);
        const nameLength = u16(at + 28);
        const extraLength = u16(at + 30);
        const commentLength = u16(at + 32);
        if (at + CENTRAL_HEADER_SIZE + nameLength > end) {
            throw broken('a name is outside the central directory');
        }
        const entry: UnzipEntry = {
            name: new TextDecoder().decode(bytes.subarray(at + CENTRAL_HEADER_SIZE, at + CENTRAL_HEADER_SIZE + nameLength)),
            method: u16(at + 10),
            crc: u32(at + 16),
            compressedSize: u32(at + 20),
            size: u32(at + 24),
            offset: u32(at + 42)
        };
        if (flags & ENCRYPTED_FLAG) {
            throw broken(`${entry.name} is encrypted`);
        }
        if (entry.compressedSize === ZIP64_32 || entry.size === ZIP64_32 || entry.offset === ZIP64_32) {
            throw broken('ZIP64 is not read');
        }
        entries.push(entry);
        at += CENTRAL_HEADER_SIZE + nameLength + extraLength + commentLength;
    }
    return entries;
}

/**
 * The bytes of a file of the ZIP: stored, or inflated - see the top of the file for what is checked.
 *
 * @param maxSize the most bytes it gives: a file of a larger size, or one that inflates to more, is not
 * read
 * @throws an `ImportFileError`: `'tooLarge'` past `maxSize`, `'broken'` for damaged data, another
 * method than stored and deflated, `'unsupported'` without `DecompressionStream('deflate-raw')`
 */
export async function unzipEntry(bytes: Uint8Array, entry: UnzipEntry, maxSize: number): Promise<Uint8Array> {
    if (entry.size > maxSize) {
        throw new ImportFileError('tooLarge', `${entry.name} is ${entry.size} bytes, more than ${maxSize}`);
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // the data follows the local file header, its name and its extra field - which can differ from the
    // central directory's
    if (entry.offset + LOCAL_HEADER_SIZE > bytes.length || view.getUint32(entry.offset, true) !== LOCAL_FILE_HEADER) {
        throw broken(`the local header of ${entry.name} is missing`);
    }
    const start =
        entry.offset + LOCAL_HEADER_SIZE + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
    if (start + entry.compressedSize > bytes.length) {
        throw broken(`the data of ${entry.name} is outside the file`);
    }
    const data = bytes.subarray(start, start + entry.compressedSize);

    let file: Uint8Array;
    if (entry.method === 0) {
        file = data;
    } else if (entry.method === 8) {
        file = await inflateRaw(data, entry.size, entry.name);
    } else {
        throw broken(`${entry.name} is compressed with method ${entry.method}, not stored (0) or deflated (8)`);
    }
    if (file.length !== entry.size || crc32(file) !== entry.crc) {
        throw broken(`${entry.name} is damaged: its size or CRC is not the one the ZIP gives`);
    }
    return file;
}

/**
 * Inflates a raw DEFLATE stream (RFC 1951, ZIP's method 8) with `DecompressionStream('deflate-raw')`,
 * reading what comes out chunk by chunk: past `size` bytes it stops - the stream is cancelled, nothing
 * more is inflated
 * @param size the size the ZIP gives, already checked against the caller's limit
 * @param name the file's name, for the messages
 */
async function inflateRaw(data: Uint8Array, size: number, name: string): Promise<Uint8Array> {
    let stream: DecompressionStream;
    try {
        stream = new DecompressionStream('deflate-raw');
    } catch {
        // no DecompressionStream (a ReferenceError), or one without 'deflate-raw' (a TypeError)
        throw new ImportFileError('unsupported', 'This browser has no DecompressionStream("deflate-raw") to read an .xlsx file');
    }
    // the stream's type wants an ArrayBuffer under the bytes: a copy has one
    const reader = new Blob([data.slice()]).stream().pipeThrough(stream).getReader();
    const out = new Uint8Array(size);
    let length = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            if (length + value.length > size) {
                // the ZIP gives a size the data does not have: the limit is the size, a lie is no file
                await reader.cancel();
                throw broken(`${name} inflates to more than the ${size} bytes the ZIP gives`);
            }
            out.set(value, length);
            length += value.length;
        }
    } catch (error) {
        if (error instanceof ImportFileError) {
            throw error;
        }
        // the stream's own error: data that is not DEFLATE
        throw broken(`${name} does not inflate`);
    }
    return out.subarray(0, length);
}
