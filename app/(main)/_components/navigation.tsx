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

export const Navigation = () => {
    const router = useRouter();
    const pathname = usePathname();
    const isMobile = useMediaQuery("(max-width: 768px)");
    const { data: session } = useSession();
    const search = useSearch();
    const settingsStore = useSettings();
    const social = useSocial();
    const sidebar = useSidebar();

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
                        <Item
                            label="New Page"
                            icon={PlusCircle}
                            onClick={handleCreate}
                        />
                    </div>

                    <div className="mt-4 px-3">
                        <div className="text-xs font-semibold text-muted-foreground/50 mb-1 pl-2">
                            Private
                        </div>
                        <DocumentList />
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

