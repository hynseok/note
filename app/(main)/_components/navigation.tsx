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

export const Navigation = () => {
    const router = useRouter();
    const { data: session } = useSession();
    const search = useSearch();
    const settingsStore = useSettings();
    const social = useSocial();

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
        <aside className="group/sidebar h-full bg-[#FAFAFA] dark:bg-[#2B2B2B] overflow-y-auto relative flex w-60 flex-col z-[99999] border-r border-neutral-200 dark:border-neutral-700">
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

            <div
                className="opacity-0 group-hover/sidebar:opacity-100 transition cursor-ew-resize absolute h-full w-1 right-0 top-0 bg-primary/10"
            />
        </aside>
    )
}
