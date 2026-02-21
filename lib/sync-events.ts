export type DocumentSyncEventType = "DOCUMENT_UPDATE" | "DOCUMENT_STRUCTURE";

export interface SyncBroadcastInput {
    documentId: string;
    changes: Record<string, any>;
    eventType?: DocumentSyncEventType;
    documentVersion?: number;
    // Backward compatibility field for legacy callers.
    version?: number;
}

export interface SyncEventPayload {
    documentId: string;
    changes: Record<string, any>;
    eventType: DocumentSyncEventType;
    documentVersion?: number;
    userId?: string;
    timestamp?: number;
}

export function normalizeOutgoingSyncEvent(input: SyncBroadcastInput): SyncEventPayload {
    const eventType = input.eventType ?? "DOCUMENT_UPDATE";
    const derivedVersion =
        typeof input.documentVersion === "number"
            ? input.documentVersion
            : typeof input.version === "number"
                ? input.version
                : undefined;

    return {
        documentId: input.documentId,
        changes: input.changes,
        eventType,
        documentVersion: eventType === "DOCUMENT_UPDATE" ? derivedVersion : undefined,
    };
}

export function normalizeIncomingSyncEvent(input: Partial<SyncEventPayload> & { version?: number }): SyncEventPayload {
    const eventType = input.eventType === "DOCUMENT_STRUCTURE" ? "DOCUMENT_STRUCTURE" : "DOCUMENT_UPDATE";
    const derivedVersion =
        typeof input.documentVersion === "number"
            ? input.documentVersion
            : typeof input.version === "number"
                ? input.version
                : undefined;

    return {
        documentId: input.documentId ?? "",
        changes: (input.changes ?? {}) as Record<string, any>,
        eventType,
        documentVersion: eventType === "DOCUMENT_UPDATE" ? derivedVersion : undefined,
        userId: input.userId,
        timestamp: input.timestamp,
    };
}

export function hasAuthoritativeDocumentVersion(
    event: SyncEventPayload
): event is SyncEventPayload & { eventType: "DOCUMENT_UPDATE"; documentVersion: number } {
    return event.eventType === "DOCUMENT_UPDATE" && typeof event.documentVersion === "number";
}
