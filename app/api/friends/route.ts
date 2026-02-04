import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";

// GET: List friends
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

        const friends = await prismadb.friend.findMany({
            where: {
                userId: currentUser.id
            },
            include: {
                friend: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true
                    }
                }
            }
        });

        // Transform response to return friend list directly
        // Currently the result is an array of { id, userId, friendId, friend: {...} }
        // We might want to return just the friend objects or keeping it wrapped.
        // Frontend expects `friends` state to be array.

        return NextResponse.json(friends);
    } catch (error) {
        console.log("[FRIENDS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
