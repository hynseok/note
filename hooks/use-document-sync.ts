"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

interface DocumentUpdate {
    documentId: string;
    changes: any;
    version: number;
    userId: string;
    timestamp: number;
}

interface UseDocumentSyncReturn {
    isConnected: boolean;
    subscribe: (callback: (update: DocumentUpdate) => void) => () => void;
    broadcastUpdate: (documentId: string, changes: any, version: number) => void;
    joinDocument: (documentId: string) => void;
    leaveDocument: (documentId: string) => void;
}

export const useDocumentSync = (): UseDocumentSyncReturn => {
    const { data: session } = useSession();
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const listenersRef = useRef<Set<(update: DocumentUpdate) => void>>(new Set());
    const currentDocumentRef = useRef<string | null>(null);

    useEffect(() => {
        if (!session?.user?.email) return;

        // Initialize Socket.IO client
        const socket = io({
            path: "/socket.io",
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("[Socket.IO] Connected");
            setIsConnected(true);

            // Rejoin current document if we were viewing one
            if (currentDocumentRef.current && session.user) {
                const documentId = currentDocumentRef.current;
                const userId = session.user.email || (session.user as any).id;
                if (userId) {
                    socket.emit("join-document", { documentId, userId });
                }
            }
        });

        socket.on("disconnect", () => {
            console.log("[Socket.IO] Disconnected");
            setIsConnected(false);
        });

        socket.on("remote-update", (update: DocumentUpdate) => {
            console.log("[Socket.IO] Received remote update", update);
            // Notify all subscribers
            listenersRef.current.forEach((callback) => callback(update));
        });

        socket.on("error", (error: any) => {
            const errorMessage = error?.message || JSON.stringify(error) || 'Unknown error';
            console.error("[Socket.IO] Error:", errorMessage);

            // Handle "Document not found" gracefully
            if (errorMessage.includes("Document not found")) {
                console.warn("[Socket.IO] Document was deleted or you lost access");
                // Don't show error toast, just log it
                // The document-deleted handler will take care of navigation
                return;
            }

            if (error?.message) {
                console.error("[Socket.IO] Error details:", error);
            }
        });

        socket.on("document-deleted", ({ documentId }: { documentId: string }) => {
            console.log(`[Socket.IO] Document ${documentId} was deleted`);

            // Notify the app that the document was deleted
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('document-deleted', {
                    detail: { documentId }
                }));
            }
        });

        socket.on("joined-document", ({ documentId, version, activeUsers }) => {
            console.log(`[Socket.IO] Joined document ${documentId}, version ${version}, ${activeUsers} active users`);
        });

        socket.on("user-joined", ({ userId, documentId }) => {
            console.log(`[Socket.IO] User ${userId} joined document ${documentId}`);
        });

        socket.on("user-left", ({ userId, documentId }) => {
            console.log(`[Socket.IO] User ${userId} left document ${documentId}`);
        });

        return () => {
            console.log("[Socket.IO] Cleaning up socket");
            if (currentDocumentRef.current) {
                socket.emit("leave-document", { documentId: currentDocumentRef.current });
            }
            socket.disconnect();
            socketRef.current = null;
        };
    }, [session]);

    const subscribe = useCallback((callback: (update: DocumentUpdate) => void) => {
        listenersRef.current.add(callback);
        return () => {
            listenersRef.current.delete(callback);
        };
    }, []);

    const broadcastUpdate = useCallback((documentId: string, changes: any, version: number) => {
        if (!socketRef.current?.connected) {
            console.warn("[Socket.IO] Cannot broadcast - not connected");
            return;
        }

        socketRef.current.emit("document-update", {
            documentId,
            changes,
            version,
        });
    }, []);

    const joinDocument = useCallback((documentId: string) => {
        if (!socketRef.current || !session?.user) return;

        const userId = session.user.email || (session.user as any).id;

        if (!userId) {
            console.warn("[Socket.IO] Cannot join - no userId available");
            return;
        }

        // Leave previous document if any
        if (currentDocumentRef.current && currentDocumentRef.current !== documentId) {
            socketRef.current.emit("leave-document", { documentId: currentDocumentRef.current });
        }

        currentDocumentRef.current = documentId;
        socketRef.current.emit("join-document", { documentId, userId });
        console.log(`[Socket.IO] Joining document ${documentId} with user ${userId}`);
    }, [session]);

    const leaveDocument = useCallback((documentId: string) => {
        if (!socketRef.current) return;

        socketRef.current.emit("leave-document", { documentId });
        if (currentDocumentRef.current === documentId) {
            currentDocumentRef.current = null;
        }
        console.log(`[Socket.IO] Leaving document ${documentId}`);
    }, []);

    return {
        isConnected,
        subscribe,
        broadcastUpdate,
        joinDocument,
        leaveDocument,
    };
};
