import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";
import { getCurrentUserFromSession, getDocumentAccess } from "@/lib/permissions";

interface RouteProps {
    params: Promise<{ documentId: string }>;
}

function normalizeContent(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.trim();
}

export async function GET(_: Request, props: RouteProps) {
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
        if (!access.canRead) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const comments = await prismadb.documentComment.findMany({
            where: {
                documentId: params.documentId,
                parentCommentId: null,
            },
            orderBy: { createdAt: "asc" },
            include: {
                user: {
                    select: { id: true, name: true, image: true, email: true },
                },
                replies: {
                    orderBy: { createdAt: "asc" },
                    include: {
                        user: {
                            select: { id: true, name: true, image: true, email: true },
                        },
                    },
                },
            },
        });

        const canDeleteComment = (authorId: string) =>
            authorId === currentUser.id || access.canDelete;

        return NextResponse.json({
            comments: comments.map((comment) => ({
                ...comment,
                isAuthor: comment.userId === currentUser.id,
                canDelete: canDeleteComment(comment.userId),
                replies: comment.replies.map((reply) => ({
                    ...reply,
                    isAuthor: reply.userId === currentUser.id,
                    canDelete: canDeleteComment(reply.userId),
                })),
            })),
        });
    } catch (error) {
        console.log("[DOCUMENT_COMMENTS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request, props: RouteProps) {
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
        if (!access.canRead) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const content = normalizeContent(body?.content);
        const parentCommentId =
            typeof body?.parentCommentId === "string" ? body.parentCommentId : null;

        if (!content) {
            return new NextResponse("Comment content is required", { status: 400 });
        }
        if (content.length > 2000) {
            return new NextResponse("Comment is too long", { status: 400 });
        }

        if (parentCommentId) {
            const parentComment = await prismadb.documentComment.findUnique({
                where: { id: parentCommentId },
                select: {
                    id: true,
                    documentId: true,
                    parentCommentId: true,
                },
            });

            if (!parentComment || parentComment.documentId !== params.documentId) {
                return new NextResponse("Parent comment not found", { status: 404 });
            }

            if (parentComment.parentCommentId) {
                return new NextResponse("Nested replies are not supported", { status: 400 });
            }
        }

        const created = await prismadb.documentComment.create({
            data: {
                documentId: params.documentId,
                userId: currentUser.id,
                parentCommentId,
                content,
            },
            include: {
                user: {
                    select: { id: true, name: true, image: true, email: true },
                },
            },
        });

        return NextResponse.json({
            ...created,
            isAuthor: true,
            canDelete: true,
            replies: [],
        });
    } catch (error) {
        console.log("[DOCUMENT_COMMENTS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
