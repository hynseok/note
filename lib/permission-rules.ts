export type CollaboratorPermission = "READ" | "EDIT" | null;

interface PermissionFlagsInput {
    isOwner: boolean;
    isParentOwner: boolean;
    collaboratorPermission: CollaboratorPermission;
}

export function computeDocumentAccess(flags: PermissionFlagsInput) {
    const canRead = flags.isOwner || flags.isParentOwner || flags.collaboratorPermission !== null;
    const canEdit = flags.isOwner || flags.isParentOwner || flags.collaboratorPermission === "EDIT";
    const canDelete = flags.isOwner || flags.isParentOwner;
    const canManageShare = flags.isOwner;

    return {
        canRead,
        canEdit,
        canDelete,
        canManageShare,
    };
}
