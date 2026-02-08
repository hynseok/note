import { useState } from "react";
import { FileIcon } from "lucide-react";
import { DocumentModal } from "./document-modal";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface DatabaseItemCardProps {
    document: any;
    tagOptions?: any[];
    onOpen: (documentId: string) => void;
}

export const DatabaseItemCard = ({ document, tagOptions = [], onOpen }: DatabaseItemCardProps) => {
    const properties = document.properties ? JSON.parse(document.properties) : {};
    const tags = properties.tags || [];

    const getTagColor = (tagName: string) => {
        const option = tagOptions.find((opt: any) => opt.label === tagName);
        return option?.color || "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
    };

    return (
        <div
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData("application/x-database-item", document.id);
                e.dataTransfer.setData("application/x-privatenote-document-id", document.id);
            }}
            onClick={() => onOpen(document.id)}
            className="group flex flex-col gap-1 rounded-md border border-neutral-200 bg-white p-2 text-sm shadow-sm hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 transition-all cursor-grab active:cursor-grabbing hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
            <div className="flex items-center gap-2">
                {document.icon ? (
                    <span className="text-lg shrink-0">{document.icon}</span>
                ) : (
                    <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="truncate font-medium text-neutral-700 dark:text-neutral-200 text-sm">
                    {document.title || "Untitled"}
                </span>
            </div>
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {tags.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className={cn("px-1 py-0 text-[12px] h-5 border-none shadow-none max-w-full truncate block", getTagColor(tag))}>
                            {tag}
                        </Badge>
                    ))}
                </div>
            )}
            {document.user && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <Avatar className="h-4 w-4">
                        <AvatarImage src={document.user.image} />
                        <AvatarFallback className="text-[9px]">{document.user.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                        {document.user.name}
                    </span>
                </div>
            )}
        </div>
    );
};
