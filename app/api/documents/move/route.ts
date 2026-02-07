import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { id, targetId, parentId } = await req.json();

        if (!id || !targetId) {
            return new NextResponse("Invalid request", { status: 400 });
        }

        // 1. Get the target document to find its order
        const targetDoc = await prismadb.document.findUnique({
            where: { id: targetId }
        });

        if (!targetDoc) {
            return new NextResponse("Target document not found", { status: 404 });
        }

        // 2. We want to insert 'id' right AFTER 'targetId' in the new list (parentId)
        // or effectively at target's position, shifting things down.
        // Let's assume we replace position, so we take target's order, and shift target and subsequent items down?
        // Usually DnD replaces. Let's set order = targetDoc.order and shift everything >= targetDoc.order + 1

        const destinationOrder = targetDoc.order;

        // Shift existing items in the destination parent
        // If parentId is null (root), handle that.
        // Prisma doesn't support "updateMany where parentId is null" easily if field is nullable?
        // Actually parentId comes from frontend (over.data.parentId).

        // Update: We'll do a transaction.
        // Shift all items with order >= destinationOrder down by 1 in the target list

        if (parentId) {
            // Cycle Detection: Check if the new parent is a child of the document being moved
            let currentParentId: string | null = parentId;
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

        // Fetch original document to compare parent
        const originalDoc = await prismadb.document.findUnique({
            where: { id: id },
            select: { parentDocumentId: true }
        });

        if (originalDoc && originalDoc.parentDocumentId && originalDoc.parentDocumentId !== parentId) {
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
                            changes: {
                                content: newContent,
                                childLeft: id // Signal that a child left, enabling surgical 'DELETE' event on frontend
                            },
                            version: Date.now()
                        });
                    }
                }
            }
        }

        await prismadb.$transaction(async (tx) => {
            // 1. Shift items down to make space
            await tx.document.updateMany({
                where: {
                    parentDocumentId: parentId,
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
                    parentDocumentId: parentId,
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
