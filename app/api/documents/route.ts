import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { title, parentDocumentId, skipContentUpdate, isDatabase, properties } = await req.json();

        const user = await prismadb.user.findUnique({
            where: {
                email: session.user.email,
            }
        });

        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Determine the actual owner - inherit from parent if it's a shared document
        let ownerId = user.id;
        let isCollaboratorCreating = false;

        if (parentDocumentId) {
            const parentDoc = await prismadb.document.findUnique({
                where: { id: parentDocumentId }
            });

            if (parentDoc && parentDoc.userId !== user.id) {
                // User is not the owner of the parent - check if collaborator with EDIT permission
                const collaborator = await prismadb.collaborator.findUnique({
                    where: {
                        documentId_userId: {
                            documentId: parentDocumentId,
                            userId: user.id
                        }
                    }
                });

                if (collaborator?.permission === "EDIT") {
                    // Inherit owner from parent document
                    ownerId = parentDoc.userId;
                    isCollaboratorCreating = true;
                } else {
                    return new NextResponse("Unauthorized - Cannot create child documents", { status: 401 });
                }
            }
        }

        const document = await prismadb.document.create({
            data: {
                title: title,
                parentDocumentId: parentDocumentId,
                userId: ownerId,
                isArchived: false,
                isPublished: false,
                isDatabase: isDatabase || false,
                properties: properties ? JSON.stringify(properties) : undefined,
            }
        });

        // If collaborator created this, auto-share with them as EDIT
        if (isCollaboratorCreating) {
            await prismadb.collaborator.create({
                data: {
                    documentId: document.id,
                    userId: user.id,
                    permission: "EDIT"
                }
            });
        }

        // Skip content update if requested (e.g., when parent is open in editor)
        if (parentDocumentId && !skipContentUpdate) {
            // Re-fetch parent to safely update content
            const parent = await prismadb.document.findUnique({
                where: { id: parentDocumentId }
            });

            if (parent) {
                const currentContent = parent.content || "";
                const isJson = currentContent.trim().startsWith("{");

                let newContent = currentContent;
                let shouldUpdate = false;

                if (isJson) {
                    // Handle JSON Content
                    try {
                        const contentJson = JSON.parse(currentContent);
                        if (!contentJson.content) contentJson.content = [];

                        const linkExists = contentJson.content.some((node: any) =>
                            node.type === "pageLink" && node.attrs?.id === document.id
                        );

                        if (!linkExists) {
                            contentJson.content.push({
                                type: "pageLink",
                                attrs: {
                                    id: document.id,
                                    title: document.title,
                                    icon: null
                                }
                            });
                            newContent = JSON.stringify(contentJson);
                            shouldUpdate = true;
                        }
                    } catch (e) {
                        // Fallback or ignore if JSON parse fails
                        console.error("Failed to parse parent content as JSON during child creation", e);
                    }
                } else {
                    // Handle HTML Content
                    if (!currentContent.includes(`id="${document.id}"`)) {
                        const linkBlock = `<page-link id="${document.id}" title="${document.title}"></page-link>`;
                        newContent = currentContent + linkBlock;
                        shouldUpdate = true;
                    }
                }

                if (shouldUpdate) {
                    await prismadb.document.update({
                        where: { id: parentDocumentId },
                        data: {
                            content: newContent
                        }
                    });
                }
            }
        }

        return NextResponse.json(document);
    } catch (error) {
        console.log("[DOCUMENTS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prismadb.user.findUnique({
            where: {
                email: session.user.email,
            }
        });

        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const parentDocumentId = searchParams.get("parentDocumentId");
        const isArchived = searchParams.get("isArchived");
        const flatten = searchParams.get("flatten");

        let query: any = {
            userId: user.id,
            isArchived: false,
        };

        if (isArchived === "true") {
            query.isArchived = true;
        }

        if (parentDocumentId) {
            query.parentDocumentId = parentDocumentId;
        }

        if (flatten === "true") {
            delete query.parentDocumentId;
        } else if (!parentDocumentId && isArchived !== "true") {
            query.parentDocumentId = null;
        }

        const documents = await prismadb.document.findMany({
            where: query,
            orderBy: {
                createdAt: "asc"
            }
        });

        return NextResponse.json(documents);
    } catch (error) {
        console.log("[DOCUMENTS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
