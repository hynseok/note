import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";

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

// Helper to delete attached files from filesystem
function deleteAttachedFiles(content: string | null) {
    if (!content) return;

    try {
        const isJson = content.trim().startsWith("{");
        const filePaths: string[] = [];

        if (isJson) {
            const contentJson = JSON.parse(content);

            const extractFiles = (nodes: any[]) => {
                for (const node of nodes) {
                    if (node.type === "fileAttachment" && node.attrs?.src) {
                        filePaths.push(node.attrs.src);
                    }
                    if (node.content) {
                        extractFiles(node.content);
                    }
                }
            };

            if (contentJson.content) {
                extractFiles(contentJson.content);
            }
        } else {
            // HTML fallback
            // Regex to find src (or data-src) in file-attachment divs
            // <div ... data-type="file-attachment" ... data-src="/uploads/..." ... >
            const regex = /data-src="([^"]+)"/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
                filePaths.push(match[1]);
            }
        }

        for (const filePath of filePaths) {
            // Check if it is a local upload (starts with /uploads/)
            if (filePath.startsWith("/uploads/")) {
                const absolutePath = path.join(process.cwd(), "public", filePath);
                if (fs.existsSync(absolutePath)) {
                    fs.unlinkSync(absolutePath);
                    console.log(`[DELETE_FILE] Deleted attached file: ${absolutePath}`);
                }
            }
        }
    } catch (e) {
        console.error("[DELETE_ATTACHED_FILES] Failed to delete files", e);
    }
}

// Helper to update parent content (add/remove/update pageLink)
async function updateParentContent(parentId: string, childId: string, action: 'add' | 'remove' | 'update', childData?: { title?: string, icon?: string | null }) {
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
            } else if (action === 'update' && childData) {
                // Find and update the node
                const updateNode = (nodes: any[]) => {
                    for (const node of nodes) {
                        if (node.type === "pageLink" && node.attrs?.id === childId) {
                            if (childData.title !== undefined) node.attrs.title = childData.title;
                            if (childData.icon !== undefined) node.attrs.icon = childData.icon;
                        }
                        if (node.content) {
                            updateNode(node.content);
                        }
                    }
                };
                updateNode(contentJson.content);
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
            } else if (action === 'update' && childData) {
                if (childData.title) {
                    const regex = new RegExp(`(<page-link[^>]*id="${childId}"[^>]*title=")([^"]*)(")`, 'g');
                    newContent = newContent.replace(regex, `$1${childData.title}$3`);
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
                user: {
                    select: { id: true, name: true, image: true }
                },
                lastEditedBy: {
                    select: { id: true, name: true, image: true }
                },
                childDocuments: {
                    where: { isArchived: false },
                    select: {
                        id: true,
                        title: true,
                        icon: true,
                        properties: true,
                        isDatabase: true,
                        user: {
                            select: { id: true, name: true, image: true }
                        }
                    }
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

        if (!isOwner && !collaboratorPermission && !isPublished) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        let currentUserPermission = "READ";
        if (isOwner) {
            currentUserPermission = "OWNER";
        } else if (collaboratorPermission === "EDIT") {
            currentUserPermission = "EDIT";
        }

        return NextResponse.json({
            ...document,
            currentUserPermission,
            version: document.version,
            lastSyncedAt: document.lastSyncedAt
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
            let isParentOwner = false;
            if (existingDocument.parentDocumentId) {
                const parentDoc = await prismadb.document.findUnique({
                    where: { id: existingDocument.parentDocumentId }
                });
                if (parentDoc && parentDoc.userId === user.id) {
                    isParentOwner = true;
                }
            }

            if (!isParentOwner) {
                return new NextResponse("Unauthorized", { status: 401 });
            }
        }

        // Notify all users in the document room before deletion
        const io = (global as any).io;
        if (io) {
            const roomName = `document:${params.documentId}`;
            io.to(roomName).emit('document-deleted', { documentId: params.documentId });
            console.log(`[Socket.IO] Document deleted notification sent for ${params.documentId}`);
        }

        // Delete attached files from filesystem
        if (existingDocument.content) {
            deleteAttachedFiles(existingDocument.content);
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
            parentDocumentId,
            isDatabase,
            properties,
            version: clientVersion
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

        // Optimistic concurrency control: check version
        if (clientVersion !== undefined && existingDocument.version !== clientVersion) {
            return new NextResponse(
                JSON.stringify({
                    error: "Conflict",
                    message: "Document was modified by another user",
                    currentVersion: existingDocument.version
                }),
                { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const isOwner = existingDocument.userId === user.id;

        // Check if user is the owner OR parent owner
        let isOwnerOrParentOwner = isOwner;
        if (!isOwner && existingDocument.parentDocumentId) {
            const parentDoc = await prismadb.document.findUnique({
                where: { id: existingDocument.parentDocumentId }
            });
            if (parentDoc?.userId === user.id) {
                isOwnerOrParentOwner = true;
            }
        }

        // Check if user is a collaborator with EDIT permission
        let canEdit = isOwnerOrParentOwner;
        if (!canEdit) {
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

        // Only owner (or parent owner) can change certain properties
        // Note: isDatabase is allowed for EDIT collaborators (view preference)
        const isOwnerOnlyAction = parentDocumentId !== undefined ||
            isPublished !== undefined ||
            isArchived !== undefined;

        // Restrict owner-only actions
        if (isOwnerOnlyAction && !isOwnerOrParentOwner) {
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
                isDatabase,
                properties: properties !== undefined ? (typeof properties === 'object' ? JSON.stringify(properties) : properties) : undefined,
                parentDocumentId,
                lastEditedById: user.id,
                version: { increment: 1 } // Increment version for optimistic locking
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

        // Title / Icon Propagation
        if (title !== undefined || icon !== undefined) {
            const parentId = document.parentDocumentId;
            if (parentId) {
                await updateParentContent(parentId, document.id, 'update', {
                    title: title !== undefined ? title : undefined,
                    icon: icon !== undefined ? icon : undefined
                });
            }
        }

        return NextResponse.json(document);
    } catch (error) {
        console.log("[DOCUMENT_UPDATE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
