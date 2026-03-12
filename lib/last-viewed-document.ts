import prismadb from "@/lib/prismadb";
import { getDocumentAccess } from "@/lib/permissions";

export const LAST_VIEWED_DOCUMENT_COOKIE = "privatenote_last_document";
const LAST_VIEWED_DOCUMENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type SessionLike = {
    user?: {
        email?: string | null;
    } | null;
} | null;

export function persistLastViewedDocument(documentId: string) {
    if (typeof document === "undefined" || !documentId) {
        return;
    }

    document.cookie =
        `${LAST_VIEWED_DOCUMENT_COOKIE}=${encodeURIComponent(documentId)}; ` +
        `Path=/; Max-Age=${LAST_VIEWED_DOCUMENT_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export async function resolveLastViewedDocumentPath(
    documentId: string | undefined,
    session: SessionLike
): Promise<string | null> {
    if (!documentId) {
        return null;
    }

    const existingDocument = await prismadb.document.findUnique({
        where: { id: documentId },
        select: {
            id: true,
            isArchived: true,
            isPublished: true,
            userId: true,
        },
    });

    if (!existingDocument || existingDocument.isArchived) {
        return null;
    }

    const email = session?.user?.email;
    if (!email) {
        return null;
    }

    const user = await prismadb.user.findUnique({
        where: { email },
        select: { id: true },
    });

    if (!user) {
        return null;
    }

    const access = await getDocumentAccess(documentId, user.id);
    if (!access.exists || !access.canRead) {
        return null;
    }

    return `/documents/${documentId}`;
}
