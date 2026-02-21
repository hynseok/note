import prismadb from "@/lib/prismadb";
import { computeDocumentAccess, type CollaboratorPermission } from "@/lib/permission-rules";

type SessionLike = {
    user?: {
        email?: string | null;
    } | null;
} | null;

export interface UserIdentity {
    id: string;
    email: string | null;
}

export interface DocumentAccess {
    exists: boolean;
    isOwner: boolean;
    isParentOwner: boolean;
    collaboratorPermission: CollaboratorPermission;
    canRead: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canManageShare: boolean;
}

export type { CollaboratorPermission };
export { computeDocumentAccess };

export async function getCurrentUserFromSession(session: SessionLike): Promise<UserIdentity | null> {
    const email = session?.user?.email;
    if (!email) return null;

    const user = await prismadb.user.findUnique({
        where: { email },
        select: { id: true, email: true },
    });

    if (!user) return null;
    return user;
}

export async function getDocumentAccess(documentId: string, userId: string): Promise<DocumentAccess> {
    const document = await prismadb.document.findUnique({
        where: { id: documentId },
        select: {
            id: true,
            userId: true,
            parentDocumentId: true,
            collaborators: {
                where: { userId },
                select: { permission: true },
                take: 1,
            },
        },
    });

    if (!document) {
        return {
            exists: false,
            isOwner: false,
            isParentOwner: false,
            collaboratorPermission: null,
            canRead: false,
            canEdit: false,
            canDelete: false,
            canManageShare: false,
        };
    }

    const isOwner = document.userId === userId;
    let isParentOwner = false;

    if (!isOwner && document.parentDocumentId) {
        const parentDoc = await prismadb.document.findUnique({
            where: { id: document.parentDocumentId },
            select: { userId: true },
        });
        isParentOwner = parentDoc?.userId === userId;
    }

    const collaboratorPermission = (document.collaborators[0]?.permission ?? null) as CollaboratorPermission;
    const computed = computeDocumentAccess({
        isOwner,
        isParentOwner,
        collaboratorPermission,
    });

    return {
        exists: true,
        isOwner,
        isParentOwner,
        collaboratorPermission,
        ...computed,
    };
}

export async function canEditDocument(documentId: string, userId: string): Promise<boolean> {
    const access = await getDocumentAccess(documentId, userId);
    return access.canEdit;
}
