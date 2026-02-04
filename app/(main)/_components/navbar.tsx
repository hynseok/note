"use client";

import { MenuIcon, FileIcon } from "lucide-react";
import { Title } from "./title";
import Link from "next/link";
import { SharePopover } from "@/components/share-popover";

interface NavbarProps {
    isCollapsed?: boolean;
    onResetWidth?: () => void;
    documentId?: string;
    title?: string;
    icon?: string | null;
    parentDocument?: { id: string, title: string, icon: string | null } | null;
};

export const Navbar = ({
    isCollapsed,
    onResetWidth,
    documentId,
    title,
    icon,
    parentDocument
}: NavbarProps) => {
    // Flatten the recursive parentDocument structure into an array
    const breadcrumbs = [];
    let current = parentDocument;
    while (current) {
        breadcrumbs.unshift(current);
        current = (current as any).parentDocument;
    }

    return (
        <nav className="sticky top-0 z-50 bg-background dark:bg-[#1F1F1F] px-4 py-3 w-full flex items-center gap-x-4 border-b border-black/5 dark:border-white/5 transition-all ease-in-out">
            {isCollapsed && (
                <MenuIcon
                    role="button"
                    onClick={onResetWidth}
                    className="h-6 w-6 text-muted-foreground"
                />
            )}

            <div className="flex items-center justify-between w-full md:max-w-5xl lg:max-w-6xl mx-auto px-12 md:px-24">
                <div className="flex items-center gap-x-1 text-sm overflow-hidden">
                    {breadcrumbs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-x-1">
                            <Link href={`/documents/${doc.id}`} passHref>
                                <div role="button" className="text-[#3F3F3F] dark:text-[#CFCFCF] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition px-2 py-0.5 rounded-sm truncate max-w-[150px] font-medium flex items-center gap-x-1">
                                    {doc.icon && <span className="text-base">{doc.icon}</span>}
                                    <span className="truncate">{doc.title}</span>
                                </div>
                            </Link>
                            <div className="text-neutral-300 dark:text-neutral-600 mx-1">/</div>
                        </div>
                    ))}
                    {/* Showing Live Title */}
                    <Title initialData={{ title: title || "Untitled", id: documentId || "", icon: icon || undefined }} />
                </div>
                <div className="flex items-center gap-x-2">
                    <SharePopover />
                </div>
            </div>
        </nav>
    );
};
