#!/usr/bin/env node
// cspell:ignore CRC IDAT IHDR IEND PLTE Idat Ihdr Iend Plte idat iend

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
const maxPngChunkLength = 0x7fffffff;
const pngChunkCrcTable = new Uint32Array(256);
const pngCriticalChunkTypes = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);
const pngChunkTypePattern = /^[A-Za-z][A-Za-z][A-Z][A-Za-z]$/;

for (let index = 0; index < pngChunkCrcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  pngChunkCrcTable[index] = value >>> 0;
}

const pngBitDepthsByColorType = new Map([
  [0, new Set([1, 2, 4, 8, 16])],
  [2, new Set([8, 16])],
  [3, new Set([1, 2, 4, 8])],
  [4, new Set([8, 16])],
  [6, new Set([8, 16])],
]);

export const androidScreenshotSpec = Object.freeze({
  count: 5,
  height: 1920,
  width: 1080,
});

export const createFailureCollector = () => {
  const failures = [];
  const assert = (condition, message) => {
    if (!condition) {
      failures.push(message);
    }
  };
  return { assert, failures };
};
const emptyImage = (exists = false) => ({
  colorType: null,
  exists,
  hasAlpha: "unknown",
  height: 0,
  isPng: false,
  width: 0,
});

const crc32 = (buffer, start, end) => {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc = pngChunkCrcTable[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const invalidPng = (buffer) => ({
  ...emptyImage(true),
  buffer,
});

const hasPngSignature = (buffer) =>
  buffer.length >= pngSignature.length && buffer.subarray(0, 8).equals(pngSignature);

const isSupportedChunkType = (chunkType) =>
  chunkType[0] === chunkType[0].toLowerCase() || pngCriticalChunkTypes.has(chunkType);

const hasValidPngChunkType = (chunkType) =>
  pngChunkTypePattern.test(chunkType) && isSupportedChunkType(chunkType);

const hasPngChunkLength = (buffer, offset, length) =>
  length <= maxPngChunkLength && length <= buffer.length - offset - 12;

const readPngChunkHeader = (buffer, offset) => {
  if (buffer.length - offset < 12) {
    return null;
  }

  const length = buffer.readUInt32BE(offset);
  if (!hasPngChunkLength(buffer, offset, length)) {
    return null;
  }

  const typeOffset = offset + 4;
  const type = buffer.toString("latin1", typeOffset, typeOffset + 4);
  if (!hasValidPngChunkType(type)) {
    return null;
  }

  const dataOffset = offset + 8;
  const crcOffset = dataOffset + length;
  return {
    length,
    crcOffset,
    dataOffset,
    typeOffset,
    type,
  };
};

const hasValidPngChunkCrc = (buffer, chunk) =>
  buffer.readUInt32BE(chunk.crcOffset) === crc32(buffer, chunk.typeOffset, chunk.crcOffset);

const readPngChunk = (buffer, offset) => {
  const header = readPngChunkHeader(buffer, offset);
  if (!header || !hasValidPngChunkCrc(buffer, header)) {
    return null;
  }
  return {
    data: buffer.subarray(header.dataOffset, header.crcOffset),
    end: header.crcOffset + 4,
    length: header.length,
    type: header.type,
  };
};

const createPngState = () => ({
  colorType: null,
  hasTransparency: false,
  height: 0,
  sawIdat: false,
  sawIend: false,
  sawIhdr: false,
  sawPlte: false,
  width: 0,
});

const hasValidPngDimension = (dimension) => dimension > 0 && dimension <= maxPngChunkLength;

const hasValidPngDimensions = (width, height) =>
  [width, height].every(hasValidPngDimension);

const hasValidPngMethods = (compressionMethod, filterMethod, interlaceMethod) =>
  compressionMethod === 0 && filterMethod === 0 && interlaceMethod <= 1;

const hasValidPngBitDepth = (colorType, bitDepth) => {
  const bitDepths = pngBitDepthsByColorType.get(colorType);
  return bitDepths ? bitDepths.has(bitDepth) : false;
};

const hasValidPngIhdr = (width, height, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod) =>
  hasValidPngDimensions(width, height) &&
  hasValidPngBitDepth(colorType, bitDepth) &&
  hasValidPngMethods(compressionMethod, filterMethod, interlaceMethod);

const readIhdrMetadata = (chunk) => {
  if (chunk.length !== 13) {
    return null;
  }

  const width = chunk.data.readUInt32BE(0);
  const height = chunk.data.readUInt32BE(4);
  const bitDepth = chunk.data[8];
  const colorType = chunk.data[9];
  const compressionMethod = chunk.data[10];
  const filterMethod = chunk.data[11];
  const interlaceMethod = chunk.data[12];
  if (!hasValidPngIhdr(width, height, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod)) {
    return null;
  }

  return { colorType, height, width };
};

const applyIhdrChunk = (chunk, state) => {
  if (state.sawIhdr) {
    return false;
  }
  const metadata = readIhdrMetadata(chunk);
  if (!metadata) {
    return false;
  }
  Object.assign(state, metadata, { sawIhdr: true });
  return true;
};

const applyPlteChunk = (chunk, state) => {
  if (!hasValidPngPalette(chunk, state)) {
    return false;
  }
  state.sawPlte = true;
  return true;
};

const applyIdatChunk = (chunk, state) => {
  if (chunk.length === 0) {
    return false;
  }
  state.sawIdat = true;
  return true;
};

const applyIendChunk = (chunk, state) => {
  if (chunk.length !== 0) {
    return false;
  }
  if (!hasCompletePngImageData(state)) {
    return false;
  }
  state.sawIend = true;
  return true;
};

const pngChunkHandlers = new Map([
  ["IHDR", applyIhdrChunk],
  ["PLTE", applyPlteChunk],
  ["IDAT", applyIdatChunk],
  ["IEND", applyIendChunk],
  ["tRNS", (_chunk, state) => {
    state.hasTransparency = true;
    return true;
  }],
]);

const applyPngChunk = (chunk, state) =>
  pngChunkHandlers.get(chunk.type)?.(chunk, state) ?? true;

const isAllowedPngChunkPosition = (chunk, state) =>
  !state.sawIend && (state.sawIhdr || chunk.type === "IHDR");

const hasCompletePngImageData = (state) =>
  state.sawIdat && (state.colorType !== 3 || state.sawPlte);

const hasValidPngPalette = (chunk, state) =>
  [
    !state.sawPlte,
    !state.sawIdat,
    chunk.length > 0,
    chunk.length % 3 === 0,
    chunk.length <= 768,
  ].every(Boolean);

const isCompletePng = (state) =>
  [state.sawIhdr, hasCompletePngImageData(state), state.sawIend].every(Boolean);

const imageFromPngState = (buffer, state) => ({
  buffer,
  colorType: state.colorType,
  exists: true,
  hasAlpha: state.colorType === 4 || state.colorType === 6 || state.hasTransparency ? "yes" : "no",
  height: state.height,
  isPng: true,
  width: state.width,
});

const hasInvalidPngChunk = (chunk, state) => {
  if (!chunk) {
    return true;
  }
  if (!isAllowedPngChunkPosition(chunk, state)) {
    return true;
  }
  return !applyPngChunk(chunk, state);
};

const parsePngChunks = (buffer, state) => {
  let offset = pngSignature.length;
  while (offset < buffer.length) {
    const chunk = readPngChunk(buffer, offset);
    if (hasInvalidPngChunk(chunk, state)) {
      return false;
    }
    offset = chunk.end;
  }
  return true;
};

const parsePng = (buffer) => {
  if (!hasPngSignature(buffer)) {
    return invalidPng(buffer);
  }

  const state = createPngState();
  if (!parsePngChunks(buffer, state)) {
    return invalidPng(buffer);
  }

  if (!isCompletePng(state)) {
    return invalidPng(buffer);
  }
  return imageFromPngState(buffer, state);
};
const inspectPng = (filePath) => {
  if (!existsSync(filePath)) {
    return emptyImage();
  }

  const buffer = readFileSync(filePath);
  return parsePng(buffer);
};
const listPngFiles = (directory) => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).filter((fileName) => /\.png$/i.test(fileName)).sort();
};
const checkDimensions = (image, label, expectedWidth, expectedHeight) => {
  if (expectedWidth === undefined) {
    return [];
  }
  if (`${image.width}x${image.height}` === `${expectedWidth}x${expectedHeight}`) {
    return [];
  }
  return [`${label} must be ${expectedWidth}x${expectedHeight}; got ${image.width}x${image.height}`];
};
const checkMinimumDimension = (image, label, enabled) => {
  if (!enabled) {
    return [];
  }
  const shortSide = Math.min(image.width, image.height);
  if (shortSide >= 320) {
    return [];
  }
  return [`${label} min dimension must be at least 320px; got ${image.width}x${image.height}`];
};
const checkShortSide = (shortSide, label) => {
  if (shortSide >= 320) {
    return [];
  }
  return [`${label} short side must be at least 320px; got ${shortSide}`];
};
const checkLongSide = (longSide, label) => {
  if (longSide <= 3840) {
    return [];
  }
  return [`${label} long side must be no more than 3840px; got ${longSide}`];
};
const checkAspectRatio = (shortSide, longSide, label) => {
  if (longSide / shortSide <= 2) {
    return [];
  }
  return [`${label} aspect ratio must be 2:1 or less; got ${longSide}:${shortSide}`];
};
const checkPortrait = (image, label) => {
  if (image.height > image.width) {
    return [];
  }
  return [`${label} must be a portrait phone screenshot; got ${image.width}x${image.height}`];
};
const checkPlayLimits = (image, label, enabled) => {
  if (!enabled) {
    return [];
  }
  const shortSide = Math.min(image.width, image.height);
  const longSide = Math.max(image.width, image.height);
  return [
    ...checkShortSide(shortSide, label),
    ...checkLongSide(longSide, label),
    ...checkAspectRatio(shortSide, longSide, label),
    ...checkPortrait(image, label),
  ];
};
const checkRgb = (image, label, required) => {
  if (!required) {
    return [];
  }
  if (image.colorType === 2) {
    return [];
  }
  return [`${label} must use RGB color type; got ${image.colorType}`];
};
const checkOpaque = (image, label, required) => {
  if (!required) {
    return [];
  }
  if (image.hasAlpha === "no") {
    return [];
  }
  return [`${label} must be opaque; got hasAlpha=${image.hasAlpha}`];
};
const checkEncoding = (image, label, requireRgb, requireOpaque) => [
  ...checkRgb(image, label, requireRgb),
  ...checkOpaque(image, label, requireOpaque),
];

