"use client";

import {
    ChevronDown,
    ChevronRight,
    LucideIcon,
    MoreHorizontal,
    Plus,
    Trash
} from "lucide-react";
import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSidebar } from "@/hooks/use-sidebar";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { useSession } from "next-auth/react";
import { documentEvents } from "@/lib/events";

interface ItemProps {
    id?: string;
    documentIcon?: string;
    active?: boolean;
    expanded?: boolean;
    isSearch?: boolean;
    level?: number;
    onExpand?: () => void;
    label: string;
    onClick?: () => void;
    icon: LucideIcon;
};

export const Item = ({
    id,
    label,
    onClick,
    icon: Icon,
    active,
    documentIcon,
    isSearch,
    level = 0,
    onExpand,
    expanded,
    onDrop,
    dropEffect = "move",
}: ItemProps & { onDrop?: (e: React.DragEvent, draggedId?: string) => void, dropEffect?: "move" | "copy" | "link" | "none" }) => {
    const { data: session } = useSession();
    const router = useRouter();
    const params = useParams();

    const [isDragOver, setIsDragOver] = useState(false);
    const [lastEditedBy, setLastEditedBy] = useState<string | null>(null);

    const fetchLastEditor = useCallback(async () => {
        if (!id) return;
        try {
            const res = await fetch(`/api/documents/${id}`);
            if (res.ok) {
                const doc = await res.json();
                setLastEditedBy(doc.lastEditedBy?.name || doc.user?.name || "Unknown");
            }
        } catch (e) {
            console.error("Failed to fetch last editor", e);
        }
    }, [id]);

    const sidebar = useSidebar();
    const isMobile = useMediaQuery("(max-width: 768px)");

    const handleExpand = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        event.stopPropagation();
        onExpand?.();
    };

    const onClickHandler = () => {
        if (onClick) onClick();
        if (isMobile) {
            sidebar.onClose();
        }
    };

    const handleDragStart = (e: React.DragEvent, itemId: string) => {
        // Set the document ID for cross-component drag support
        e.dataTransfer.setData("application/x-privatenote-document-id", itemId);
        // Set as "sidebar" source to differentiate from editor drags
        e.dataTransfer.setData("application/x-privatenote-source", "sidebar");
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = dropEffect;
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        let draggedId = e.dataTransfer.getData("application/x-privatenote-document-id");

        // Fallback: try to extract from HTML (for editor drags)
        if (!draggedId) {
            const html = e.dataTransfer.getData("text/html");
            if (html && html.includes("page-link")) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                const element = doc.querySelector("page-link");
                draggedId = element?.getAttribute("id") || "";
            }
        }

        // Custom onDrop handler if provided (e.g., for Trash)
        if (onDrop) {
            onDrop(e, draggedId);
            return;
        }

        // Prevent dropping onto self
        if (!draggedId || draggedId === id) {
            return;
        }

        // Update parent relationship
        const promise = fetch(`/api/documents/${draggedId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentDocumentId: id })
        }).then(async (res) => {
            if (res.ok) return res.json();
            const errorText = await res.text();
            if (errorText.includes("descendant")) {
                throw new Error("Cannot move a parent into its child");
            }
            throw new Error("Failed to move note");
        });

        toast.promise(promise, {
            loading: "Moving note...",
            success: "Note moved!",
            error: (err) => err.message
        });

        try {
            const data = await promise;
            const currentDocId = params?.documentId as string | undefined;

            // Give server time to update content, then refresh affected editors
            setTimeout(() => {
                // Refresh new parent (where note was dropped)
                documentEvents.emit({ type: "CONTENT_REFRESH", documentId: id });
                // Refresh current editor (where note was removed from)
                if (currentDocId && currentDocId !== id) {
                    documentEvents.emit({ type: "CONTENT_REFRESH", documentId: currentDocId });
                }
            }, 200);

            // Update sidebar immediately
            documentEvents.emit({ type: "UPDATE" });
            router.refresh();
            // Expand parent to show the moved child
            if (!expanded) {
                onExpand?.();
            }
        } catch (error) {
            // Toast handled
        }
    };

    const onCreate = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        event.stopPropagation();
        if (!id) return;

        // Check if parent document is currently open in editor
        const isParentActive = params?.documentId === id;

        const promise = fetch("/api/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: "Untitled",
                parentDocumentId: id
            })
        }).then((res) => {
            if (res.ok) return res.json();
            throw new Error("Failed to create note");
        });

        toast.promise(promise, {
            loading: "Creating note...",
            success: "Note created!",
            error: "Failed to create note."
        });

        promise.then((data) => {
            if (!expanded) {
                onExpand?.();
            }

            // Emit content refresh for parent editor to show new link
            if (isParentActive) {
                documentEvents.emit({
                    type: "CREATE_CHILD",
                    parentId: id,
                    child: { id: data.id, title: data.title }
                });
            }

            documentEvents.emit({ type: "UPDATE" });
            router.refresh();
        });
    };

    const onArchive = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        event.stopPropagation();
        if (!id) return;

        const promise = fetch(`/api/documents/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isArchived: true })
        }).then(async (res) => {
            if (res.ok) return res.json();
            const errorMessage = await res.text();
            throw new Error(errorMessage || "Failed to delete note");
        });

        toast.promise(promise, {
            loading: "Moving to trash...",
            success: "Note moved to trash!",
            error: (err) => err.message
        });

        promise.then(() => {
            documentEvents.emit({ type: "DELETE", id });
            router.refresh();
        }).catch(() => {
            // Error handled by toast
        });
    };

    const ChevronIcon = expanded ? ChevronDown : ChevronRight;

    return (
        <div
            onClick={onClickHandler}
            role="button"
            draggable={!!id}
            onDragStart={(e) => id && handleDragStart(e, id)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
                paddingLeft: level ? `${(level * 12) + 12}px` : "12px"
            }}
            className={cn(
                "group min-h-[27px] text-sm py-1 pr-3 w-full hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center text-muted-foreground font-medium transition-colors",
                active && "bg-neutral-100 dark:bg-neutral-800 text-primary font-semibold",
                isDragOver && "bg-neutral-200 dark:bg-neutral-700 ring-2 ring-primary/20"
            )}
        >
            {!!id && (
                <div
                    role="button"
                    className="h-full rounded-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 mr-1"
                    onClick={handleExpand}
                    onDragStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    draggable
                >
                    <ChevronIcon className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </div>
            )}

            {documentIcon ? (
                <div className="shrink-0 mr-2 text-[18px]">
                    {documentIcon}
                </div>
            ) : (
                <Icon className="shrink-0 h-[18px] w-[18px] mr-2 text-muted-foreground" />
            )}

            <span className="truncate">
                {label}
            </span>

            {isSearch && (
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 border-b border-black/5">
                    <span className="text-xs">⌘</span>K
                </kbd>
            )}

            {!!id && (
                <div className="ml-auto flex items-center gap-x-2">
                    <DropdownMenu onOpenChange={(open) => { if (open) fetchLastEditor(); }}>
                        <DropdownMenuTrigger
                            onClick={(e) => e.stopPropagation()}
                            asChild
                        >
                            <div
                                role="button"
                                className="opacity-0 group-hover:opacity-100 h-full ml-auto rounded-sm hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            >
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            className="w-60"
                            align="start"
                            side="right"
                            forceMount
                        >
                            <DropdownMenuItem onClick={onArchive}>
                                <Trash className="h-4 w-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <div className="text-xs text-muted-foreground p-2">
                                Last edited by: {lastEditedBy || "Loading..."}
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <div
                        role="button"
                        onClick={onCreate}
                        className="opacity-0 group-hover:opacity-100 h-full ml-auto rounded-sm hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    >
                        <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                </div>
            )}
        </div>
    );
};

Item.Skeleton = function ItemSkeleton({ level }: { level?: number }) {
    return (
        <div
            style={{
                paddingLeft: level ? `${(level * 12) + 25}px` : "12px"
            }}
            className="flex gap-x-2 py-[3px]"
        >
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-[30%]" />
        </div>
    )
}
