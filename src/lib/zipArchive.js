const ZIP_EPOCH = new Date('1980-01-01T00:00:00Z');
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    crcTable[i] = value >>> 0;
  }
  return crcTable;
}

function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date = new Date()) {
  const safeDate = date < ZIP_EPOCH ? ZIP_EPOCH : date;
  const year = safeDate.getFullYear();
  const dosTime = (safeDate.getHours() << 11)
    | (safeDate.getMinutes() << 5)
    | Math.floor(safeDate.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9)
    | ((safeDate.getMonth() + 1) << 5)
    | safeDate.getDate();
  return { dosDate, dosTime };
}

function writeUint16(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes, offset) {
  return (bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0;
}

function concatBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function normalizeEntryName(name) {
  return String(name || 'entry')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');
}

function normalizeContent(content) {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (typeof content === 'string') return textEncoder.encode(content);
  throw new TypeError('ZIP entry content must be a string, Uint8Array, or ArrayBuffer.');
}

export function createZipArchive(entries, date = new Date()) {
  const fileParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosDate, dosTime } = toDosDateTime(date);

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(normalizeEntryName(entry.name));
    const data = normalizeContent(entry.content);
    const checksum = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0x0800);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, dosTime);
    writeUint16(localHeader, 12, dosDate);
    writeUint32(localHeader, 14, checksum);
    writeUint32(localHeader, 18, data.length);
    writeUint32(localHeader, 22, data.length);
    writeUint16(localHeader, 26, nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);
    fileParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0x0800);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, dosTime);
    writeUint16(centralHeader, 14, dosDate);
    writeUint32(centralHeader, 16, checksum);
    writeUint32(centralHeader, 20, data.length);
    writeUint32(centralHeader, 24, data.length);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endRecord = new Uint8Array(22);
  writeUint32(endRecord, 0, 0x06054b50);
  writeUint16(endRecord, 4, 0);
  writeUint16(endRecord, 6, 0);
  writeUint16(endRecord, 8, entries.length);
  writeUint16(endRecord, 10, entries.length);
  writeUint32(endRecord, 12, centralDirectory.length);
  writeUint32(endRecord, 16, offset);
  writeUint16(endRecord, 20, 0);

  return concatBytes([...fileParts, centralDirectory, endRecord]);
}

export function createZipBlob(entries, date = new Date()) {
  return new Blob([createZipArchive(entries, date)], { type: 'application/zip' });
}

export function readStoredZipEntries(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const entries = [];
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = readUint32(bytes, offset);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) {
      throw new Error('Invalid ZIP archive.');
    }

    const flags = readUint16(bytes, offset + 6);
    const method = readUint16(bytes, offset + 8);
    const storedChecksum = readUint32(bytes, offset + 14);
    const compressedSize = readUint32(bytes, offset + 18);
    const uncompressedSize = readUint32(bytes, offset + 22);
    const nameLength = readUint16(bytes, offset + 26);
    const extraLength = readUint16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (flags & 0x0008) {
      throw new Error('ZIP data descriptors are not supported.');
    }
    if (method !== 0) {
      throw new Error('Only stored ZIP entries are supported.');
    }
    if (dataEnd > bytes.length || compressedSize !== uncompressedSize) {
      throw new Error('Invalid ZIP entry size.');
    }

    const name = textDecoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    const content = bytes.slice(dataStart, dataEnd);
    if (crc32(content) !== storedChecksum) {
      throw new Error(`ZIP checksum mismatch for ${name}.`);
    }
    entries.push({ name: normalizeEntryName(name), content });
    offset = dataEnd;
  }

  if (!entries.length) throw new Error('ZIP archive did not contain readable files.');
  return entries;
}
