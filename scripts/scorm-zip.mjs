import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

const crc32 = (buffer) => {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};

export async function writeZip(filename, entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const content = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const crc = crc32(content);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(content.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    local.push(header, nameBytes, content);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(content.length, 20);
    directory.writeUInt32LE(content.length, 24);
    directory.writeUInt16LE(nameBytes.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, nameBytes);
    offset += header.length + nameBytes.length + content.length;
  }
  const centralSize = central.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, Buffer.concat([...local, ...central, end]));
}

export async function extractZip(filename, destination) {
  const archive = await readFile(filename);
  const extracted = [];
  let offset = 0;
  while (offset + 4 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const method = archive.readUInt16LE(offset + 8);
    const size = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const name = archive.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    if (method !== 0 || !name || name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")) throw new Error(`Unsafe or unsupported ZIP member: ${name}`);
    const start = offset + 30 + nameLength + extraLength;
    const content = archive.subarray(start, start + size);
    if (content.length !== size || crc32(content) !== archive.readUInt32LE(offset + 14)) throw new Error(`Invalid ZIP member: ${name}`);
    const target = path.join(destination, ...name.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
    extracted.push(name);
    offset = start + size;
  }
  if (archive.readUInt32LE(offset) !== 0x02014b50) throw new Error("ZIP central directory is missing");
  return extracted;
}
