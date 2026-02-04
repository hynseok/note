import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";

// GET: List incoming requests
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

        const requests = await prismadb.friendRequest.findMany({
            where: {
                receiverId: currentUser.id,
                status: "PENDING"
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true
                    }
                }
            }
        });

        return NextResponse.json(requests);
    } catch (error) {
        console.log("[FRIENDS_REQUESTS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST: Send a friend request
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const { receiverId } = await req.json();

        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const currentUser = await prismadb.user.findUnique({
            where: { email: session.user.email }
        });

        if (!currentUser) return new NextResponse("Unauthorized", { status: 401 });

        // Check if request already exists and is PENDING
        const existingRequest = await prismadb.friendRequest.findFirst({
            where: {
                senderId: currentUser.id,
                receiverId: receiverId,
                status: "PENDING"
            }
        });

        if (existingRequest) {
            return new NextResponse("Request already sent", { status: 400 });
        }

        // Handle case where a previous request was rejected or accepted (then unfriended)
        // We delete any non-pending requests to create a fresh one
        await prismadb.friendRequest.deleteMany({
            where: {
                senderId: currentUser.id,
                receiverId: receiverId,
                status: { in: ["REJECTED", "ACCEPTED"] }
            }
        });

        // Check if already friends
        const existingFriend = await prismadb.friend.findFirst({
            where: {
                userId: currentUser.id,
                friendId: receiverId
            }
        });

        if (existingFriend) {
            return new NextResponse("Already friends", { status: 400 });
        }

        // Also check if they sent us a request (could auto-accept, but let's keep simple)
        const reverseRequest = await prismadb.friendRequest.findFirst({
            where: {
                senderId: receiverId,
                receiverId: currentUser.id,
                status: "PENDING"
            }
        });

        if (reverseRequest) {
            // If they sent us one, we should probably tell user to accept it, 
            // OR we could automatically accept it here. 
            // For now, let's return a specific message.
            return new NextResponse("They already sent you a request", { status: 409 });
        }

        const request = await prismadb.friendRequest.create({
            data: {
                senderId: currentUser.id,
                receiverId: receiverId,
                status: "PENDING"
            }
        });

        return NextResponse.json(request);
    } catch (error) {
        console.log("[FRIENDS_REQUESTS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
