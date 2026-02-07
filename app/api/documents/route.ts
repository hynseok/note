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

        // Determine the actual owner
        let ownerId = user.id; // Created by current user
        let parentOwnerId: string | null = null;
        let isCollaboratorCreating = false;

        if (parentDocumentId) {
            const parentDoc = await prismadb.document.findUnique({
                where: { id: parentDocumentId }
            });

            if (parentDoc) {
                if (parentDoc.userId !== user.id) {
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
                        // User allows to create, but they become the owner of this new child
                        // We must add the parent owner as a collaborator so they can manage it
                        parentOwnerId = parentDoc.userId;
                        isCollaboratorCreating = true;
                    } else {
                        return new NextResponse("Unauthorized - Cannot create child documents", { status: 401 });
                    }
                }
            }
        }

        // Calculate order for the new document (append to bottom)
        const lastDocument = await prismadb.document.findFirst({
            where: {
                userId: ownerId,
                parentDocumentId: parentDocumentId,
                isArchived: false
            },
            orderBy: {
                order: "desc"
            }
        });

        const newOrder = lastDocument ? lastDocument.order + 1 : 0;

        const document = await prismadb.document.create({
            data: {
                title: title,
                parentDocumentId: parentDocumentId,
                userId: ownerId, // Creator is the owner
                isArchived: false,
                isPublished: false,
                isDatabase: isDatabase || false,
                properties: properties ? JSON.stringify(properties) : undefined,
                order: newOrder,
            }
        });

        // Use `isCollaboratorCreating` logic to add Parent Owner as collaborator
        if (isCollaboratorCreating && parentOwnerId) {
            await prismadb.collaborator.create({
                data: {
                    documentId: document.id,
                    userId: parentOwnerId,
                    permission: "EDIT"
                }
            });
        }

        // Copy all collaborators from parent document to child
        if (parentDocumentId) {
            const parentCollaborators = await prismadb.collaborator.findMany({
                where: { documentId: parentDocumentId }
            });

            // Create collaborators for the new document
            for (const collab of parentCollaborators) {
                // If the collaborator is the creator (user.id), they are already the owner, so skip
                if (collab.userId === user.id) {
                    continue;
                }

                await prismadb.collaborator.create({
                    data: {
                        documentId: document.id,
                        userId: collab.userId,
                        permission: collab.permission
                    }
                });
            }

            // Broadcast child creation to parent document room for real-time sync
            const io = (global as any).io;
            if (io) {
                const roomName = `document:${parentDocumentId}`;
                io.to(roomName).emit('remote-update', {
                    documentId: parentDocumentId,
                    changes: { childCreated: true, newChildId: document.id },
                    version: Date.now()
                });
                console.log(`[Socket.IO] Child creation broadcast for parent ${parentDocumentId}`);
            }
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
            isArchived: false,
        };

        if (isArchived === "true") {
            query.isArchived = true;
        }

        if (parentDocumentId) {
            query.parentDocumentId = parentDocumentId;
            // For children, we want documents where:
            // 1. Current user is the owner
            // 2. OR Current user is a collaborator (which happens if someone else created it in our folder)
            query.OR = [
                { userId: user.id },
                { collaborators: { some: { userId: user.id } } }
            ];
        } else {
            // For root documents (Private List), strictly own documents only
            if (!parentDocumentId && isArchived !== "true") {
                query.parentDocumentId = null;
            }
            // Whatever happens, if it's a root fetch or general fetch without parentId, strictly user's own docs
            // Unless it's search (flatten), but here flatten implies search across own docs usually?
            // If flatten=true, it's usually for search. Let's keep it scoped to own docs for safety unless designed otherwise.
            // But the request specifically asked for "Private section" children.

            // To be safe and minimal change:
            // Only relax restriction IF parentDocumentId is set.
            if (!parentDocumentId) {
                query.userId = user.id;
            }
        }

        if (flatten === "true") {
            delete query.parentDocumentId;
            // If flatten is true, we probably still want only own docs? 
            // Or shared ones too? Search usually includes shared.
            // Let's assume flatten searches EVERYTHING accessible.
            if (query.userId) {
                // If it was restricted to userId, maybe we relax it for search?
                // For now, let's keep search scoped to "My Private Docs" to avoid scope creep, 
                // UNLESS user complains search is missing shared items.
                // But the specific request is about "Child items in Private Section".
            }
        }

        // Refined Logic to handle the specific "query.userId" removal safely:

        const whereClause: any = {
            isArchived: query.isArchived,
        };

        // If parentDocumentId is provided, we use the OR logic for ownership/collaboration
        if (parentDocumentId) {
            whereClause.parentDocumentId = parentDocumentId;
            whereClause.OR = [
                { userId: user.id },
                { collaborators: { some: { userId: user.id } } }
            ];
        } else {
            // Otherwise (Root level or Trash), restrict to own documents
            whereClause.userId = user.id;

            if (isArchived !== "true" && flatten !== "true") {
                whereClause.parentDocumentId = null;
            }
        }

        // Flatten override (Search)
        if (flatten === "true") {
            // If search, we generally want everything we have access to?
            // But existing behavior was `userId: user.id`.
            // Maintaining existing behavior for search for now to avoid regression.
            // So if flatten is true, we use the `userId` constraint from the previous block?
            // Actually, let's just stick to the specific fix for parentDocumentId.

            // Re-evaluating the construction to be cleaner based on original code structure:
        }

        // Let's rewrite the query object construction cleanly.

        const finalQuery: any = {
            isArchived: isArchived === "true"
        };

        if (parentDocumentId) {
            finalQuery.parentDocumentId = parentDocumentId;
            // Allow Owner OR Collaborator
            finalQuery.OR = [
                { userId: user.id },
                { collaborators: { some: { userId: user.id } } }
            ];
        } else {
            // Root / Trash / Search (flatten) -> defaults to own docs
            finalQuery.userId = user.id;

            if (isArchived !== "true" && flatten !== "true") {
                finalQuery.parentDocumentId = null;
            }
        }

        if (flatten === "true") {
            // Search mode: Remove hierarchy constraint
            delete finalQuery.parentDocumentId;
        }

        const documents = await prismadb.document.findMany({
            where: finalQuery,
            orderBy: [
                { order: "asc" },
                { createdAt: "asc" }
            ]
        });

        return NextResponse.json(documents);
    } catch (error) {
        console.log("[DOCUMENTS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
