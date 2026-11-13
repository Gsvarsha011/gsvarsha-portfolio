// Locks a piece of a page with a password, for tools/make-cases.py.
// Reads {"password": "...", "text": "..."} as JSON on stdin and prints
// {"salt", "iv", "data"} (base64): the text encrypted with AES-GCM under a
// key made from the password with PBKDF2 (SHA-256). js/private.js does the
// same in the browser to open it, so the two must agree on ITERATIONS.
import { webcrypto as crypto } from "node:crypto";

const ITERATIONS = 310000;
const b64 = (buf) => Buffer.from(buf).toString("base64");

let input = "";
for await (const chunk of process.stdin) input += chunk;
const { password, text } = JSON.parse(input);

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
  base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));

process.stdout.write(JSON.stringify({ salt: b64(salt), iv: b64(iv), data: b64(data) }));
