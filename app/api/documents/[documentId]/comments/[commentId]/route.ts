import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";
import { getCurrentUserFromSession, getDocumentAccess } from "@/lib/permissions";

interface RouteProps {
    params: Promise<{ documentId: string; commentId: string }>;
}

export async function DELETE(_: Request, props: RouteProps) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const currentUser = await getCurrentUserFromSession(session);
        if (!currentUser) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const access = await getDocumentAccess(params.documentId, currentUser.id);
        if (!access.exists) {
            return new NextResponse("Not Found", { status: 404 });
        }
        const isSharedCollaborator = !access.isOwner && access.collaboratorPermission !== null;
        if (!isSharedCollaborator) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const comment = await prismadb.documentComment.findUnique({
            where: { id: params.commentId },
            select: {
                id: true,
                userId: true,
                documentId: true,
            },
        });

        if (!comment || comment.documentId !== params.documentId) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const canDelete = comment.userId === currentUser.id;
        if (!canDelete) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        await prismadb.documentComment.delete({
            where: { id: comment.id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.log("[DOCUMENT_COMMENT_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
