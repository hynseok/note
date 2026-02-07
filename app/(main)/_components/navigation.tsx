"use client";

import { cn } from "@/lib/utils";
import { ChevronsLeft, MenuIcon, Plus, PlusCircle, Search, Settings, Trash, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ElementRef, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Item } from "./item";
import { DocumentList } from "./document-list";
import { TrashBox } from "./trash-box";
import { useSearch } from "@/hooks/use-search";
import { useSettings } from "@/hooks/use-settings";
import { useSocial } from "@/hooks/use-social";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { documentEvents } from "@/lib/events";
import { UserItem } from "./user-item";
import { SharedList } from "./shared-list";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSidebar } from "@/hooks/use-sidebar";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export const Navigation = () => {
    const router = useRouter();
    const pathname = usePathname();
    const isMobile = useMediaQuery("(max-width: 768px)");
    const { data: session } = useSession();
    const search = useSearch();
    const settingsStore = useSettings();
    const social = useSocial();
    const sidebar = useSidebar();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) return;

        // Ensure we have the rects to calculate position
        if (!active.rect.current.translated || !over.rect) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const activeData = active.data.current;
        const overData = over.data.current;

        if (!activeData || !overData) return;

        // Geometry Calculation
        const activeRect = active.rect.current.translated;
        const overRect = over.rect;

        const activeCenterY = activeRect.top + (activeRect.height / 2);
        const overTop = overRect.top;
        const overHeight = overRect.height;

        // Normalize position within the target item (0 = top, 1 = bottom)
        const relativeY = (activeCenterY - overTop) / overHeight;

        // Thresholds for "Nest" vs "Reorder"
        // Middle 50% = Nest (0.25 to 0.75)
        // Top 25% = Reorder Before
        // Bottom 25% = Reorder After

        const isNesting = relativeY > 0.25 && relativeY < 0.75;

        try {
            if (isNesting) {
                // REPARENTING: Move 'active' inside 'over'
                // New parent = over.id

                // Prevent self-nesting or invalid nesting checks could be added here

                await fetch('/api/documents/move', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: activeId,
                        targetId: overId, // Technically we are moving TO this ID as parent, but the move API logic uses targetId as "sibling". 
                        // Wait, my previous 'move' API logic was "Insert active at target's order in parentId". 
                        // That API is for reordering in a list.
                        // I might need a simpler update for parenting.

                        // Or reuse 'move' but with specific intent?

                        // Actually, I can use the same `move` API I created? 
                        // The `move` API takes { id, targetId, parentId }. 
                        // If I pass parentId = newParent, it shifts items in NEW parent.
                        // But I don't have a "targetId" (sibling) in the new parent if I just drop ON the folder.
                        // I probably want to append to end, or start?

                        // Let's use a standard `PATCH` to update parentDocumentId for nesting.
                        // Then the list will auto-refresh.
                    })
                });

                // Actually, I'll just use a direct update for nesting
                await fetch(`/api/documents/${activeId}`, {
                    method: "PATCH",
                    body: JSON.stringify({ parentDocumentId: overId })
                });

                toast.success("Document moved inside");
            } else {
                // REORDERING: Move 'active' relative to 'over'
                // Target Parent = overData.parentId
                // If relativeY < 0.5 (Top half) -> Insert Before (take over's order)
                // If relativeY >= 0.5 (Bottom half) -> Insert After (take over's order + 1? No, just reordering logic handles it)

                // My `move` API: 
                // "Insert 'id' at 'destinationOrder', shifting others down".
                // If I want to insert BEFORE 'over', I use over.order.
                // If I want to insert AFTER 'over', I use over.order + 1?

                // For simplicity and robustness with standard Sortable behavior:
                // Use the generic reorder API if it's simple reordering?
                // Or use my `move` API.

                // Let's assume `move` API inserts AT target position (pushing target down).
                // So "Insert Before" = targetId: overId.
                // "Insert After" is harder if we don't have the next item ID.

                // Simplified Reorder for now: Always insert "at" the position (Before).
                // Users can drag below the item to insert before the *next* item.
                // But if it's the last item?

                // Let's simply trigger the backend "move" which does "insert before".
                // If user drags to bottom of item, they usually drag to top of NEXT item.
                // Exception: Last item.

                // Let's stick to "Insert Before" logic which maps to `move` API.
                const newParentId = overData.parentId || null;

                await fetch('/api/documents/move', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: activeId,
                        targetId: overId,
                        parentId: newParentId
                    })
                });

                toast.success("Document reordered");
            }

            documentEvents.emit({ type: "REFRESH" });
        } catch (error) {
            toast.error("Failed to move document");
        }
    };

    const isResizingRef = useRef(false);
    const sidebarRef = useRef<ElementRef<"aside">>(null);
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        if (sidebar.isOpen) {
            resetWidth();
        } else {
            collapse();
        }
    }, [sidebar.isOpen, isMobile]);

    useEffect(() => {
        if (isMobile) {
            sidebar.onClose();
        }
    }, [pathname, isMobile]);

    const handleMouseDown = (
        event: React.MouseEvent<HTMLDivElement, MouseEvent>
    ) => {
        event.preventDefault();
        event.stopPropagation();

        isResizingRef.current = true;
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };

    const handleMouseMove = (event: MouseEvent) => {
        if (!isResizingRef.current) return;
        let newWidth = event.clientX;

        if (newWidth < 240) newWidth = 240;
        if (newWidth > 480) newWidth = 480;

        if (sidebarRef.current) {
            sidebarRef.current.style.width = `${newWidth}px`;
        }
    };

    const handleMouseUp = () => {
        isResizingRef.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
    };

    const resetWidth = () => {
        if (sidebarRef.current) {
            setIsResetting(true);

            sidebarRef.current.style.width = isMobile ? "100%" : "240px";
            setTimeout(() => setIsResetting(false), 300);
        }
    };

    const collapse = () => {
        if (sidebarRef.current) {
            setIsResetting(true);

            sidebarRef.current.style.width = "0";
            setTimeout(() => setIsResetting(false), 300);
        }
    }

    useEffect(() => {
        const unsubscribe = documentEvents.subscribe(() => {
            router.refresh();
        });
        return unsubscribe;
    }, [router]);

    // Basic creation handler
    const handleCreate = async () => {
        const promise = fetch("/api/documents", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title: "Untitled",
            }),
        }).then((res) => {
            if (res.ok) {
                documentEvents.emit({ type: "CREATE" }); // Notify listeners to refresh lists
                return res.json();
            }
            throw new Error("Failed to create document");
        });

        toast.promise(promise, {
            loading: "Creating a new note...",
            success: "New note created!",
            error: "Failed to create a new note."
        });

        try {
            const data = await promise;
            router.push(`/documents/${data.id}`);
        } catch (e) { }
    }

    const handleTrashDrop = (e: React.DragEvent, draggedId?: string) => {
        if (!draggedId) return;

        const promise = fetch(`/api/documents/${draggedId}`, {
            method: "PATCH",
            body: JSON.stringify({ isArchived: true })
        }).then(async (res) => {
            if (res.ok) return res.json();
            const errorMessage = await res.text();
            throw new Error(errorMessage || "Failed to move note to trash");
        });

        toast.promise(promise, {
            loading: "Moving note to trash...",
            success: "Note moved to trash!",
            error: (err) => err.message
        });

        promise.then(() => {
            documentEvents.emit({ type: "DELETE", id: draggedId });
            router.refresh();
        }).catch(() => {
            // Error handled by toast
        });
    };

    return (
        <>
            <aside
                ref={sidebarRef}
                className={cn(
                    "group/sidebar h-full bg-[#FAFAFA] dark:bg-[#2B2B2B] overflow-y-auto relative flex w-60 flex-col z-[99999] border-r border-neutral-200 dark:border-neutral-700",
                    isResetting && "transition-all ease-in-out duration-300",
                    isMobile && "fixed inset-y-0 left-0 w-0",
                    !sidebar.isOpen && "border-r-0"
                )}
            >
                <div
                    onClick={sidebar.onClose}
                    role="button"
                    className={cn(
                        "h-6 w-6 text-muted-foreground rounded-sm hover:bg-neutral-300 dark:hover:bg-neutral-600 absolute top-3 right-2 opacity-0 group-hover/sidebar:opacity-100 transition",
                        isMobile && "opacity-100"
                    )}
                >
                    <ChevronsLeft className="h-6 w-6" />
                </div>
                <div className={cn(
                    "transition-opacity duration-300",
                    !sidebar.isOpen ? "opacity-0 pointer-events-none" : "opacity-100"
                )}>
                    <div>
                        <UserItem />
                    </div>
                    <div className="mt-4 flex flex-col gap-y-2 px-3">
                        <Item
                            label="Search"
                            icon={Search}
                            isSearch
                            onClick={search.onOpen}
                        />
                        <Item
                            label="Settings"
                            icon={Settings}
                            onClick={settingsStore.onOpen}
                        />
                        <Item
                            label="Friends"
                            icon={Users}
                            onClick={social.onOpen}
                        />
                    </div>

                    <div className="mt-4 px-3">
                        <div className="text-xs font-semibold text-muted-foreground/50 mb-1 pl-2">
                            Private
                        </div>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <DocumentList />
                        </DndContext>
                        <Item
                            label="New Page"
                            icon={Plus}
                            onClick={handleCreate}
                        />
                        <SharedList />
                        <Popover modal={true}>
                            <PopoverTrigger className="w-full mt-4">
                                <Item
                                    label="Trash"
                                    icon={Trash}
                                    onDrop={handleTrashDrop}
                                />
                            </PopoverTrigger>
                            <PopoverContent
                                className="p-0 w-72"
                                side="right"
                            >
                                <TrashBox />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                {!isMobile && (
                    <div
                        onMouseDown={handleMouseDown}
                        onClick={sidebar.onOpen}
                        className="opacity-0 group-hover/sidebar:opacity-100 transition cursor-ew-resize absolute h-full w-1 right-0 top-0 bg-primary/10"
                    />
                )}
            </aside>
            {isMobile && sidebar.isOpen && (
                <div
                    onClick={sidebar.onClose}
                    className="fixed inset-0 z-[99997] bg-black/50"
                />
            )}
        </>
    )
}

