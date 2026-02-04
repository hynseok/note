import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";

export async function PATCH(
    req: Request,
    props: { params: Promise<{ requestId: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        const { action } = await req.json(); // "ACCEPT" or "REJECT"

        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const currentUser = await prismadb.user.findUnique({
            where: { email: session.user.email }
        });

        if (!currentUser) return new NextResponse("Unauthorized", { status: 401 });

        const request = await prismadb.friendRequest.findUnique({
            where: { id: params.requestId }
        });

        if (!request) return new NextResponse("Not Found", { status: 404 });

        if (request.receiverId !== currentUser.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (action === "ACCEPT") {
            // Transaction to create friendships both ways and update request
            await prismadb.$transaction([
                prismadb.friendRequest.update({
                    where: { id: params.requestId },
                    data: { status: "ACCEPTED" }
                }),
                prismadb.friend.create({
                    data: {
                        userId: request.senderId,
                        friendId: request.receiverId
                    }
                }),
                prismadb.friend.create({
                    data: {
                        userId: request.receiverId,
                        friendId: request.senderId
                    }
                })
            ]);

            // Delete the accepted request to keep table clean? Or keep history.
            // Schema has status, so keep history. But ensure we don't show ACCEPTED requests in pending list.
            // (GET /api/friends/requests filters by PENDING)

            return NextResponse.json({ success: true });
        } else if (action === "REJECT") {
            const updatedRequest = await prismadb.friendRequest.update({
                where: { id: params.requestId },
                data: { status: "REJECTED" }
            });
            return NextResponse.json(updatedRequest);
        }

        return new NextResponse("Invalid action", { status: 400 });

    } catch (error) {
        console.log("[FRIENDS_REQUEST_PATCH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
