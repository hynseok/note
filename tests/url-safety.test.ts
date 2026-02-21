import test from "node:test";
import assert from "node:assert/strict";
import { isBlockedHostname, isPrivateOrLocalAddress } from "../lib/url-safety.ts";

test("blocks localhost style hostnames", () => {
    assert.equal(isBlockedHostname("localhost"), true);
    assert.equal(isBlockedHostname("api.localhost"), true);
    assert.equal(isBlockedHostname("internal.local"), true);
    assert.equal(isBlockedHostname("example.com"), false);
});

test("detects private/local IPv4 ranges", () => {
    assert.equal(isPrivateOrLocalAddress("127.0.0.1"), true);
    assert.equal(isPrivateOrLocalAddress("10.0.0.3"), true);
    assert.equal(isPrivateOrLocalAddress("192.168.1.2"), true);
    assert.equal(isPrivateOrLocalAddress("8.8.8.8"), false);
});

test("detects private/local IPv6 ranges", () => {
    assert.equal(isPrivateOrLocalAddress("::1"), true);
    assert.equal(isPrivateOrLocalAddress("fe80::1"), true);
    assert.equal(isPrivateOrLocalAddress("fd00::abcd"), true);
    assert.equal(isPrivateOrLocalAddress("2606:4700:4700::1111"), false);
});
