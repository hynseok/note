"use client";

import { useEffect, useState } from "react";
import { File, Search, CornerDownLeft, ArrowUpDown, Type, User, Calendar, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { useSearch } from "@/hooks/use-search";

export const SearchCommand = () => {
    const { user } = useSession().data || {};
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]);

    const toggle = useSearch((store) => store.toggle);
    const isOpen = useSearch((store) => store.isOpen);
    const onClose = useSearch((store) => store.onClose);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Fetch documents when opened
    useEffect(() => {
        if (isOpen) {
            fetch("/api/documents?flatten=true")
                .then(res => res.json())
                .then(data => setDocuments(data));
        }
    }, [isOpen]);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                toggle();
            }
        }

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [toggle]);

    const onSelect = (id: string) => {
        router.push(`/documents/${id}`);
        onClose();
    };

    if (!isMounted) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="p-0 overflow-hidden bg-transparent border-none shadow-none max-w-[680px]">
                <DialogTitle className="sr-only">Search</DialogTitle>
                <Command className="rounded-xl border border-black/5 dark:border-white/10 shadow-xl bg-white dark:bg-[#252525] overflow-hidden">
                    <div className="relative">
                        <Search className="absolute top-[18px] left-4 h-5 w-5 text-[#888] dark:text-[#888]" />
                        <CommandInput placeholder="Search or ask a question in Notion..." />
                    </div>

                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup heading="Today">
                            {documents.map((document) => (
                                <CommandItem
                                    key={document.id}
                                    value={`${document.id}-${document.title}`}
                                    onSelect={() => onSelect(document.id)}
                                    className="group"
                                >
                                    <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                        {document.icon ? (
                                            <p className="mr-2 text-[18px]">
                                                {document.icon}
                                            </p>
                                        ) : (
                                            <File className="mr-2 h-4 w-4 text-muted-foreground" />
                                        )}

                                        <div className="flex flex-col truncate">
                                            <span className="truncate text-[14px] font-medium text-[#37352f] dark:text-[#d4d4d4]">
                                                {document.title}
                                            </span>
                                            {/* Mock breadcrumb for visualization */}
                                            <span className="text-[11px] text-[#9b9b9b] dark:text-[#8d8d8d] truncate">
                                                Private • {document.title}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-data-[selected=true]:opacity-100 transition-opacity">
                                        <CornerDownLeft className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>

                </Command>
            </DialogContent>
        </Dialog>
    )
}
