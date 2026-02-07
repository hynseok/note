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
