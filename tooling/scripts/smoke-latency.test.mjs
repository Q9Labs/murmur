import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";

import { collectResult, sessionCookieHeader } from "./smoke-latency.mjs";

test("sessionCookieHeader carries every Better Auth cookie without attributes", () => {
  const headers = new Headers();
  headers.getSetCookie = () => [
    "murmur.session_token=secret-token; Path=/; HttpOnly; Secure",
    "murmur.session_data=opaque; Path=/; HttpOnly; Secure",
  ];

  assert.equal(
    sessionCookieHeader(headers),
    "murmur.session_token=secret-token; murmur.session_data=opaque",
  );
});

test("sessionCookieHeader rejects an authentication response without a cookie", () => {
  assert.throws(() => sessionCookieHeader(new Headers()), /anonymous_sign_in_cookie_missing/);
});

test("collectResult drains a pending Blob byte length before session_closed", async () => {
  const socket = new FakeSocket();
  let releaseAudio;
  const audio = new Blob([new Uint8Array(4_096)]);
  const readAudio = audio.arrayBuffer.bind(audio);
  audio.arrayBuffer = () => new Promise((resolve) => {
    releaseAudio = () => {
      void readAudio().then(resolve);
    };
  });
  const resultPromise = collectResult(socket);
  socket.dispatch("message", { data: audio });
  socket.dispatch("message", { data: JSON.stringify({ kind: "session_closed" }) });

  let resultSettled = false;
  resultPromise.then(() => {
    resultSettled = true;
  });
  await nextTurn();
  assert.equal(typeof releaseAudio, "function");
  assert.equal(resultSettled, false);

  releaseAudio();
  const result = await resultPromise;
  assert.equal(result.audioBytes, 4_096);
  assert.equal(result.audioChunks, 1);
  assert.deepEqual(socket.closeArgs, [1000, "smoke_done"]);
});

class FakeSocket {
  #listeners = new Map();

  closeArgs = null;

  addEventListener(type, listener) {
    const listeners = this.#listeners.get(type) ?? [];
    listeners.push(listener);
    this.#listeners.set(type, listeners);
  }

  dispatch(type, event) {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }

  close(...args) {
    this.closeArgs = args;
  }
}
