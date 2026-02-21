import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";
import { canEditDocument, getCurrentUserFromSession } from "@/lib/permissions";

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const currentUser = await getCurrentUserFromSession(session);
        if (!currentUser) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { id, targetId, parentId } = await req.json();

        if (!id || !targetId) {
            return new NextResponse("Invalid request", { status: 400 });
        }

        const originalDoc = await prismadb.document.findUnique({
            where: { id },
            select: { id: true, parentDocumentId: true }
        });

        if (!originalDoc) {
            return new NextResponse("Document not found", { status: 404 });
        }

        const canEditSource = await canEditDocument(id, currentUser.id);
        if (!canEditSource) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // 1. Get the target document to find its order and destination parent
        const targetDoc = await prismadb.document.findUnique({
            where: { id: targetId },
            select: { id: true, order: true, parentDocumentId: true }
        });

        if (!targetDoc) {
            return new NextResponse("Target document not found", { status: 404 });
        }

        const canEditTarget = await canEditDocument(targetId, currentUser.id);
        if (!canEditTarget) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const destinationParentId = parentId === undefined ? targetDoc.parentDocumentId : parentId;
        if (targetDoc.parentDocumentId !== destinationParentId) {
            return new NextResponse("Target does not belong to destination parent", { status: 400 });
        }

        const destinationOrder = targetDoc.order;

        if (destinationParentId) {
            const destinationParentExists = await prismadb.document.findUnique({
                where: { id: destinationParentId },
                select: { id: true }
            });

            if (!destinationParentExists) {
                return new NextResponse("Destination parent not found", { status: 404 });
            }

            const canEditDestinationParent = await canEditDocument(destinationParentId, currentUser.id);
            if (!canEditDestinationParent) {
                return new NextResponse("Unauthorized", { status: 401 });
            }

            // Cycle Detection: Check if the new parent is a child of the document being moved
            let currentParentId: string | null = destinationParentId;
            while (currentParentId) {
                if (currentParentId === id) {
                    return new NextResponse("Cannot move a note inside its own child", { status: 400 });
                }
                const parentBox = await prismadb.document.findUnique({
                    where: { id: currentParentId },
                    select: { parentDocumentId: true }
                });
                currentParentId = parentBox?.parentDocumentId || null;
            }
        }

        if (originalDoc.parentDocumentId && originalDoc.parentDocumentId !== destinationParentId) {
            // Document is being moved OUT of a parent. Remove the link from the old parent.
            const oldParentId = originalDoc.parentDocumentId;
            const oldParent = await prismadb.document.findUnique({
                where: { id: oldParentId },
                select: { id: true, content: true }
            });

            if (oldParent && oldParent.content) {
                let newContent = oldParent.content;
                let contentChanged = false;

                const isJson = newContent.trim().startsWith("{");
                if (isJson) {
                    try {
                        const json = JSON.parse(newContent);

                        // Recursive function to remove node
                        const removeNodeRecursive = (nodes: any[]): boolean => {
                            let changed = false;
                            for (let i = nodes.length - 1; i >= 0; i--) {
                                const node = nodes[i];
                                if (node.type === "pageLink" && node.attrs?.id === id) {
                                    nodes.splice(i, 1);
                                    changed = true;
                                } else if (node.content && Array.isArray(node.content)) {
                                    const childChanged = removeNodeRecursive(node.content);
                                    if (childChanged) changed = true;
                                }
                            }
                            return changed;
                        };

                        if (json.content && Array.isArray(json.content)) {
                            // Check using recursive function
                            contentChanged = removeNodeRecursive(json.content);

                            if (contentChanged) {
                                newContent = JSON.stringify(json);
                            }
                        }
                    } catch (e) {
                        console.error("Failed to parse old parent content", e);
                    }
                } else {
                    // HTML/Text Fallback
                    // Regex to remove <page-link id="ID" ...></page-link> or <page-link ... id="ID"></page-link>
                    const regex = new RegExp(`<page-link[^>]*id="${id}"[^>]*>.*?</page-link>`, "g");
                    if (regex.test(newContent)) {
                        newContent = newContent.replace(regex, "");
                        contentChanged = true;
                    }
                }

                if (contentChanged) {
                    await prismadb.document.update({
                        where: { id: oldParentId },
                        data: { content: newContent }
                    });

                    // Broadcast update for old parent
                    const io = (global as any).io;
                    if (io) {
                        io.to(`document:${oldParentId}`).emit('remote-update', {
                            documentId: oldParentId,
                            eventType: 'DOCUMENT_STRUCTURE',
                            changes: {
                                content: newContent,
                                childLeft: id // Signal that a child left, enabling surgical 'DELETE' event on frontend
                            }
                        });
                    }
                }
            }
        }

        await prismadb.$transaction(async (tx) => {
            // 1. Shift items down to make space
            await tx.document.updateMany({
                where: {
                    parentDocumentId: destinationParentId,
                    order: { gte: destinationOrder },
                    id: { not: id } // Don't shift self if moving within same list (simplifies logic)
                },
                data: {
                    order: { increment: 1 }
                }
            });

            // 2. Move the item
            await tx.document.update({
                where: { id: id },
                data: {
                    parentDocumentId: destinationParentId,
                    order: destinationOrder
                }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.log("[DOCUMENTS_MOVE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
