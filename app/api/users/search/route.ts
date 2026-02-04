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

        const { searchParams } = new URL(req.url);
        const query = searchParams.get("query");

        if (!query || query.length < 3) {
            return NextResponse.json([]);
        }

        const currentUser = await prismadb.user.findUnique({
            where: { email: session.user.email }
        });

        if (!currentUser) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const users = await prismadb.user.findMany({
            where: {
                email: {
                    contains: query, // SQLite only supports contains, exact match, etc. (case sensitive depends on DB collation)
                    // In a real prod DB, we might want manual lowercase check or Postgres ILIKE
                },
                AND: {
                    id: { not: currentUser.id }
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true
            },
            take: 5
        });

        return NextResponse.json(users);
    } catch (error) {
        console.log("[USERS_SEARCH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
