const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = (io) => {
    // Store active connections per document
    const documentRooms = new Map(); // documentId -> Set of socket IDs

    io.on('connection', (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);

        // Join a document room
        socket.on('join-document', async ({ documentId, userId }) => {
            try {
                if (!documentId) {
                    console.error('[Socket.IO] Missing documentId');
                    socket.emit('error', { message: 'Missing documentId' });
                    return;
                }

                if (!userId) {
                    console.error('[Socket.IO] Missing userId');
                    socket.emit('error', { message: 'Missing userId' });
                    return;
                }

                // If userId is an email, find the actual user ID
                let actualUserId = userId;
                if (userId.includes('@')) {
                    const user = await prisma.user.findUnique({
                        where: { email: userId },
                        select: { id: true }
                    });

                    if (!user) {
                        console.error('[Socket.IO] User not found:', userId);
                        socket.emit('error', { message: 'User not found' });
                        return;
                    }

                    actualUserId = user.id;
                }

                // Verify user has access to this document
                const document = await prisma.document.findUnique({
                    where: { id: documentId },
                    include: {
                        collaborators: {
                            where: { userId: actualUserId },
                        },
                    },
                });

                if (!document) {
                    console.error('[Socket.IO] Document not found:', documentId);
                    socket.emit('error', { message: 'Document not found' });
                    return;
                }

                const isOwner = document.userId === actualUserId;
                const isCollaborator = document.collaborators.length > 0;
                const isPublished = document.isPublished;

                if (!isOwner && !isCollaborator && !isPublished) {
                    console.error('[Socket.IO] Access denied for user:', actualUserId, 'document:', documentId);
                    socket.emit('error', { message: 'Access denied' });
                    return;
                }

                // Join the room
                const roomName = `document:${documentId}`;
                socket.join(roomName);

                // Track this connection
                if (!documentRooms.has(documentId)) {
                    documentRooms.set(documentId, new Set());
                }
                documentRooms.get(documentId).add(socket.id);

                // Store metadata on socket
                socket.data.documentId = documentId;
                socket.data.userId = actualUserId;

                console.log(`[Socket.IO] User ${actualUserId} joined document ${documentId}`);

                // Notify others in the room
                socket.to(roomName).emit('user-joined', { userId: actualUserId, documentId });

                // Send current version to client
                socket.emit('joined-document', {
                    documentId,
                    version: document.version,
                    activeUsers: documentRooms.get(documentId).size,
                });
            } catch (error) {
                console.error('[Socket.IO] Error joining document:', error);
                socket.emit('error', { message: 'Failed to join document', details: error.message });
            }
        });

        // Leave a document room
        socket.on('leave-document', ({ documentId }) => {
            if (!documentId) return;

            const roomName = `document:${documentId}`;
            socket.leave(roomName);

            if (documentRooms.has(documentId)) {
                documentRooms.get(documentId).delete(socket.id);
                if (documentRooms.get(documentId).size === 0) {
                    documentRooms.delete(documentId);
                }
            }

            console.log(`[Socket.IO] User left document ${documentId}`);
            socket.to(roomName).emit('user-left', {
                userId: socket.data.userId,
                documentId,
            });
        });

        // Broadcast document update
        socket.on('document-update', async ({ documentId, changes, version }) => {
            try {
                if (!documentId || !changes) {
                    return;
                }

                const roomName = `document:${documentId}`;
                const userId = socket.data.userId;

                // Broadcast to all other clients in the room
                socket.to(roomName).emit('remote-update', {
                    documentId,
                    changes,
                    version,
                    userId,
                    timestamp: Date.now(),
                });

                console.log(`[Socket.IO] Document update broadcast for ${documentId}`);
            } catch (error) {
                console.error('[Socket.IO] Error broadcasting update:', error);
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id}`);

            const documentId = socket.data.documentId;
            if (documentId && documentRooms.has(documentId)) {
                documentRooms.get(documentId).delete(socket.id);
                if (documentRooms.get(documentId).size === 0) {
                    documentRooms.delete(documentId);
                }

                const roomName = `document:${documentId}`;
                socket.to(roomName).emit('user-left', {
                    userId: socket.data.userId,
                    documentId,
                });
            }
        });
    });

    console.log('[Socket.IO] Server initialized');
};
