// cspell:ignore CRC IDAT IHDR IEND idat iend

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { validatePngFile } from "./store-screenshot-validation.mjs";

const fixtureRoot = mkdtempSync(join(tmpdir(), "murmur-png-validation-"));
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.after(() => {
  rmSync(fixtureRoot, { force: true, recursive: true });
});

const writeFixture = (name, buffer) => {
  const filePath = join(fixtureRoot, name);
  writeFileSync(filePath, buffer);
  return filePath;
};

const validateFixture = (name, buffer) =>
  validatePngFile({
    filePath: writeFixture(name, buffer),
    label: name,
  });

test("validates PNG chunks and reads the IHDR metadata", () => {
  const result = validateFixture("valid.png", validPng);

  assert.deepEqual(result.failures, []);
  assert.equal(result.image.isPng, true);
  assert.equal(result.image.width, 1);
  assert.equal(result.image.height, 1);
  assert.equal(result.image.colorType, 4);
  assert.equal(result.image.hasAlpha, "yes");
});

test("rejects a truncated PNG even when its fixed IHDR offsets are readable", () => {
  const truncated = validPng.subarray(0, 26);
  const result = validateFixture("truncated.png", truncated);

  assert.equal(result.image.isPng, false);
  assert.match(result.failures[0], /truncated\.png must be a PNG/);
});

test("rejects a PNG with a corrupt chunk CRC", () => {
  const corrupt = Buffer.from(validPng);
  const idatTypeOffset = corrupt.indexOf("IDAT", 8, "ascii");
  assert.notEqual(idatTypeOffset, -1);
  corrupt[idatTypeOffset + 4] ^= 0xff;

  const result = validateFixture("corrupt-crc.png", corrupt);

  assert.equal(result.image.isPng, false);
  assert.match(result.failures[0], /corrupt-crc\.png must be a PNG/);
});

test("rejects a complete chunk stream with no IEND", () => {
  const withoutIend = validPng.subarray(0, -12);
  const result = validateFixture("missing-iend.png", withoutIend);

  assert.equal(result.image.isPng, false);
  assert.match(result.failures[0], /missing-iend\.png must be a PNG/);
});
