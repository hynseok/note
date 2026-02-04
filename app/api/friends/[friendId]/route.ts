import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";

export async function DELETE(
    req: Request,
    props: { params: Promise<{ friendId: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const currentUser = await prismadb.user.findUnique({
            where: { email: session.user.email }
        });

        if (!currentUser) return new NextResponse("Unauthorized", { status: 401 });

        const targetUserId = params.friendId;

        // Remove friendship both ways and clean up friend requests
        await prismadb.$transaction([
            prismadb.friend.deleteMany({
                where: {
                    userId: currentUser.id,
                    friendId: targetUserId
                }
            }),
            prismadb.friend.deleteMany({
                where: {
                    userId: targetUserId,
                    friendId: currentUser.id
                }
            }),
            prismadb.friendRequest.deleteMany({
                where: {
                    OR: [
                        { senderId: currentUser.id, receiverId: targetUserId },
                        { senderId: targetUserId, receiverId: currentUser.id }
                    ]
                }
            })
        ]);

        // Cascade: Remove all document sharing between the two users
        // 1. Remove collaborator entries where currentUser's documents are shared with the ex-friend
        const currentUserDocs = await prismadb.document.findMany({
            where: { userId: currentUser.id },
            select: { id: true }
        });

        if (currentUserDocs.length > 0) {
            await prismadb.collaborator.deleteMany({
                where: {
                    documentId: { in: currentUserDocs.map(d => d.id) },
                    userId: targetUserId
                }
            });
        }

        // 2. Remove collaborator entries where ex-friend's documents are shared with currentUser
        const friendDocs = await prismadb.document.findMany({
            where: { userId: targetUserId },
            select: { id: true }
        });

        if (friendDocs.length > 0) {
            await prismadb.collaborator.deleteMany({
                where: {
                    documentId: { in: friendDocs.map(d => d.id) },
                    userId: currentUser.id
                }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.log("[FRIENDS_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
