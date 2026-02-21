import test from "node:test";
import assert from "node:assert/strict";
import {
    normalizeIncomingSyncEvent,
    normalizeOutgoingSyncEvent,
    hasAuthoritativeDocumentVersion,
} from "../lib/sync-events.ts";

test("normalizeOutgoingSyncEvent defaults to DOCUMENT_UPDATE", () => {
    const event = normalizeOutgoingSyncEvent({
        documentId: "doc-1",
        changes: { title: "A" },
        documentVersion: 10,
    });

    assert.equal(event.eventType, "DOCUMENT_UPDATE");
    assert.equal(event.documentVersion, 10);
});

test("normalizeOutgoingSyncEvent drops version on DOCUMENT_STRUCTURE", () => {
    const event = normalizeOutgoingSyncEvent({
        documentId: "doc-1",
        changes: { childCreated: true },
        eventType: "DOCUMENT_STRUCTURE",
        documentVersion: 99,
    });

    assert.equal(event.eventType, "DOCUMENT_STRUCTURE");
    assert.equal(event.documentVersion, undefined);
});

test("normalizeIncomingSyncEvent maps legacy version field to documentVersion", () => {
    const event = normalizeIncomingSyncEvent({
        documentId: "doc-1",
        changes: { content: "x" },
        version: 42,
    });

    assert.equal(event.eventType, "DOCUMENT_UPDATE");
    assert.equal(event.documentVersion, 42);
    assert.equal(hasAuthoritativeDocumentVersion(event), true);
});

test("structure events are never treated as authoritative document versions", () => {
    const event = normalizeIncomingSyncEvent({
        documentId: "doc-1",
        changes: { childUpdated: true },
        eventType: "DOCUMENT_STRUCTURE",
        version: 1234,
    });

    assert.equal(event.documentVersion, undefined);
    assert.equal(hasAuthoritativeDocumentVersion(event), false);
});
