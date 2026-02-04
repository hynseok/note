import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";

export async function GET(
    req: Request,
    props: { params: Promise<{ documentId: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

        // Check if user has access (Owner or Collaborator)
        // Actually, only owner should manage sharing? Or editors too? Let's say Owner only for now for managing.
        // But to VIEW the list, maybe editors too.

        const document = await prismadb.document.findUnique({
            where: { id: params.documentId },
            include: { user: true }
        });

        if (!document) return new NextResponse("Not found", { status: 404 });

        // Check ownership or existing collaboration
        const currentUser = await prismadb.user.findUnique({ where: { email: session.user.email } });
        if (!currentUser) return new NextResponse("Unauthorized", { status: 401 });

        if (document.userId !== currentUser.id) {
            // If not owner, check if collaborator
            const isCollab = await prismadb.collaborator.findUnique({
                where: {
                    documentId_userId: {
                        documentId: params.documentId,
                        userId: currentUser.id
                    }
                }
            });
            if (!isCollab) return new NextResponse("Unauthorized", { status: 401 });
        }

        const collaborators = await prismadb.collaborator.findMany({
            where: { documentId: params.documentId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true
                    }
                }
            }
        });

        return NextResponse.json({
            isOwner: document.userId === currentUser.id,
            owner: {
                id: document.user.id,
                name: document.user.name,
                email: document.user.email,
                image: document.user.image,
            },
            collaborators
        });

    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(
    req: Request,
    props: { params: Promise<{ documentId: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        const { userId, permission } = await req.json();

        if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

        const document = await prismadb.document.findUnique({
            where: { id: params.documentId }
        });

        if (!document) return new NextResponse("Not found", { status: 404 });

        const currentUser = await prismadb.user.findUnique({ where: { email: session.user.email } });
        if (!currentUser || document.userId !== currentUser.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Get all descendant document IDs recursively
        async function getDescendantIds(parentId: string): Promise<string[]> {
            const children = await prismadb.document.findMany({
                where: {
                    parentDocumentId: parentId,
                    isArchived: false
                },
                select: { id: true }
            });

            const childIds = children.map(c => c.id);
            const descendantIds: string[] = [];

            for (const childId of childIds) {
                descendantIds.push(childId);
                const grandchildren = await getDescendantIds(childId);
                descendantIds.push(...grandchildren);
            }

            return descendantIds;
        }

        // Get all document IDs to share (parent + all descendants)
        const allDocumentIds = [params.documentId, ...await getDescendantIds(params.documentId)];

        // Share all documents with the collaborator
        const results = await Promise.all(
            allDocumentIds.map(async (docId) => {
                const existing = await prismadb.collaborator.findUnique({
                    where: {
                        documentId_userId: {
                            documentId: docId,
                            userId
                        }
                    }
                });

                if (existing) {
                    return prismadb.collaborator.update({
                        where: {
                            documentId_userId: {
                                documentId: docId,
                                userId
                            }
                        },
                        data: {
                            permission: permission || existing.permission
                        }
                    });
                } else {
                    return prismadb.collaborator.create({
                        data: {
                            documentId: docId,
                            userId,
                            permission: permission || "READ"
                        }
                    });
                }
            })
        );

        return NextResponse.json({
            shared: results.length,
            collaborator: results[0]
        });

    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    props: { params: Promise<{ documentId: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");

        if (!session?.user?.email || !userId) return new NextResponse("Unauthorized", { status: 401 });

        const document = await prismadb.document.findUnique({
            where: { id: params.documentId }
        });

        if (!document) return new NextResponse("Not found", { status: 404 });

        const currentUser = await prismadb.user.findUnique({ where: { email: session.user.email } });

        if (!currentUser) return new NextResponse("Unauthorized", { status: 401 });

        const isOwner = document.userId === currentUser.id;
        const isSelf = userId === currentUser.id;

        if (!isOwner && !isSelf) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Get all descendant document IDs recursively
        async function getDescendantIds(parentId: string): Promise<string[]> {
            const children = await prismadb.document.findMany({
                where: { parentDocumentId: parentId },
                select: { id: true }
            });

            const childIds = children.map(c => c.id);
            const descendantIds: string[] = [];

            for (const childId of childIds) {
                descendantIds.push(childId);
                const grandchildren = await getDescendantIds(childId);
                descendantIds.push(...grandchildren);
            }

            return descendantIds;
        }

        // Get all document IDs to unshare (parent + all descendants)
        const allDocumentIds = [params.documentId, ...await getDescendantIds(params.documentId)];

        // Remove collaborator from all documents
        await prismadb.collaborator.deleteMany({
            where: {
                documentId: { in: allDocumentIds },
                userId
            }
        });

        return NextResponse.json({ success: true, removed: allDocumentIds.length });

    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}
