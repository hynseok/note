"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { documentEvents } from "@/lib/events";
import { useDocumentSync } from "@/hooks/use-document-sync";

export const useDatabase = (documentId: string) => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const { broadcastUpdate } = useDocumentSync();

    const moveItem = useCallback(async (itemId: string, newDate: Date) => {
        try {
            // Fetch current document to get existing properties
            const res = await fetch(`/api/documents/${itemId}`);
            if (!res.ok) throw new Error("Failed to fetch document");

            const doc = await res.json();
            const existingProps = doc.properties ? JSON.parse(doc.properties) : {};

            const properties = {
                ...existingProps,
                date: newDate.toISOString()
            };

            await fetch(`/api/documents/${itemId}`, {
                method: "PATCH",
                body: JSON.stringify({
                    properties: properties
                })
            });

            toast.success("Item moved");
            router.refresh();
            documentEvents.emit({ type: "DATABASE_UPDATE" });

            // Broadcast to parent document room for real-time sync
            broadcastUpdate(documentId, { childUpdated: itemId }, Date.now());
        } catch (error) {
            toast.error("Failed to move item");
        }
    }, [router]);

    const createItem = useCallback(async (date: Date) => {
        try {
            setLoading(true);
            const properties = {
                date: date.toISOString()
            };

            const response = await fetch("/api/documents", {
                method: "POST",
                body: JSON.stringify({
                    title: "Untitled",
                    parentDocumentId: documentId,
                    properties: properties
                })
            });

            if (!response.ok) {
                throw new Error("Failed to create item");
            }

            toast.success("Item created");
            router.refresh();
            // Emit local events - these trigger refetch on the parent document
            // The parent document's WebSocket subscription will handle real-time updates
            documentEvents.emit({ type: "DATABASE_UPDATE" });
            documentEvents.emit({ type: "CREATE_CHILD", parentId: documentId });

            // Broadcast to parent document room for real-time sync
            broadcastUpdate(documentId, { childCreated: true }, Date.now());
        } catch (error) {
            toast.error("Failed to create item");
        } finally {
            setLoading(false);
        }
    }, [documentId, router]);

    const updateProperty = useCallback(async (itemId: string, newProperties: any) => {
        try {
            await fetch(`/api/documents/${itemId}`, {
                method: "PATCH",
                body: JSON.stringify({
                    properties: newProperties
                })
            });
            router.refresh();
            documentEvents.emit({ type: "DATABASE_UPDATE" });

            // Note: Property updates from modal already broadcast via document-modal.tsx
        } catch (error) {
            toast.error("Failed to update property");
        }
    }, [router]);

    return {
        moveItem,
        createItem,
        updateProperty,
        loading
    };
};
