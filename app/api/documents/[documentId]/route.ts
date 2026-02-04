import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";

// Helper to check if targetId is an ancestor of documentId (prevents circular moves)
async function isAncestor(documentId: string, targetId: string): Promise<boolean> {
    if (documentId === targetId) return true;

    let currentId: string | null = targetId;
    const visited = new Set<string>();

    while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);

        if (currentId === documentId) return true;

        const parentDoc = await prismadb.document.findUnique({
            where: { id: currentId },
            select: { parentDocumentId: true }
        }) as { parentDocumentId: string | null } | null;

        currentId = parentDoc?.parentDocumentId ?? null;
    }

    return false;
}

// Helper to update parent content (add/remove pageLink)
async function updateParentContent(parentId: string, childId: string, action: 'add' | 'remove', childData?: { title: string, icon: string | null }) {
    try {
        const parent = await prismadb.document.findUnique({ where: { id: parentId } });
        if (!parent) return;

        let contentJson;
        const currentContent = parent.content || "";
        const isJson = currentContent.trim().startsWith("{");

        if (isJson) {
            try {
                contentJson = JSON.parse(currentContent);
            } catch (e) {
                return;
            }

            if (!contentJson.content) contentJson.content = [];

            if (action === 'remove') {
                contentJson.content = contentJson.content.filter((node: any) =>
                    !(node.type === "pageLink" && node.attrs?.id === childId)
                );
            } else if (action === 'add' && childData) {
                const linkExists = contentJson.content.some((node: any) =>
                    node.type === "pageLink" && node.attrs?.id === childId
                );

                if (!linkExists) {
                    contentJson.content.push({
                        type: "pageLink",
                        attrs: {
                            id: childId,
                            title: childData.title || "Untitled",
                            icon: childData.icon
                        }
                    });
                }
            }

            await prismadb.document.update({
                where: { id: parentId },
                data: { content: JSON.stringify(contentJson) }
            });
        } else {
            let newContent = currentContent;

            if (action === 'remove') {
                const regex = new RegExp(`<page-link[^>]*id="${childId}"[^>]*>.*?</page-link>`, 'g');
                newContent = newContent.replace(regex, '');
            } else if (action === 'add' && childData) {
                if (!newContent.includes(`id="${childId}"`)) {
                    const linkBlock = `<page-link id="${childId}" title="${childData.title || 'Untitled'}"></page-link>`;
                    newContent = newContent + linkBlock;
                }
            }

            if (newContent !== currentContent) {
                await prismadb.document.update({
                    where: { id: parentId },
                    data: { content: newContent }
                });
            }
        }
    } catch (e) {
        console.error(`[UPDATE_PARENT_CONTENT] Failed to ${action} child ${childId} in parent ${parentId}`, e);
    }
}

