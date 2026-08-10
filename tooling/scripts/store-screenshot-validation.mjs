#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");

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

const hasPngChunk = (buffer, chunkType) => {
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkEnd > buffer.length) {
      return false;
    }
    if (buffer.subarray(offset + 4, offset + 8).toString("ascii") === chunkType) {
      return true;
    }
    offset = chunkEnd;
  }
  return false;
};
const isPng = (buffer) => buffer.length >= 26 && buffer.subarray(0, 8).equals(pngSignature);

const imageFromPng = (buffer) => {
  const colorType = buffer[25];
  const hasAlpha = colorType === 4 || colorType === 6 || hasPngChunk(buffer, "tRNS") ? "yes" : "no";
  return {
    buffer,
    colorType,
    exists: true,
    hasAlpha,
    height: buffer.readUInt32BE(20),
    isPng: true,
    width: buffer.readUInt32BE(16),
  };
};
const inspectPng = (filePath) => {
  if (!existsSync(filePath)) {
    return emptyImage();
  }

  const buffer = readFileSync(filePath);
  return isPng(buffer) ? imageFromPng(buffer) : { ...emptyImage(true), buffer };
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
