import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const currentUser = await prismadb.user.findUnique({
            where: { email: session.user.email }
        });

        if (!currentUser) return new NextResponse("Unauthorized", { status: 401 });

        const sharedDocs = await prismadb.collaborator.findMany({
            where: {
                userId: currentUser.id
            },
            include: {
                document: {
                    include: {
                        childDocuments: {
                            where: { isArchived: false },
                            select: { id: true, title: true, icon: true, userId: true }
                        },
                        parentDocument: {
                            select: { userId: true, id: true }
                        }
                    }
                }
            }
        });

        // Filter out documents where the current user is the owner of the parent document.
        // Reason: If I own the parent, I already see this document in my main hierarchy.
        // It shouldn't appear in "Shared with me" just because I was added as a collaborator (to give me edit rights on a child created by someone else).
        const relevantSharedDocs = sharedDocs.filter(c => {
            const parentOwnerId = c.document.parentDocument?.userId;
            return parentOwnerId !== currentUser.id;
        });

        // Build a hierarchy: only return root-level shared documents
        // (those whose parent is not in the shared set)
        const sharedDocIds = new Set(relevantSharedDocs.map(c => c.document.id));

        // Transform to include hierarchy info and permission
        const documents = relevantSharedDocs.map(c => ({
            ...c.document,
            permission: c.permission,
            // Mark if this is a root in shared context (parent not shared with user)
            isSharedRoot: !c.document.parentDocumentId || !sharedDocIds.has(c.document.parentDocumentId)
        }));

        // Return only root-level shared docs for sidebar display
        // Child docs will be accessible via parent's childDocuments
        const rootDocs = documents.filter(d => d.isSharedRoot);

        return NextResponse.json(rootDocs);
    } catch (error) {
        console.log("[SHARED_DOCS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