const checkValidPng = (image, label) => {
  if (!image.exists) {
    return [`${label} must exist`];
  }
  if (!image.isPng) {
    return [`${label} must be a PNG`];
  }
  return [];
};
export const validatePngFile = ({
  filePath,
  label,
  expectedHeight,
  expectedWidth,
  minDimension = false,
  playLimits = false,
  requireOpaque = false,
  requireRgb = false,
}) => {
  const image = inspectPng(filePath);
  const validityFailures = checkValidPng(image, label);
  if (validityFailures.length > 0) {
    return { failures: validityFailures, image };
  }

  const failures = [
    ...checkDimensions(image, label, expectedWidth, expectedHeight),
    ...checkMinimumDimension(image, label, minDimension),
    ...checkPlayLimits(image, label, playLimits),
    ...checkEncoding(image, label, requireRgb, requireOpaque),
  ];
  return { failures, image };
};
const checkDirectoryCount = (files, expectedCount, label, screenshotLabel) => {
  if (expectedCount === undefined) {
    return [];
  }
  if (files.length === expectedCount) {
    return [];
  }
  return [`${label} must include exactly ${expectedCount} ${screenshotLabel}; got ${files.length}`];
};
const validateDirectoryFiles = ({
  directory,
  expectedHeight,
  expectedWidth,
  fileLabelPrefix,
  files,
  label,
  minDimension,
  playLimits,
  requireOpaque,
  requireRgb,
}) => {
  const failures = [];
  for (const fileName of files) {
    const result = validatePngFile({
      filePath: join(directory, fileName),
      expectedHeight,
      expectedWidth,
      label: fileLabelPrefix ? `${fileLabelPrefix}${fileName}` : `${label} ${fileName}`,
      minDimension,
      playLimits,
      requireOpaque,
      requireRgb,
    });
    failures.push(...result.failures);
  }
  return failures;
};
export const validatePngDirectory = ({
  directory,
  expectedCount,
  expectedHeight,
  expectedWidth,
  directoryLabel,
  fileLabelPrefix,
  label,
  minDimension = false,
  playLimits = false,
  requireDirectory = false,
  requireOpaque = false,
  requireRgb = false,
  screenshotLabel = "phone screenshots",
}) => {
  if (!existsSync(directory)) {
    const missingDirectoryFailures = requireDirectory
      ? [`${directoryLabel ?? `${label} phone screenshots`} directory must exist`]
      : [];
    return { failures: missingDirectoryFailures, files: [] };
  }

  const files = listPngFiles(directory);
  return {
    failures: [
      ...checkDirectoryCount(files, expectedCount, label, screenshotLabel),
      ...validateDirectoryFiles({
        directory,
        expectedHeight,
        expectedWidth,
        fileLabelPrefix,
        files,
        label,
        minDimension,
        playLimits,
        requireOpaque,
        requireRgb,
      }),
    ],
    files,
  };
};
const comparePngFile = (leftDirectory, rightDirectory, fileName, leftLabel, rightLabel) => {
  const leftPath = join(leftDirectory, fileName);
  const rightPath = join(rightDirectory, fileName);
  if (!existsSync(rightPath)) {
    return [];
  }
  if (readFileSync(leftPath).equals(readFileSync(rightPath))) {
    return [];
  }
  return [`${leftLabel} and ${rightLabel} ${fileName} must be byte-identical`];
};
const comparePngNames = (leftFiles, rightFiles, leftLabel, rightLabel) => {
  if (leftFiles.join("\n") === rightFiles.join("\n")) {
    return [];
  }
  return [`${leftLabel} and ${rightLabel} phone screenshot filenames must stay mirrored`];
};
export const comparePngDirectories = ({
  leftDirectory,
  leftLabel,
  rightDirectory,
  rightLabel,
}) => {
  const leftFiles = listPngFiles(leftDirectory);
  const rightFiles = listPngFiles(rightDirectory);
  return [
    ...comparePngNames(leftFiles, rightFiles, leftLabel, rightLabel),
    ...leftFiles.flatMap((fileName) => comparePngFile(leftDirectory, rightDirectory, fileName, leftLabel, rightLabel)),
  ];
};
