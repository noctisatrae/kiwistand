// @format
import { env } from "process";
import { rm } from "fs/promises";

import test from "ava";
import { Wallet, utils } from "ethers";

import * as id from "../src/id.mjs";
import config from "../src/config.mjs";
import * as store from "../src/store.mjs";

test("hashing an extension node", async (t) => {
  env.DATA_DIR = "dbtestA";
  const trieA = await store.create();
  await trieA.put(Buffer.from("0000", "hex"), Buffer.from("A", "utf8"));
  await trieA.put(Buffer.from("0001", "hex"), Buffer.from("B", "utf8"));
  await trieA.put(Buffer.from("0002", "hex"), Buffer.from("C", "utf8"));
  await trieA.put(Buffer.from("0004", "hex"), Buffer.from("D", "utf8"));
  const { stack } = await trieA.findPath(Buffer.from("", "hex"));
  const [node] = stack;
  const digest = store.hash(node);
  t.true(digest instanceof Buffer);
  const expected = Buffer.from(
    "134daeb91d5637da80800d2d1cc5975177e60e83acbbf86d4fc9d2154abc4235",
    "hex"
  );
  t.is(Buffer.compare(digest, expected), 0);

  env.DATA_DIR = "dbtestB";
  const trieB = await store.create();
  await trieB.put(Buffer.from("1234", "hex"), Buffer.from("A", "utf8"));
  await trieB.put(Buffer.from("1234567", "hex"), Buffer.from("B", "utf8"));
  const pathB = await trieB.findPath(Buffer.from("", "hex"));
  const nodeB = pathB.stack[0];
  const digestB = store.hash(nodeB);
  t.true(digestB instanceof Buffer);
  const expectedB = Buffer.from(
    "56913c47f6536846f9f4d93a8da5104631898c028567768895473892cf561c67",
    "hex"
  );
  t.is(Buffer.compare(digestB, expectedB), 0);

  await rm("dbtestA", { recursive: true });
  await rm("dbtestB", { recursive: true });
});

test("efficient trie retrieval of zero-th level", async (t) => {
  env.DATA_DIR = "dbtest";
  const trie = await store.create();
  const level = 0;
  const nodes = await store.descend(trie, level);
  t.is(nodes.length, 1);
  t.true(nodes[0].key instanceof Buffer);
  t.is(nodes[0].key.length, level);
  t.is(nodes[0].level, level);
  await rm(env.DATA_DIR, { recursive: true });
});

test("efficient trie retrieval of first level", async (t) => {
  env.DATA_DIR = "dbtest";
  const trie = await store.create();
  await trie.put(Buffer.from("000000", "hex"), Buffer.from("A", "utf8"));
  await trie.put(Buffer.from("000001", "hex"), Buffer.from("B", "utf8"));
  await trie.put(Buffer.from("000002", "hex"), Buffer.from("C", "utf8"));
  await trie.put(Buffer.from("000004", "hex"), Buffer.from("D", "utf8"));
  const level = 1;
  const nodes = await store.descend(trie, level);
  t.is(nodes.length, 1);
  t.is(Buffer.compare(nodes[0].key, Buffer.from("0000", "hex")), 0);
  t.is(nodes[0].level, level);
  await rm(env.DATA_DIR, { recursive: true });
});

test("efficient trie retrieval of second level", async (t) => {
  env.DATA_DIR = "dbtest";
  const trie = await store.create();
  await trie.put(Buffer.from("000000", "hex"), Buffer.from("A", "utf8"));
  await trie.put(Buffer.from("000001", "hex"), Buffer.from("B", "utf8"));
  await trie.put(Buffer.from("000002", "hex"), Buffer.from("C", "utf8"));
  await trie.put(Buffer.from("000003", "hex"), Buffer.from("D", "utf8"));
  await trie.put(Buffer.from("00000400", "hex"), Buffer.from("E", "utf8"));
  await trie.put(Buffer.from("00000401", "hex"), Buffer.from("F", "utf8"));
  const level = 2;
  const nodes = await store.descend(trie, level);

  t.is(nodes.length, 5);
  t.is(Buffer.compare(nodes[0].key, Buffer.from("000000", "hex")), 0);
  t.is(Buffer.compare(nodes[1].key, Buffer.from("000001", "hex")), 0);
  t.is(Buffer.compare(nodes[2].key, Buffer.from("000002", "hex")), 0);
  t.is(Buffer.compare(nodes[3].key, Buffer.from("000003", "hex")), 0);
  t.is(Buffer.compare(nodes[4].key, Buffer.from("000004", "hex")), 0);
  t.is(nodes[0].level, level);
  t.is(nodes[1].level, level);
  t.is(nodes[2].level, level);
  t.is(nodes[3].level, level);
  t.is(nodes[4].level, level);

  await rm(env.DATA_DIR, { recursive: true });
});

