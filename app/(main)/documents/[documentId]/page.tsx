"use client";

import { Editor } from "@/components/editor";
import { useEffect, useState, useMemo } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useRouter } from "next/navigation";
import { Navbar } from "../../_components/navbar";
import { Button } from "@/components/ui/button";
import { FileIcon, ImageIcon, Smile, X } from "lucide-react";
import { IconPicker } from "@/components/icon-picker";
import { Cover } from "@/components/cover";
import { CoverPicker } from "@/components/cover-picker";
import { documentEvents, setActiveExpandIds } from "@/lib/events";
import { cn } from "@/lib/utils";

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

    useEffect(() => {
        params.then((p) => setDocumentId(p.documentId));
    }, [params]);

    const [title, setTitle] = useState("Untitled");
    const [icon, setIcon] = useState<string | null>(null);
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [content, setContent] = useState("");
    const [childrenDocs, setChildrenDocs] = useState<any[]>([]); // Add type later if needed
    const [parentDocument, setParentDocument] = useState<any>(null);
    const [permission, setPermission] = useState("READ");
    const [loading, setLoading] = useState(true);

    // Debounced update function
    const updateDocument = useMemo(
        () =>
            debounce(async (values: { title?: string; content?: string; icon?: string | null; coverImage?: string | null }) => {
                if (!documentId) return;
                await fetch(`/api/documents/${documentId}`, {
                    method: "PATCH",
                    body: JSON.stringify(values),
                    keepalive: true
                });
                // No need to router.refresh() here, we use events for Sidebar updates
            }, 200),
        [documentId]
    );

    // Fetch initial data
    useEffect(() => {
        if (!documentId) return;
        const fetchDocument = async () => {
            const res = await fetch(`/api/documents/${documentId}`);
            if (!res.ok) return;
            const data = await res.json();
            setTitle(data.title);
            setIcon(data.icon);
            setCoverImage(data.coverImage);
            setContent(data.content);
            setChildrenDocs(data.childDocuments || []);
            setParentDocument(data.parentDocument || null);
            setPermission(data.currentUserPermission || "READ");
            setLoading(false);

            // Auto-expand sidebar
            // We need to walk up the parentDocument chain and get all IDs
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

        // Subscribe to external updates (e.g. sidebar creation of child)
        const unsubscribe = documentEvents.subscribe((payload: any) => {
            // Ignore events that shouldn't trigger a page re-fetch
            if (payload && (payload.type === "EXPAND" || payload.type === "UPDATE_TITLE")) {
                return;
            }
            // We re-fetch to see if children updated or title changed externally
            fetchDocument();
        });

        return () => {
            unsubscribe();
        };
    }, [documentId]);

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

    return (
        <>
            <Navbar
                documentId={documentId}
                title={title}
                icon={icon}
                parentDocument={parentDocument}
            />
            <Cover url={coverImage || undefined} preview={!canEdit} onChange={onChangeCover} onRemove={onRemoveCover} />
            <div className="pb-40">
                <div className="md:max-w-5xl lg:max-w-6xl mx-auto px-12 md:px-24">
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
                                        e.preventDefault();
                                        const editor = document.querySelector('.ProseMirror') as HTMLElement;
                                        if (editor) {
                                            editor.focus();
                                        }
                                    }
                                    // Add ArrowDown navigation
                                    if (e.key === "ArrowDown") {
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
                        {/* Child Documents Links Removed - moving to editor content */}

                        {!loading && (
                            <Editor
                                documentId={documentId}
                                onChange={onContentChange}
                                initialContent={content}
                                editable={canEdit}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
