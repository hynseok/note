"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Editor } from "@/components/editor";
import { PropertyEditor } from "./property-editor";
import { useDatabase } from "@/hooks/use-database";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Maximize2, Smile, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Cover } from "@/components/cover";
import { CoverPicker } from "@/components/cover-picker";
import { IconPicker } from "@/components/icon-picker";
import TextareaAutosize from "react-textarea-autosize";
import { cn } from "@/lib/utils";
import { documentEvents } from "@/lib/events";
import { useDocumentSync } from "@/hooks/use-document-sync";
import { toast } from "sonner";

interface DocumentModalProps {
    documentId: string;
    isOpen: boolean;
    onClose: () => void;
}

export const DocumentModal = ({ documentId, isOpen, onClose }: DocumentModalProps) => {
    const router = useRouter();
    const { updateProperty } = useDatabase(documentId);
    const { broadcastUpdate, joinDocument, leaveDocument, subscribe } = useDocumentSync();

    // Document State
    const [title, setTitle] = useState("");
    const [icon, setIcon] = useState<string | null>(null);
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [content, setContent] = useState("");
    const [properties, setProperties] = useState<any>({});
    const [tagOptions, setTagOptions] = useState<{ id: string; label: string; color: string }[]>([]);
    const [parentDocumentId, setParentDocumentId] = useState<string | null>(null);
    const [version, setVersion] = useState(1);
    const [author, setAuthor] = useState<{ id: string; name: string | null; image: string | null } | null>(null);

    const [loading, setLoading] = useState(false);

    // Fetch Data
    useEffect(() => {
        if (isOpen && documentId) {
            setLoading(true);
            // Join the document room for real-time updates
            joinDocument(documentId);

            fetch(`/api/documents/${documentId}`)
                .then(res => res.json())
                .then(data => {
                    // Treat "Untitled" as empty string for placeholder behavior
                    setTitle(data.title === "Untitled" ? "" : data.title);
                    setIcon(data.icon);
                    setCoverImage(data.coverImage);
                    setContent(data.content);
                    setVersion(data.version || 1);
                    setAuthor(data.user);
                    try {
                        setProperties(data.properties ? JSON.parse(data.properties) : {});
                    } catch {
                        setProperties({});
                    }

                    // Fetch sibling documents to get available tags
                    if (data.parentDocumentId) {
                        setParentDocumentId(data.parentDocumentId);
                        fetch(`/api/documents/${data.parentDocumentId}`)
                            .then(res => res.json())
                            .then(parent => {
                                if (parent.properties) {
                                    try {
                                        const parentProps = JSON.parse(parent.properties);
                                        if (parentProps.tagOptions && Array.isArray(parentProps.tagOptions)) {
                                            setTagOptions(parentProps.tagOptions);
                                        }
                                    } catch (e) {
                                        // ignore
                                    }
                                }
                            });
                    }
                })
                .finally(() => setLoading(false));

            // Subscribe to remote updates
            const unsubscribeSocket = subscribe((update) => {
                if (update.documentId !== documentId) return;

                console.log("[Modal Real-time] Received remote update", update);

                // Update local state with remote changes
                if (update.changes.title !== undefined) {
                    const newTitle = update.changes.title;
                    setTitle(newTitle === "Untitled" ? "" : newTitle);
                }
                if (update.changes.icon !== undefined) setIcon(update.changes.icon);
                if (update.changes.coverImage !== undefined) setCoverImage(update.changes.coverImage);
                if (update.changes.content !== undefined) {
                    setContent(update.changes.content);
                    // Emit event for Editor component to pick up if needed, though we pass content directly
                    // The Editor component needs to handle this prop change or event
                    documentEvents.emit({ type: "REMOTE_CONTENT_UPDATE", documentId, content: update.changes.content });
                }
                if (update.changes.properties !== undefined) {
                    setProperties(update.changes.properties);
                }

                if (update.version) setVersion(update.version);
            });

            return () => {
                leaveDocument(documentId);
                unsubscribeSocket();
            };
        }
    }, [isOpen, documentId, joinDocument, leaveDocument, subscribe]);

    // Update Logic with WebSocket broadcast
    const updateDocument = async (values: { title?: string; content?: string; icon?: string | null; coverImage?: string | null }) => {
        try {
            const response = await fetch(`/api/documents/${documentId}`, {
                method: "PATCH",
                body: JSON.stringify({ ...values, version }),
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

            // Broadcast via WebSocket to the document itself
            broadcastUpdate(documentId, values, updatedDoc.version);

            // CRITICAL: Also broadcast to the PARENT document so the page link/calendar updates
            if (parentDocumentId) {
                broadcastUpdate(parentDocumentId, { childUpdated: documentId }, Date.now());
            }

            // Local event for sidebar
            documentEvents.emit({ type: "UPDATE_TITLE", id: documentId, ...values });
        } catch (error) {
            console.error("Failed to update document:", error);
            toast.error("Failed to save changes");
        }
    };

    const onContentChange = (newContent: string) => {
        setContent(newContent);
        // Debounce content save
        if (debouncedUpdate.current) {
            clearTimeout(debouncedUpdate.current);
        }
        debouncedUpdate.current = setTimeout(() => {
            updateDocument({ content: newContent });
        }, 1000); // 1s debounce for content
    };

    // Custom debounce function
    const debouncedUpdate = useRef<NodeJS.Timeout | null>(null);

    const onTitleChange = useCallback((newTitle: string) => {
        setTitle(newTitle);

        // Clear previous timeout
        if (debouncedUpdate.current) {
            clearTimeout(debouncedUpdate.current);
        }

        // Set new timeout
        debouncedUpdate.current = setTimeout(() => {
            // Save as empty string if empty, don't force "Untitled" string in DB if we want true placeholder behavior
            // But if we want to be safe, we can save "Untitled" if strictly empty? 
            // Standard is usually saving empty string and handling display. 
            // Existing sidebar code handles empty string | "Untitled".
            updateDocument({ title: newTitle });
        }, 500);
    }, [updateDocument]);

    const handleTitleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onTitleChange(e.target.value);
    };

    const onIconSelect = (icon: string) => {
        setIcon(icon);
        updateDocument({ icon });
    };

    const onRemoveIcon = () => {
        setIcon(null);
        updateDocument({ icon: null });
    };

    const onChangeCover = (url: string) => {
        setCoverImage(url);
        updateDocument({ coverImage: url });
    };

    const onRemoveCover = () => {
        setCoverImage(null);
        updateDocument({ coverImage: null });
    };

    const handlePropertyUpdate = async (newProperties: any) => {
        setProperties(newProperties);

        try {
            // Update via API with version check
            const response = await fetch(`/api/documents/${documentId}`, {
                method: "PATCH",
                body: JSON.stringify({ properties: newProperties, version }),
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

            // Broadcast property update via WebSocket
            broadcastUpdate(documentId, { properties: newProperties }, updatedDoc.version);

            // CRITICAL: Also broadcast to the PARENT document so the calendar view updates date/tags
            if (parentDocumentId) {
                broadcastUpdate(parentDocumentId, { childUpdated: documentId }, Date.now());
                // Also emit local event for the current user's view (if they are viewing the parent)
                documentEvents.emit({ type: "CHILD_UPDATED", parentId: parentDocumentId, childId: documentId });
            }
        } catch (error) {
            console.error("Failed to update properties:", error);
            toast.error("Failed to save properties");
        }
    };

    const handleTagOptionsUpdate = async (newOptions: { id: string; label: string; color: string }[]) => {
        setTagOptions(newOptions);
        if (parentDocumentId) {
            // Fetch parent to get current properties and merge
            try {
                const res = await fetch(`/api/documents/${parentDocumentId}`);
                const parent = await res.json();
                const parentProps = parent.properties ? JSON.parse(parent.properties) : {};

                // Update tagOptions in parent
                await fetch(`/api/documents/${parentDocumentId}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        properties: {
                            ...parentProps,
                            tagOptions: newOptions
                        }
                    })
                });
                documentEvents.emit({ type: "UPDATE_TAGS", id: parentDocumentId });
            } catch (error) {
                console.error("Failed to update parent tag options", error);
            }
        }
    };

    const handleOpenPage = () => {
        onClose();
        router.push(`/documents/${documentId}`);
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                onPointerDownOutside={(e) => {
                    const target = e.target as HTMLElement;
                    if (target?.closest('[data-radix-popper-content-wrapper]')) {
                        e.preventDefault();
                    }
                }}
                className="max-w-4xl w-full h-[85vh] overflow-hidden flex flex-col p-0 gap-0 bg-white dark:bg-[#1F1F1F]"
            >
                <DialogTitle className="sr-only">Edit Document</DialogTitle>

                <div className="flex-1 overflow-y-auto w-full">
                    {/* Cover Image Area */}
                    <div className="relative group w-full shrink-0">
                        <Cover
                            url={coverImage || undefined}
                            preview={false}
                            onChange={onChangeCover}
                            onRemove={onRemoveCover}
                        />
                        {/* Header Buttons */}
                        <div className="absolute top-2.5 right-8 z-50 flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs h-7"
                                onClick={handleOpenPage}
                            >
                                Open as Page
                                <Maximize2 className="h-3 w-3 ml-2" />
                            </Button>
                        </div>
                    </div>

                    <div className="max-w-3xl mx-auto pb-32 px-10">
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                            </div>
                        ) : (
                            <div className="group relative">
                                {/* Icon & Controls */}
                                <div className={cn("pb-4", coverImage ? "pt-0" : "pt-12")}>
                                    {/* Icon Display */}
                                    {!!icon && (
                                        <div className={cn(
                                            "flex items-center gap-x-2 pt-2 mb-2 relative z-10 group/icon",
                                            coverImage && "-mt-12"
                                        )}>
                                            <IconPicker onChange={onIconSelect}>
                                                <p className="text-6xl hover:opacity-75 transition cursor-pointer">
                                                    {icon}
                                                </p>
                                            </IconPicker>
                                            <Button
                                                onClick={onRemoveIcon}
                                                className="rounded-full opacity-0 group-hover/icon:opacity-100 transition text-muted-foreground text-xs"
                                                variant="ghost"
                                                size="icon"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}

                                    {/* Controls (Add icon / Add cover) */}
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
                                        {!coverImage && (
                                            <CoverPicker asChild onChange={onChangeCover}>
                                                <Button className="text-muted-foreground text-xs" variant="ghost" size="sm">
                                                    <ImageIcon className="h-4 w-4 mr-2" />
                                                    Add cover
                                                </Button>
                                            </CoverPicker>
                                        )}
                                    </div>

                                    {/* Title Input */}
                                    <TextareaAutosize
                                        value={title}
                                        onChange={handleTitleInputChange}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                if (e.nativeEvent.isComposing) {
                                                    return;
                                                }
                                                e.preventDefault();
                                                // Find the editor within this dialog
                                                const dialog = e.currentTarget.closest('[role="dialog"]');
                                                if (dialog) {
                                                    const editor = dialog.querySelector('.ProseMirror') as HTMLElement;
                                                    if (editor) {
                                                        editor.focus();
                                                    }
                                                }
                                            }
                                        }}
                                        className="w-full text-4xl font-bold bg-transparent outline-none resize-none placeholder:text-muted-foreground/50 border-none px-0 py-2 break-words text-[#3F3F3F] dark:text-[#CFCFCF]"
                                        placeholder="Untitled"
                                    />
                                </div>

                                {/* Properties */}
                                <div className="mt-2 mb-8">
                                    <PropertyEditor
                                        properties={properties}
                                        tagOptions={tagOptions}
                                        onUpdate={handlePropertyUpdate}
                                        onTagOptionsUpdate={handleTagOptionsUpdate}
                                        author={author}
                                    />
                                </div>

                                {/* Editor */}
                                <div className="-ml-4 pl-4 border-t border-neutral-200 dark:border-neutral-800 pt-8">
                                    <Editor
                                        documentId={documentId}
                                        initialContent={content}
                                        editable={true}
                                        onChange={onContentChange}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