export async function GET(
    req: Request,
    props: { params: Promise<{ documentId: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const document = await prismadb.document.findUnique({
            where: {
                id: params.documentId,
            },
            include: {
                lastEditedBy: {
                    select: { id: true, name: true, image: true }
                },
                childDocuments: {
                    where: { isArchived: false },
                    select: { id: true, title: true, icon: true }
                },
                parentDocument: {
                    select: {
                        id: true,
                        title: true,
                        icon: true,
                        parentDocument: {
                            select: {
                                id: true,
                                title: true,
                                icon: true,
                                parentDocument: {
                                    select: {
                                        id: true,
                                        title: true,
                                        icon: true,
                                        parentDocument: {
                                            select: {
                                                id: true,
                                                title: true,
                                                icon: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const user = await prismadb.user.findUnique({ where: { email: session.user.email } });

        if (!user) return new NextResponse("Unauthorized", { status: 401 });

        if (!document) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const isOwner = document.userId === user.id;
        const isPublished = document.isPublished;

        // Check if user is a collaborator
        let collaboratorPermission: string | null = null;
        if (!isOwner) {
            const collaborator = await prismadb.collaborator.findUnique({
                where: {
                    documentId_userId: {
                        documentId: params.documentId,
                        userId: user.id
                    }
                }
            });
            if (collaborator) {
                collaboratorPermission = collaborator.permission;
            }
        }

        // Allow access if owner, collaborator, or published
        if (!isOwner && !collaboratorPermission && !isPublished) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Determine permission level
        let currentUserPermission = "READ";
        if (isOwner) {
            currentUserPermission = "OWNER";
        } else if (collaboratorPermission === "EDIT") {
            currentUserPermission = "EDIT";
        }

        return NextResponse.json({
            ...document,
            currentUserPermission
        });
    } catch (error) {
        console.log("[DOCUMENT_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    props: { params: Promise<{ documentId: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prismadb.user.findUnique({ where: { email: session.user.email } });
        if (!user) return new NextResponse("Unauthorized", { status: 401 });

        const existingDocument = await prismadb.document.findUnique({
            where: { id: params.documentId }
        });

        if (!existingDocument) {
            return new NextResponse("Not Found", { status: 404 });
        }

        if (existingDocument.userId !== user.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const document = await prismadb.document.delete({
            where: {
                id: params.documentId,
            }
        });

        return NextResponse.json(document);
    } catch (error) {
        console.log("[DOCUMENT_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    props: { params: Promise<{ documentId: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        const {
            content,
            title,
            icon,
            coverImage,
            isPublished,
            isArchived,
            parentDocumentId
        } = await req.json();

        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prismadb.user.findUnique({ where: { email: session.user.email } });
        if (!user) return new NextResponse("Unauthorized", { status: 401 });

        const existingDocument = await prismadb.document.findUnique({
            where: { id: params.documentId }
        });

        if (!existingDocument) return new NextResponse("Not Found", { status: 404 });

        const isOwner = existingDocument.userId === user.id;

        // Check if user is a collaborator with EDIT permission
        let canEdit = isOwner;
        if (!isOwner) {
            const collaborator = await prismadb.collaborator.findUnique({
                where: {
                    documentId_userId: {
                        documentId: params.documentId,
                        userId: user.id
                    }
                }
            });
            if (collaborator?.permission === "EDIT") {
                canEdit = true;
            }
        }

        if (!canEdit) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Only owner can change certain properties
        const isOwnerOnlyAction = parentDocumentId !== undefined ||
            isPublished !== undefined ||
            isArchived !== undefined;

        // Restrict owner-only actions
        if (isOwnerOnlyAction && !isOwner) {
            return new NextResponse("Unauthorized - Owner only action", { status: 401 });
        }

        // Circular move prevention: check if new parent is a descendant
        if (parentDocumentId !== undefined && parentDocumentId !== null) {
            const wouldCreateCycle = await isAncestor(params.documentId, parentDocumentId);
            if (wouldCreateCycle) {
                return new NextResponse("Cannot move a document into its own descendant", { status: 400 });
            }
        }

        const document = await prismadb.document.update({
            where: {
                id: params.documentId,
            },
            data: {
                content,
                title,
                icon,
                coverImage,
                isPublished,
                isArchived,
                parentDocumentId,
                lastEditedById: user.id
            }
        });

        // Content Synchronization: Handle Move (Parent Changed)
        if (parentDocumentId !== undefined && parentDocumentId !== existingDocument.parentDocumentId) {
            const oldParentId = existingDocument.parentDocumentId;
            const newParentId = parentDocumentId;

            if (oldParentId) {
                await updateParentContent(oldParentId, document.id, 'remove');
            }

            if (newParentId) {
                await updateParentContent(newParentId, document.id, 'add', {
                    title: document.title,
                    icon: document.icon
                });
            }
        }

        // Handle Restore
        if (isArchived === false && document.parentDocumentId) {
            await updateParentContent(document.parentDocumentId, document.id, 'add', {
                title: document.title,
                icon: document.icon
            });
        }

        return NextResponse.json(document);
    } catch (error) {
        console.log("[DOCUMENT_UPDATE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
