/* Small XLSX reader/writer using browser ZIP streams and XML; no server or CDN. */
(function (root) {
    'use strict';
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const maxExpandedBytes = 100 * 1024 * 1024;
    const crcTable = Array.from({ length: 256 }, (_, number) => {
        for (let bit = 0; bit < 8; bit++) number = (number & 1) ? 0xEDB88320 ^ (number >>> 1) : number >>> 1;
        return number >>> 0;
    });

    function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    async function inflate(bytes, expectedLength) {
        let stream;
        try {
            stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        } catch (_) {
            throw new Error('Compressed XLSX needs a current Chrome, Edge, Firefox or Safari browser with ZIP stream support. CSV still works offline.');
        }
        const reader = stream.getReader();
        const chunks = [];
        let total = 0;
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                total += value.length;
                if (total > expectedLength || total > maxExpandedBytes) {
                    await reader.cancel();
                    throw new Error('Excel archive exceeds its declared size or the safety limit.');
                }
                chunks.push(value);
            }
        } catch (error) {
            throw new Error('Unable to decompress Excel content: ' + error.message);
        }
        const output = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
        return output;
    }

    async function unzip(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let end = -1;
        for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
            if (view.getUint32(offset, true) === 0x06054B50) { end = offset; break; }
        }
        if (end < 0) throw new Error('Not a valid XLSX ZIP archive. Encrypted workbooks and .xls are unsupported.');
        if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('Multi-part Excel archives are unsupported.');
        const count = view.getUint16(end + 10, true);
        let offset = view.getUint32(end + 16, true);
        if (count > 5000 || offset === 0xFFFFFFFF) throw new Error('Workbook ZIP64 or archive size is unsupported.');
        const entries = new Map();
        let expanded = 0;
        for (let index = 0; index < count; index++) {
            if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014B50) throw new Error('Invalid Excel archive directory.');
            const flags = view.getUint16(offset + 8, true);
            const method = view.getUint16(offset + 10, true);
            const checksum = view.getUint32(offset + 16, true);
            const compressed = view.getUint32(offset + 20, true);
            const size = view.getUint32(offset + 24, true);
            const nameLength = view.getUint16(offset + 28, true);
            const extraLength = view.getUint16(offset + 30, true);
            const commentLength = view.getUint16(offset + 32, true);
            const local = view.getUint32(offset + 42, true);
            if (offset + 46 + nameLength + extraLength + commentLength > bytes.length) throw new Error('Truncated Excel archive directory.');
            const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
            offset += 46 + nameLength + extraLength + commentLength;
            expanded += size;
            if ((flags & 1) || expanded > maxExpandedBytes || compressed === 0xFFFFFFFF || size === 0xFFFFFFFF) throw new Error('Encrypted, ZIP64 or oversized workbook is unsupported (100 MB expanded limit).');
            if (entries.has(name)) throw new Error('Duplicate Excel archive paths found.');
            if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034B50) throw new Error('Invalid Excel archive entry.');
            const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
            if (start + compressed > bytes.length) throw new Error('Truncated Excel archive entry.');
            const payload = bytes.slice(start, start + compressed);
            let data;
            if (method === 0) data = payload;
            else if (method === 8) data = await inflate(payload, size);
            else throw new Error('Unsupported Excel compression method. Re-save the workbook as standard XLSX.');
            if (data.length !== size || crc32(data) !== checksum) throw new Error('Excel archive checksum or size is invalid.');
            entries.set(name, data);
        }
        return entries;
    }

    function xml(entries, path, optional = false) {
        const data = entries.get(path);
        if (!data) {
            if (optional) return null;
            throw new Error('Missing Excel workbook component: ' + path);
        }
        const text = decoder.decode(data);
        if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Workbook XML declarations are unsupported.');
        const document = new DOMParser().parseFromString(text, 'application/xml');
        if (document.getElementsByTagName('parsererror').length) throw new Error('Workbook contains invalid XML. Re-save the source as XLSX.');
        return document;
    }

    function elements(node, name) {
        return node ? Array.from(node.getElementsByTagNameNS('*', name)) : [];
    }

    async function open(buffer) {
        const entries = await unzip(buffer);
        const book = xml(entries, 'xl/workbook.xml');
        const relationships = xml(entries, 'xl/_rels/workbook.xml.rels');
        const targets = new Map(elements(relationships, 'Relationship').filter(item => item.getAttribute('TargetMode') !== 'External')
            .map(item => [item.getAttribute('Id'), item.getAttribute('Target')]));
        const sheets = elements(book, 'sheet').map(item => {
            const target = targets.get(item.getAttribute('r:id') || item.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
            if (!target) throw new Error('Invalid or external worksheet relationship.');
            const parts = (target.startsWith('/') ? target.slice(1) : 'xl/' + target).split('/');
            const path = [];
            for (const part of parts) {
                if (part === '..') path.pop();
                else if (part !== '.' && part !== '') path.push(part);
            }
            return { name: item.getAttribute('name'), path: path.join('/') };
        });
        const shared = xml(entries, 'xl/sharedStrings.xml', true);
        const strings = elements(shared, 'si').map(item => elements(item, 't').map(text => text.textContent).join(''));
        const styles = xml(entries, 'xl/styles.xml', true);
        const customFormats = new Map(elements(styles, 'numFmt').map(item => [Number(item.getAttribute('numFmtId')), item.getAttribute('formatCode')]));
        const dateStyles = new Set();
        const cellFormats = elements(styles, 'cellXfs')[0];
        elements(cellFormats, 'xf').forEach((item, index) => {
            const id = Number(item.getAttribute('numFmtId'));
            const format = (customFormats.get(id) || '').replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '');
            const hasDatePart = /[yd]/i.test(format) || (/m/i.test(format) && !/[hs]/i.test(format));
            if ((id >= 14 && id <= 17) || id === 22 || hasDatePart) dateStyles.add(index);
        });
        const property = elements(book, 'workbookPr')[0];
        const date1904 = property && ['1', 'true'].includes(property.getAttribute('date1904'));
        return { entries, sheets, strings, dateStyles, date1904 };
    }

    function columnNumber(reference) {
        const letters = /^([A-Z]+)[1-9]\d*$/.exec(reference || '');
        if (!letters) throw new Error('Worksheet cell has an invalid reference.');
        let number = 0;
        for (const letter of letters[1]) number = number * 26 + letter.charCodeAt(0) - 64;
        if (number > 1024) throw new Error('Maximum supported worksheet width is 1,024 columns.');
        return number - 1;
    }

    function readSheet(workbook, sheetIndex = 0) {
        const sheet = workbook.sheets[sheetIndex];
        if (!sheet) throw new Error('Worksheet not found.');
        const document = xml(workbook.entries, sheet.path);
        const grid = [];
        const seenRows = new Set();
        for (const row of elements(document, 'row')) {
            const rowNumber = Number(row.getAttribute('r'));
            if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > 100001) throw new Error('Worksheet exceeds 100,000 data rows or has invalid row references.');
            if (seenRows.has(rowNumber)) throw new Error('Worksheet contains duplicate row references. Re-save the source workbook.');
            seenRows.add(rowNumber);
            while (grid.length < rowNumber) grid.push([]);
            const seenCells = new Set();
            for (const cell of elements(row, 'c')) {
                const reference = cell.getAttribute('r');
                const column = columnNumber(reference);
                if (seenCells.has(column) || Number(reference.match(/\d+$/)[0]) !== rowNumber) throw new Error('Worksheet contains duplicate or inconsistent cell references.');
                seenCells.add(column);
                const type = cell.getAttribute('t');
                const formula = elements(cell, 'f')[0];
                const content = elements(cell, 'v')[0]?.textContent || '';
                let value = null;
                if (formula) value = { formula: '=' + formula.textContent, cached: content };
                else if (type === 's') {
                    const stringIndex = Number(content);
                    if (!Number.isInteger(stringIndex) || stringIndex < 0 || stringIndex >= workbook.strings.length) throw new Error('Worksheet has an invalid shared-string reference.');
                    value = workbook.strings[stringIndex];
                }
                else if (type === 'inlineStr') value = elements(cell, 't').map(item => item.textContent).join('');
                else if (type === 'b') value = content === '1';
                else if (type === 'd') {
                    const date = new Date(content);
                    value = Number.isFinite(date.getTime()) ? date : content;
                }
                else if (type === 'str' || type === 'e') value = content;
                else if (content !== '') {
                    const number = Number(content);
                    if (workbook.dateStyles.has(Number(cell.getAttribute('s') || 0))) {
                        if (!Number.isFinite(number) || (!workbook.date1904 && Math.floor(number) === 60)) value = 'Invalid Excel date';
                        else {
                            const epoch = workbook.date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
                            const correction = !workbook.date1904 && number < 60 ? 1 : 0;
                            value = new Date(epoch + (Math.floor(number) + correction) * 86400000);
                        }
                    } else value = Number.isFinite(number) ? number : content;
                }
                grid[rowNumber - 1][column] = value;
            }
        }
        const first = grid.shift() || [];
        if (first.some(value => value && typeof value === 'object' && value.formula)) throw new Error('Excel headers must be literal values, not formulas. Paste values in a source copy.');
        const headers = Array.from({ length: first.length }, (_, index) => first[index] === null || first[index] === undefined ? '' : String(first[index]));
        if (!headers.length || headers.some(name => !name.trim())) throw new Error('The first Excel row must contain non-empty column headers.');
        if (new Set(headers).size !== headers.length) throw new Error('Duplicate Excel column headers found.');
        if (!grid.length) throw new Error('Worksheet contains headers but no data.');
        const rows = grid.map(values => {
            if (values.length > headers.length && values.slice(headers.length).some(value => value !== null && value !== undefined)) throw new Error('Worksheet has data beyond its headers.');
            return Object.fromEntries(headers.map((name, index) => [name, values[index] ?? null]));
        });
        return { headers, rows };
    }

    function escapeXML(value) {
        const text = String(value);
        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) throw new Error('XLSX export cannot contain XML control characters. Use CSV or clean the source.');
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    function columnName(number) {
        let name = '';
        while (number > 0) { number--; name = String.fromCharCode(65 + number % 26) + name; number = Math.floor(number / 26); }
        return name;
    }

    function zipStore(files) {
        const localParts = [], centralParts = [];
        let offset = 0, directorySize = 0;
        for (const [filename, text] of Object.entries(files)) {
            const name = encoder.encode(filename), data = encoder.encode(text);
            const checksum = crc32(data);
            const header = new Uint8Array(30 + name.length);
            const view = new DataView(header.buffer);
            view.setUint32(0, 0x04034B50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
            view.setUint16(12, 0x21, true);
            view.setUint32(14, checksum, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true);
            view.setUint16(26, name.length, true); header.set(name, 30);
            localParts.push(header, data);
            const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
            cv.setUint32(0, 0x02014B50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true);
            cv.setUint16(14, 0x21, true);
            cv.setUint32(16, checksum, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
            cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name, 46);
            centralParts.push(central); directorySize += central.length; offset += header.length + data.length;
        }
        if (offset + directorySize > maxExpandedBytes) throw new Error('Excel export is larger than 100 MB. Narrow the filters first.');
        const end = new Uint8Array(22), ev = new DataView(end.buffer);
        ev.setUint32(0, 0x06054B50, true); ev.setUint16(8, centralParts.length, true); ev.setUint16(10, centralParts.length, true);
        ev.setUint32(12, directorySize, true); ev.setUint32(16, offset, true);
        const result = new Uint8Array(offset + directorySize + 22);
        let position = 0;
        for (const part of [...localParts, ...centralParts, end]) { result.set(part, position); position += part.length; }
        return result;
    }

    function write(rows, headers = null) {
        const core = root.FFMCore || (typeof require === 'function' ? require('./dashboard-core.js') : null);
        headers = headers || [...new Set(rows.flatMap(row => Object.keys(row)))];
        if (!headers.length || headers.length > 1024 || rows.length > 100000) throw new Error('Excel export needs 1–1,024 columns and no more than 100,000 rows.');
        const data = [headers, ...rows.map(row => headers.map(name => row[name]))];
        const xmlRows = data.map((values, rowIndex) => '<row r="' + (rowIndex + 1) + '">' + values.map((value, columnIndex) => {
            const reference = columnName(columnIndex + 1) + (rowIndex + 1);
            if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}"><v>${value}</v></c>`;
            return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXML(core.safeText(value))}</t></is></c>`;
        }).join('') + '</row>').join('');
        const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
        const rel = 'http://schemas.openxmlformats.org/package/2006/relationships';
        return zipStore({
            '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
            '_rels/.rels': `<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
            'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Shipments" sheetId="1" r:id="rId1"/></sheets></workbook>`,
            'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
            'xl/worksheets/sheet1.xml': `<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${xmlRows}</sheetData><autoFilter ref="A1:${columnName(headers.length)}${rows.length + 1}"/></worksheet>`,
        });
    }

    const api = { open, readSheet, write, unzip, crc32 };
    root.FFMWorkbook = api;
    if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
