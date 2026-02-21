const { PrismaClient } = require('@prisma/client');
const { getToken } = require('next-auth/jwt');

const prisma = new PrismaClient();

const getRoomName = (documentId) => `document:${documentId}`;

async function resolveSocketUserId(socket) {
    const token = await getToken({
        req: socket.request,
        secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
        return null;
    }

    if (typeof token.sub === 'string' && token.sub) {
        return token.sub;
    }

    if (typeof token.email === 'string' && token.email) {
        const user = await prisma.user.findUnique({
            where: { email: token.email },
            select: { id: true },
        });
        return user?.id ?? null;
    }

    return null;
}

module.exports = (io) => {
    // documentId -> Set of socket IDs
    const documentRooms = new Map();

    io.use(async (socket, next) => {
        try {
            const userId = await resolveSocketUserId(socket);
            if (!userId) {
                return next(new Error('Unauthorized'));
            }

            socket.data.userId = userId;
            socket.data.documentPermissions = new Map();
            next();
        } catch (error) {
            console.error('[Socket.IO] Authentication failed:', error);
            next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);

        socket.on('join-document', async (payload = {}) => {
            try {
                const { documentId } = payload;
                if (!documentId) {
                    socket.emit('error', { message: 'Missing documentId' });
                    return;
                }

                const actualUserId = socket.data.userId;
                if (!actualUserId) {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                const document = await prisma.document.findUnique({
                    where: { id: documentId },
                    include: {
                        collaborators: {
                            where: { userId: actualUserId },
                            select: { permission: true },
                        },
                    },
                });

                if (!document) {
                    socket.emit('error', { message: 'Document not found' });
                    return;
                }

                const isOwner = document.userId === actualUserId;
                const collaborator = document.collaborators[0] ?? null;
                const isPublished = document.isPublished;

                if (!isOwner && !collaborator && !isPublished) {
                    socket.emit('error', { message: 'Access denied' });
                    return;
                }

                const permission = isOwner
                    ? 'OWNER'
                    : collaborator?.permission === 'EDIT'
                        ? 'EDIT'
                        : 'READ';

                const roomName = getRoomName(documentId);
                socket.join(roomName);

                if (!documentRooms.has(documentId)) {
                    documentRooms.set(documentId, new Set());
                }
                documentRooms.get(documentId).add(socket.id);
                socket.data.documentPermissions.set(documentId, permission);

                console.log(`[Socket.IO] User ${actualUserId} joined document ${documentId}`);

                socket.to(roomName).emit('user-joined', { userId: actualUserId, documentId });
                socket.emit('joined-document', {
                    documentId,
                    version: document.version,
                    activeUsers: documentRooms.get(documentId).size,
                    permission,
                });
            } catch (error) {
                console.error('[Socket.IO] Error joining document:', error);
                socket.emit('error', { message: 'Failed to join document' });
            }
        });

        socket.on('leave-document', (payload = {}) => {
            const { documentId } = payload;
            if (!documentId) return;

            const roomName = getRoomName(documentId);
            socket.leave(roomName);
            socket.data.documentPermissions?.delete(documentId);

            if (documentRooms.has(documentId)) {
                documentRooms.get(documentId).delete(socket.id);
                if (documentRooms.get(documentId).size === 0) {
                    documentRooms.delete(documentId);
                }
            }

            socket.to(roomName).emit('user-left', {
                userId: socket.data.userId,
                documentId,
            });
        });

        socket.on('document-update', (payload = {}) => {
            try {
                const { documentId, changes, version } = payload;
                if (!documentId || !changes) {
                    return;
                }

                const roomName = getRoomName(documentId);
                const permission = socket.data.documentPermissions?.get(documentId);

                if (!socket.rooms.has(roomName)) {
                    console.warn(`[Socket.IO] Blocked update from non-member: ${socket.id} -> ${documentId}`);
                    return;
                }

                if (permission !== 'OWNER' && permission !== 'EDIT') {
                    console.warn(`[Socket.IO] Blocked update without edit permission: ${socket.id} -> ${documentId}`);
                    return;
                }

                socket.to(roomName).emit('remote-update', {
                    documentId,
                    changes,
                    version,
                    userId: socket.data.userId,
                    timestamp: Date.now(),
                });
            } catch (error) {
                console.error('[Socket.IO] Error broadcasting update:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id}`);

            for (const [documentId, sockets] of documentRooms.entries()) {
                if (!sockets.has(socket.id)) {
                    continue;
                }

                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    documentRooms.delete(documentId);
                }

                socket.to(getRoomName(documentId)).emit('user-left', {
                    userId: socket.data.userId,
                    documentId,
                });
            }
        });
    });

    console.log('[Socket.IO] Server initialized');
};
