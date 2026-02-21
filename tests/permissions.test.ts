import test from "node:test";
import assert from "node:assert/strict";
import { computeDocumentAccess } from "../lib/permission-rules.ts";

test("owner has full permissions", () => {
    const access = computeDocumentAccess({
        isOwner: true,
        isParentOwner: false,
        collaboratorPermission: null,
    });

    assert.equal(access.canRead, true);
    assert.equal(access.canEdit, true);
    assert.equal(access.canDelete, true);
    assert.equal(access.canManageShare, true);
});

test("edit collaborator can read/edit but cannot delete or manage sharing", () => {
    const access = computeDocumentAccess({
        isOwner: false,
        isParentOwner: false,
        collaboratorPermission: "EDIT",
    });

    assert.equal(access.canRead, true);
    assert.equal(access.canEdit, true);
    assert.equal(access.canDelete, false);
    assert.equal(access.canManageShare, false);
});

test("read collaborator is read-only", () => {
    const access = computeDocumentAccess({
        isOwner: false,
        isParentOwner: false,
        collaboratorPermission: "READ",
    });

    assert.equal(access.canRead, true);
    assert.equal(access.canEdit, false);
    assert.equal(access.canDelete, false);
    assert.equal(access.canManageShare, false);
});

test("parent owner has edit/delete but cannot manage sharing", () => {
    const access = computeDocumentAccess({
        isOwner: false,
        isParentOwner: true,
        collaboratorPermission: null,
    });

    assert.equal(access.canRead, true);
    assert.equal(access.canEdit, true);
    assert.equal(access.canDelete, true);
    assert.equal(access.canManageShare, false);
});
