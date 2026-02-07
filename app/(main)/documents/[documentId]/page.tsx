"use client";

import { Editor } from "@/components/editor";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Navbar } from "../../_components/navbar";
import { Button } from "@/components/ui/button";
import { FileIcon, ImageIcon, Smile, X } from "lucide-react";
import { IconPicker } from "@/components/icon-picker";
import { Cover } from "@/components/cover";
import { CoverPicker } from "@/components/cover-picker";
import { documentEvents, setActiveExpandIds } from "@/lib/events";
import { cn } from "@/lib/utils";
import { CalendarView } from "@/components/database/calendar-view";
import { useDatabase } from "@/hooks/use-database";
import { useDocumentSync } from "@/hooks/use-document-sync";
import { useSession } from "next-auth/react";
import { ConflictBanner } from "@/components/conflict-banner";

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func(...args);
            // We removed the generic emit here to rely on specific events for title, 
            // but we can keep a generic 'SAVED' event if needed. 
            // For now, let's keep it minimal to avoid double-refreshing.
            // documentEvents.emit({ type: "SAVED" }); 
        }, wait);
    };
}

export default function DocumentIdPage({
    params
}: {
    params: Promise<{ documentId: string }>
}) {
    const router = useRouter();
    const [documentId, setDocumentId] = useState<string>("");
    const { data: session } = useSession(); // Access session to check userId

    useEffect(() => {
        params.then((p) => setDocumentId(p.documentId));
    }, [params]);

    const [title, setTitle] = useState("");
    const [icon, setIcon] = useState<string | null>(null);
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [content, setContent] = useState("");
    const [childrenDocs, setChildrenDocs] = useState<any[]>([]); // Add type later if needed
    const [tagOptions, setTagOptions] = useState<any[]>([]);
    const [parentDocument, setParentDocument] = useState<any>(null);
    const [permission, setPermission] = useState("READ");
    const [isDatabase, setIsDatabase] = useState(false);
    const [loading, setLoading] = useState(true);
    const [version, setVersion] = useState(1);
    const [showConflict, setShowConflict] = useState(false);

    const { moveItem, createItem } = useDatabase(documentId);
    const { subscribe, broadcastUpdate, joinDocument, leaveDocument, isConnected } = useDocumentSync();

    // Use a ref for version to avoid stale closures in the debounced function
    const versionRef = useRef(version);
    useEffect(() => {
        versionRef.current = version;
    }, [version]);

    // Debounced update function with version control and WebSocket broadcast
    const updateDocument = useMemo(
        () =>
            debounce(async (values: { title?: string; content?: string; icon?: string | null; coverImage?: string | null }) => {
                if (!documentId) return;

                try {
                    const response = await fetch(`/api/documents/${documentId}`, {
                        method: "PATCH",
                        body: JSON.stringify({ ...values, version: versionRef.current }),
                        headers: { 'Content-Type': 'application/json' },
                        keepalive: true
                    });

                    if (!response.ok) {
                        if (response.status === 409) {
                            // Conflict detected
                            const conflictData = await response.json();
                            console.warn("Document conflict detected", conflictData);
                            setShowConflict(true);
                            toast.error("Document was modified by another user");
                            return;
                        }
                        throw new Error("Failed to update document");
                    }

                    const updatedDoc = await response.json();
                    setVersion(updatedDoc.version);

                    // Broadcast update via WebSocket
                    broadcastUpdate(documentId, values, updatedDoc.version);
                } catch (error) {
                    console.error("Error updating document:", error);
                    toast.error("Failed to save changes");
                }
            }, 200),
        [documentId, broadcastUpdate]
    );

    // Fetch initial data
    useEffect(() => {
        if (!documentId) return;

        const fetchDocument = async () => {
            const res = await fetch(`/api/documents/${documentId}`);
            if (!res.ok) return;
            const data = await res.json();
            setTitle(data.title === "Untitled" ? "" : data.title);
            setIcon(data.icon);
            setCoverImage(data.coverImage);
            setContent(data.content);
            setChildrenDocs(data.childDocuments || []);
            setParentDocument(data.parentDocument || null);
            setPermission(data.currentUserPermission || "READ");
            setIsDatabase(data.isDatabase || false);
            setVersion(data.version || 1); // Track document version

            // Extract tag options
            try {
                if (data.properties) {
                    const props = JSON.parse(data.properties);
                    if (props.tagOptions) {
                        setTagOptions(props.tagOptions);
                    }
                }
            } catch (e) {
                // Ignore json parse error
            }

            setLoading(false);

            // Auto-expand sidebar
            const expandIds: string[] = [];
            let current = data.parentDocument;
            while (current) {
                expandIds.push(current.id);
                current = current.parentDocument;
            }
            if (expandIds.length > 0) {
                import("@/lib/events").then(({ setActiveExpandIds }) => {
                    setActiveExpandIds(expandIds);
                    documentEvents.emit({ type: "EXPAND", ids: expandIds });
                });
            }
        };

        fetchDocument();

        // Join WebSocket room for real-time updates
        joinDocument(documentId);

        // Subscribe to external updates (sidebar creation + WebSocket updates)
        const unsubscribe = documentEvents.subscribe((payload: any) => {
            if (payload.type === "CREATE_CHILD" && payload.parentId === documentId) {
                setTimeout(fetchDocument, 200);
            }

            if (payload.type === "CONTENT_REFRESH" && payload.documentId === documentId) {
                fetchDocument();
            }

            // Listen for child update events from DocumentModal (local update)
            if (payload.type === "CHILD_UPDATED" && payload.parentId === documentId) {
                console.log("[Local Event] Child updated, refreshing parent", documentId);
                fetchDocument();
            }

            if (payload.type === "DELETE") {
                const { id } = payload;
                if (!id) return;
                // If a child is deleted, refresh logic is handled via other means, but good to keep in mind
            }

            // Ignore expansion events
            if (payload && payload.type === "EXPAND") {
                return;
            }

            // If it's a title/icon update for current document, ignore (already updated optimistically)
            if (payload && payload.type === "UPDATE_TITLE" && payload.id === documentId) {
                return;
            }

            // Re-fetch for child updates or external changes
            fetchDocument();
        });

        // Listen for Optimistic Link Deletion (from Sidebar DnD)
        // This ensures immediate removal of the link when a child is moved out
        const optimisticUnsubscribe = documentEvents.subscribe((payload: any) => {
            if (payload.type === "OPTIMISTIC_LINK_DELETE") {
                if (payload.parentId === documentId) {
                    documentEvents.emit({ type: "DELETE", id: payload.childId });
                }
            }
        });

        // Subscribe to WebSocket remote updates
        const unsubscribeSocket = subscribe((update) => {
            if (update.documentId !== documentId) return;

            console.log("[Real-time] Received remote update", update);

            // Skip toast/update if it's from the current user (echo)
            const currentUserId = (session?.user as any)?.id || session?.user?.email;
            const isOwnUpdate = update.userId && currentUserId && update.userId === currentUserId;

            if (isOwnUpdate) {
                console.log("[Real-time] Ignoring own update echo");
                return;
            }

            // Update local state with remote changes
            if (update.changes.title !== undefined) {
                const newTitle = update.changes.title;
                setTitle(newTitle === "Untitled" ? "" : newTitle);
            }
            if (update.changes.icon !== undefined) {
                setIcon(update.changes.icon);
            }
            if (update.changes.coverImage !== undefined) {
                setCoverImage(update.changes.coverImage);
            }
            if (update.changes.childLeft) {
                // Surgical removal via event
                documentEvents.emit({ type: "DELETE", id: update.changes.childLeft });
                // Update local state silently
                if (update.changes.content !== undefined) {
                    setContent(update.changes.content);
                }
            } else if (update.changes.content !== undefined) {
                setContent(update.changes.content);
                // Notify editor to update
                documentEvents.emit({ type: "REMOTE_CONTENT_UPDATE", documentId, content: update.changes.content });
            }
            if (update.changes.isDatabase !== undefined) {
                setIsDatabase(update.changes.isDatabase);
            }
            if (update.changes.properties !== undefined) {
                // Properties updated from modal - trigger a refetch to update child list
                fetchDocument();
            }
            if (update.changes.childCreated || update.changes.childUpdated) {
                // Child item created/updated in calendar - refetch to show in list
                fetchDocument();
                // FORCE EDITOR REFRESH because parent content likely changed (new link added by server)
                documentEvents.emit({ type: "CONTENT_REFRESH", documentId });
            }

            // Update version
            setVersion(update.version);

            // Show notification (subtle)
            toast.info("Document updated by another user", { duration: 2000 });
        });

        // Listen for document deletion event
        const handleDocumentDeleted = (event: CustomEvent) => {
            const { documentId: deletedDocId } = event.detail;
            if (deletedDocId === documentId) {
                toast.error("This document was deleted by the owner");
                router.push("/documents");
            }
        };

        window.addEventListener('document-deleted', handleDocumentDeleted as EventListener);

        return () => {
            unsubscribe();
            unsubscribeSocket();
            leaveDocument(documentId);
            window.removeEventListener('document-deleted', handleDocumentDeleted as EventListener);
        };
    }, [documentId, joinDocument, leaveDocument, subscribe]);

    const onTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        // Optimistic update: notify listeners immediately
        documentEvents.emit({ type: "UPDATE_TITLE", id: documentId, title: newTitle });
        updateDocument({ title: newTitle });
    };

    const onContentChange = (content: string) => {
        setContent(content);
        updateDocument({ content });
        // Emit update so sidebar knows content changed (for icon switching)
        documentEvents.emit({ type: "UPDATE_TITLE", id: documentId, content });
    };

    const onIconSelect = (icon: string) => {
        setIcon(icon);
        updateDocument({ icon });
        // Emit update for sidebar
        documentEvents.emit({ type: "UPDATE_TITLE", id: documentId, icon });
    };

    const onRemoveIcon = () => {
        setIcon(null);
        updateDocument({ icon: null });
        documentEvents.emit({ type: "UPDATE_TITLE", id: documentId, icon: null });
    };

    const onChangeCover = (url: string) => {
        setCoverImage(url);
        updateDocument({ coverImage: url });
    };

    const onRemoveCover = () => {
        setCoverImage(null);
        updateDocument({ coverImage: null });
    };

    // Optimized loading: eliminate full-page skeleton flicker.
    // We only show skeleton if we have NO data at all.
    // If we are just switching documents, the transition should be instant if possible,
    // or we show a very subtle loader.

    // For now, let's keep the hook simple but remove the "loading" state return 
    // that blocks the whole UI. We'll render the component with defaults and let it fill in.
    // This is better for perceived performance.

    const canEdit = permission === "OWNER" || permission === "EDIT";

    const onToggleDatabase = async () => {
        const newValue = !isDatabase;
        setIsDatabase(newValue);

        try {
            const response = await fetch(`/api/documents/${documentId}`, {
                method: "PATCH",
                body: JSON.stringify({ isDatabase: newValue, version }),
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                if (response.status === 409) {
                    toast.error("Document was modified by another user");
                    return;
                }
                throw new Error("Failed to update");
            }

            const updatedDoc = await response.json();
            setVersion(updatedDoc.version);

            // Broadcast via WebSocket
            broadcastUpdate(documentId, { isDatabase: newValue }, updatedDoc.version);

            toast.success(newValue ? "Switched to Database view" : "Switched to Page view");
        } catch (error) {
            console.error("Failed to toggle database view:", error);
            toast.error("Failed to switch view");
        }
    };

    const handleViewLatest = async () => {
        // Refetch document to get latest version
        const res = await fetch(`/api/documents/${documentId}`);
        if (res.ok) {
            const data = await res.json();
            setTitle(data.title === "Untitled" ? "" : data.title);
            setIcon(data.icon);
            setCoverImage(data.coverImage);
            setContent(data.content);
            setVersion(data.version || 1);
            setShowConflict(false);
            toast.success("Document refreshed with latest version");
        }
    };

    return (
        <>
            {showConflict && (
                <ConflictBanner
                    onViewLatest={handleViewLatest}
                    onDismiss={() => setShowConflict(false)}
                />
            )}
            <Navbar
                documentId={documentId}
                title={title}
                icon={icon}
                parentDocument={parentDocument}
                isDatabase={isDatabase}
                onToggleDatabase={canEdit ? onToggleDatabase : undefined}
            />
            <Cover url={coverImage || undefined} preview={!canEdit} onChange={onChangeCover} onRemove={onRemoveCover} />
            <div className="pb-40">
                <div className={cn(
                    "mx-auto px-12 md:px-24",
                    isDatabase ? "max-w-full" : "md:max-w-5xl lg:max-w-6xl"
                )}>
                    <div className="group relative">
                        {/* Add Icon / Cover Placeholders here */}
                        <div className={cn(
                            "pb-4",
                            coverImage ? "pt-0" : "pt-20"
                        )}>
                            {!loading && canEdit && (
                                <div className={cn(
                                    "opacity-0 group-hover:opacity-100 transition flex items-center gap-x-1 mb-2",
                                    coverImage && "mt-4"
                                )}>
                                    {!icon && (
                                        <IconPicker asChild onChange={onIconSelect}>
                                            <Button className="text-muted-foreground text-xs" variant="ghost" size="sm">
                                                <Smile className="h-4 w-4 mr-2" />
                                                Add icon
                                            </Button>
                                        </IconPicker>
                                    )}
                                    {!coverImage && !icon && (
                                        <CoverPicker asChild onChange={onChangeCover}>
                                            <Button className="text-muted-foreground text-xs" variant="ghost" size="sm">
                                                <ImageIcon className="h-4 w-4 mr-2" />
                                                Add cover
                                            </Button>
                                        </CoverPicker>
                                    )}
                                </div>
                            )}
                            {!!icon && (
                                <div className={cn(
                                    "p-1 group/icon flex flex-col items-start gap-y-2 pt-2 mb-2 relative z-10",
                                    coverImage && "-mt-12"
                                )}>
                                    <div className="flex items-center gap-x-2">
                                        {canEdit ? (
                                            <IconPicker onChange={onIconSelect}>
                                                <p className="text-6xl hover:opacity-75 transition" role="button">
                                                    {icon}
                                                </p>
                                            </IconPicker>
                                        ) : (
                                            <p className="text-6xl transition">
                                                {icon}
                                            </p>
                                        )}
                                        {canEdit && (
                                            <Button
                                                onClick={onRemoveIcon}
                                                className="rounded-full opacity-0 group-hover/icon:opacity-100 transition text-muted-foreground text-xs"
                                                variant="ghost"
                                                size="icon"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {!coverImage && canEdit && (
                                        <div className="opacity-0 group-hover:opacity-100 transition">
                                            <CoverPicker asChild onChange={onChangeCover}>
                                                <Button className="text-muted-foreground text-xs" variant="ghost" size="sm">
                                                    <ImageIcon className="h-4 w-4 mr-2" />
                                                    Add cover
                                                </Button>
                                            </CoverPicker>
                                        </div>
                                    )}
                                </div>
                            )}
                            <TextareaAutosize
                                id="document-title"
                                value={title}
                                onChange={onTitleChange}
                                disabled={!canEdit}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        if (e.nativeEvent.isComposing) {
                                            return;
                                        }
                                        e.preventDefault();
                                        const editor = document.querySelector('.ProseMirror') as HTMLElement;
                                        if (editor) {
                                            editor.focus();
                                        }
                                    }
                                }}
                                className="w-full text-5xl bg-transparent font-bold break-words outline-none text-[#3F3F3F] dark:text-[#CFCFCF] resize-none disabled:opacity-50"
                                placeholder="Untitled"
                            />
                        </div>
                    </div>
                    <div className="pl-2">
                        {/* Database View or Editor */}
                        {!loading && (
                            isDatabase ? (
                                <div className="mt-4">
                                    <CalendarView
                                        documents={childrenDocs}
                                        tagOptions={tagOptions}
                                        onMoveItem={moveItem}
                                        onCreateItem={createItem}
                                    />
                                    {/* Optional: Show editor below database? Or hide it? Notion hides it usually unless opened as page */}
                                    <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-800">
                                        <p className="text-sm text-muted-foreground mb-2">Description</p>
                                        <Editor
                                            documentId={documentId}
                                            onChange={onContentChange}
                                            initialContent={content}
                                            editable={canEdit}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <Editor
                                    documentId={documentId}
                                    onChange={onContentChange}
                                    initialContent={content}
                                    editable={canEdit}
                                />
                            )
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