test("efficient trie retrieval of third level", async (t) => {
  env.DATA_DIR = "dbtest";
  const trie = await store.create();
  await trie.put(Buffer.from("000000", "hex"), Buffer.from("A", "utf8"));
  await trie.put(Buffer.from("000001", "hex"), Buffer.from("B", "utf8"));
  await trie.put(Buffer.from("000002", "hex"), Buffer.from("C", "utf8"));
  await trie.put(Buffer.from("000003", "hex"), Buffer.from("D", "utf8"));
  await trie.put(Buffer.from("00000400", "hex"), Buffer.from("E", "utf8"));
  await trie.put(Buffer.from("00000401", "hex"), Buffer.from("F", "utf8"));
  const level = 3;
  const nodes = await store.descend(trie, level);

  t.is(nodes.length, 1);
  t.is(Buffer.compare(nodes[0].key, Buffer.from("000004", "hex")), 0);
  t.is(nodes[0].level, level);

  await rm(env.DATA_DIR, { recursive: true });
});

test("efficient trie retrieval of fourth level", async (t) => {
  env.DATA_DIR = "dbtest";
  const trie = await store.create();
  await trie.put(Buffer.from("000000", "hex"), Buffer.from("A", "utf8"));
  await trie.put(Buffer.from("000001", "hex"), Buffer.from("B", "utf8"));
  await trie.put(Buffer.from("000002", "hex"), Buffer.from("C", "utf8"));
  await trie.put(Buffer.from("000003", "hex"), Buffer.from("D", "utf8"));
  await trie.put(Buffer.from("00000400", "hex"), Buffer.from("E", "utf8"));
  await trie.put(Buffer.from("00000401", "hex"), Buffer.from("F", "utf8"));
  const level = 4;
  const nodes = await store.descend(trie, level);

  t.is(nodes.length, 2);
  t.is(Buffer.compare(nodes[0].key, Buffer.from("00000400", "hex")), 0);
  t.is(Buffer.compare(nodes[1].key, Buffer.from("00000401", "hex")), 0);
  t.is(nodes[0].level, level);
  t.is(nodes[1].level, level);

  await rm(env.DATA_DIR, { recursive: true });
});

test("try to add invalidly formatted message to store", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const text = "hello world";
  const timestamp = 1676559616;
  const message = id.create(text, timestamp);
  message.extra = "bla";
  const signedMessage = await id.sign(signer, message);

  const trie = {
    put: (key, value) => {
      t.fail();
    },
  };
  const libp2p = {
    pubsub: {
      publish: (name, message) => {
        t.fail();
      },
    },
  };
  const allowlist = [address];
  await t.throwsAsync(
    async () => await store.add(trie, signedMessage, libp2p, allowlist),
    {
      instanceOf: Error,
      message: "Wrongly formatted message",
    }
  );
});

test("try to add invalidly signed message to store", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const text = "hello world";
  const timestamp = 1676559616;
  const message = id.create(text, timestamp);
  message.signature = "0xbeef";

  const trie = {
    put: (key, value) => {
      t.fail();
    },
  };
  const libp2p = {
    pubsub: {
      publish: (name, message) => {
        t.fail();
      },
    },
  };
  const allowlist = [address];
  await t.throwsAsync(
    async () => await store.add(trie, message, libp2p, allowlist),
    {
      instanceOf: Error,
      message:
        'invalid signature string (argument="signature", value="0xbeef", code=INVALID_ARGUMENT, version=bytes/5.7.0)',
    }
  );
});

test("trying to add message to store that isn't on allowlist", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const text = "hello world";
  const timestamp = 1676559616;
  const message = id.create(text, timestamp);
  const signedMessage = await id.sign(signer, message);

  const trie = {
    put: (key, value) => {
      t.fail();
    },
  };
  const libp2p = {
    pubsub: {
      publish: (name, message) => {
        t.fail();
      },
    },
  };
  const allowlist = [];
  await t.throwsAsync(
    async () => await store.add(trie, signedMessage, libp2p, allowlist),
    {
      instanceOf: Error,
      message: "Signing address wasn't found in allow list",
    }
  );
});

test("adding message to the store", async (t) => {
  t.plan(5);
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const text = "hello world";
  const timestamp = 1676559616;
  const message = id.create(text, timestamp);
  const signedMessage = await id.sign(signer, message);

  const trie = {
    put: (key, value) => {
      t.truthy(key);
      t.truthy(value);
    },
  };
  const libp2p = {
    pubsub: {
      publish: (name, message) => {
        t.truthy(name);
        t.truthy(message);
      },
    },
  };
  const allowlist = [address];
  await store.add(trie, signedMessage, libp2p, allowlist);
});