"use client";

import { MenuIcon, FileIcon, FileText, Layout } from "lucide-react";
import { Title } from "./title";
import Link from "next/link";
import { SharePopover } from "@/components/share-popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";

interface NavbarProps {
    documentId?: string;
    title?: string;
    icon?: string | null;
    parentDocument?: { id: string, title: string, icon: string | null } | null;
    isDatabase?: boolean;
    onToggleDatabase?: () => void;
};

export const Navbar = ({
    documentId,
    title,
    icon,
    parentDocument,
    isDatabase,
    onToggleDatabase
}: NavbarProps) => {
    const sidebar = useSidebar();

    // Flatten the recursive parentDocument structure into an array
    const breadcrumbs = [];
    let current = parentDocument;
    while (current) {
        breadcrumbs.unshift(current);
        current = (current as any).parentDocument;
    }

    return (
        <nav className="sticky top-0 z-50 bg-background dark:bg-[#1F1F1F] px-4 py-3 w-full flex items-center gap-x-4 border-b border-black/5 dark:border-white/5 transition-all ease-in-out">
            {!sidebar.isOpen && (
                <MenuIcon
                    role="button"
                    onClick={sidebar.onOpen}
                    className="h-6 w-6 text-muted-foreground mr-2 cursor-pointer shrink-0"
                />
            )}

            <div className={cn(
                "flex items-center justify-between w-full mx-auto px-4 md:px-12 lg:px-24",
                isDatabase ? "max-w-full" : "md:max-w-5xl lg:max-w-6xl"
            )}>
                <div className="flex items-center gap-x-1 text-sm overflow-hidden min-w-0 flex-1">
                    {breadcrumbs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-x-1">
                            <Link href={`/documents/${doc.id}`} passHref className="min-w-0">
                                <div role="button" className="text-[#3F3F3F] dark:text-[#CFCFCF] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition px-2 py-0.5 rounded-sm truncate max-w-[150px] font-medium flex items-center gap-x-1 min-w-0">
                                    {doc.icon && <span className="text-base shrink-0">{doc.icon}</span>}
                                    <span className="truncate">{doc.title}</span>
                                </div>
                            </Link>
                            <div className="text-neutral-300 dark:text-neutral-600 mx-1">/</div>
                        </div>
                    ))}
                    {/* Showing Live Title */}
                    <div className="min-w-0 truncate">
                        <Title initialData={{ title: title || "Untitled", id: documentId || "", icon: icon || undefined }} />
                    </div>
                </div>
                <div className="flex items-center gap-x-2 shrink-0 ml-2">
                    {onToggleDatabase && (
                        <Button
                            onClick={onToggleDatabase}
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "text-muted-foreground",
                                isDatabase && "bg-neutral-200 dark:bg-neutral-800 text-primary"
                            )}
                        >
                            {isDatabase ? (
                                <Layout className="h-4 w-4 mr-1" />
                            ) : (
                                <FileText className="h-4 w-4 mr-1" />
                            )}
                            {isDatabase ? "Database" : "Page"}
                        </Button>
                    )}
                    <SharePopover />
                </div>
            </div>
        </nav>
    );
};
