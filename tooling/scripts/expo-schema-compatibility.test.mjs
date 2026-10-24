import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const mobileRequire = createRequire(new URL("../../apps/mobile/package.json", import.meta.url));
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const cliRequire = createRequire(expoRequire.resolve("@expo/cli/package.json"));
const { PluginSchema, DevToolsPluginOutputSchema } = cliRequire("./build/src/start/server/DevToolsPlugin.schema.js");
const { createMCPDevToolsExtensionSchema } = cliRequire("./build/src/start/server/createMCPDevToolsExtensionSchema.js");

const plugin = {
  packageName: "fixture-plugin",
  packageRoot: "/tmp/fixture-plugin",
  cliExtensions: {
    description: "Local fixture commands",
    entryPoint: "cli.js",
    commands: [{
      name: "inspect",
      title: "Inspect a fixture",
      environments: ["cli", "mcp"],
      parameters: [
        { name: "label", type: "text" },
        { name: "count", type: "number" },
        { name: "enabled", type: "confirm" },
      ],
    }],
  },
};

test("Expo CLI accepts valid plugin descriptors and rejects malformed descriptors with patched Zod", () => {
  assert.deepEqual(PluginSchema.parse(plugin), plugin);
  assert.equal(PluginSchema.safeParse({ ...plugin, packageName: "" }).success, false);
  assert.equal(PluginSchema.safeParse({ ...plugin, packageRoot: 1 }).success, false);
  assert.equal(PluginSchema.safeParse({ ...plugin, cliExtensions: { ...plugin.cliExtensions, commands: [] } }).success, false);
  assert.equal(PluginSchema.safeParse({ ...plugin, cliExtensions: {
    ...plugin.cliExtensions, commands: [{ ...plugin.cliExtensions.commands[0], environments: ["unknown"] }],
  } }).success, false);
});

test("Expo CLI retains command enums, optional typed arguments and strict unknown-field rejection", () => {
  const schema = createMCPDevToolsExtensionSchema(PluginSchema.parse(plugin));
  const input = { command: "inspect", label: "fixture", count: 2, enabled: true };
  assert.deepEqual(schema.parse(input), input);
  assert.deepEqual(schema.parse({ command: "inspect" }), { command: "inspect" });
  for (const invalid of [
    { command: "unknown" }, { ...input, count: "2" }, { ...input, enabled: "yes" },
    { ...input, label: 2 }, { ...input, extra: "not allowed" },
  ]) {
    const result = schema.safeParse(invalid);
    assert.equal(result.success, false);
    assert.ok(result.error.issues.every((issue) => typeof issue.message === "string"));
  }
  assert.throws(() => createMCPDevToolsExtensionSchema({ ...plugin, cliExtensions: undefined }));
});

test("Expo CLI validates text, image and audio output without accepting invalid URLs or levels", () => {
  const output = [
    { type: "text", text: "Fixture output", level: "info" },
    { type: "image", url: "https://example.test/image.png" },
    { type: "audio", url: "https://example.test/audio.wav", text: "Fixture audio" },
  ];
  assert.deepEqual(DevToolsPluginOutputSchema.parse(output), output);
  for (const invalid of [
    [{ type: "image", url: "not a URL" }],
    [{ type: "audio", url: 4 }],
    [{ type: "text", text: "Fixture", level: "unknown" }],
    [{ type: "unknown" }],
  ]) assert.equal(DevToolsPluginOutputSchema.safeParse(invalid).success, false);
});
