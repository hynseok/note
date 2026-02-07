import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Item } from "./item";
import { cn } from "@/lib/utils";
import { FileIcon, FileText } from "lucide-react";
import { documentEvents, getActiveExpandIds } from "@/lib/events";

import {
    useDndMonitor,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Document {
    id: string;
    title: string;
    icon?: string;
    content?: string;
    order: number;
}

const SortableDocumentItem = ({
    document,
    level,
    expanded,
    onExpand,
    onRedirect,
    active,
    parentDocumentId
}: {
    document: Document;
    level: number;
    expanded: boolean;
    onExpand: () => void;
    onRedirect: () => void;
    active: boolean;
    parentDocumentId?: string;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: document.id,
        data: {
            type: "Document",
            document: document,
            parentId: parentDocumentId
        }
    });

    const [dragState, setDragState] = useState<"top" | "bottom" | "center" | null>(null);

    useDndMonitor({
        onDragMove(event) {
            const { active, over } = event;

            // Only update if I am the target and not the one being dragged
            if (over?.id === document.id && active.id !== document.id) {
                if (!over.rect) return;

                const activeRect = active.rect.current.translated;
                if (!activeRect) return; // Happens initially

                // Calculation should match Navigation.tsx logic exactly
                // But Navigation uses activeCenterY. Here we use cursor or active rect?
                // Actually event.active.rect.current.translated is reliable.

                const activeCenterY = activeRect.top + (activeRect.height / 2);
                const overRect = over.rect; // This is a rect from dnd-kit

                const overTop = overRect.top;
                const overHeight = overRect.height;

                const relativeY = (activeCenterY - overTop) / overHeight;

                if (relativeY < 0.25) {
                    setDragState("top");
                } else if (relativeY > 0.75) {
                    setDragState("bottom");
                } else {
                    setDragState("center");
                }
            } else {
                if (dragState !== null) setDragState(null);
            }
        },
        onDragEnd() {
            setDragState(null);
        },
        onDragCancel() {
            setDragState(null);
        }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Style adjustments based on dragState
    // center -> bg-primary/10 (Nest)
    // top -> border-t-2 border-primary
    // bottom -> border-b-2 border-primary

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={cn(
                "group relative select-none", // Added select-none to prevent text selection during drag
                dragState === "center" && "bg-sky-500/20 text-sky-800 dark:text-sky-200"
            )}
        >
            {/* Drop Indicator Lines */}
            {dragState === "top" && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-sky-500 z-50" />
            )}

            <Item
                id={document.id}
                onClick={onRedirect}
                label={document.title}
                icon={
                    (document as any).content && (document as any).content !== "" && (document as any).content !== "<p></p>"
                        ? FileText
                        : FileIcon
                }
                documentIcon={document.icon}
                active={active}
                level={level}
                onExpand={onExpand}
                expanded={expanded}
            />

            {dragState === "bottom" && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-sky-500 z-50" />
            )}

            {expanded && (
                <DocumentList
                    parentDocumentId={document.id}
                    level={level + 1}
                />
            )}
        </div>
    );
};

export const DocumentList = ({
    level = 0,
    parentDocumentId
}: {
    level?: number;
    parentDocumentId?: string;
}) => {
    const params = useParams();
    const router = useRouter();
    const [documents, setDocuments] = useState<Document[] | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const onExpand = (documentId: string) => {
        setExpanded(prev => ({
            ...prev,
            [documentId]: !prev[documentId]
        }));
    };

    const fetchDocuments = async () => {
        try {
            const url = parentDocumentId
                ? `/api/documents?parentDocumentId=${parentDocumentId}`
                : `/api/documents`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setDocuments(data);

                // Check for auto-expand on load
                const activeIds = getActiveExpandIds();
                if (activeIds && activeIds.length > 0) {
                    setExpanded(prev => {
                        const next = { ...prev };
                        let changed = false;
                        data.forEach((doc: any) => {
                            if (activeIds.includes(doc.id) && !next[doc.id]) {
                                next[doc.id] = true;
                                changed = true;
                            }
                        });
                        return changed ? next : prev;
                    });
                }
            }
        } catch (error) {
            console.error("Failed to fetch documents", error);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [parentDocumentId]);

    useEffect(() => {
        const unsubscribe = documentEvents.subscribe((payload: any) => {
            if (payload && payload.type === "UPDATE_TITLE") {
                setDocuments(prev => {
                    if (!prev) return null;
                    return prev.map(doc =>
                        doc.id === payload.id ? {
                            ...doc,
                            title: payload.title !== undefined ? payload.title : doc.title,
                            icon: payload.icon !== undefined ? payload.icon : doc.icon,
                            content: payload.content !== undefined ? payload.content : doc.content
                        } : doc
                    );
                });
                return;
            }

            if (payload && payload.type === "EXPAND") {
                const ids = payload.ids || getActiveExpandIds();
                setExpanded(prev => {
                    const next = { ...prev };
                    let changed = false;
                    if (documents) {
                        documents.forEach(doc => {
                            if (ids.includes(doc.id) && !next[doc.id]) {
                                next[doc.id] = true;
                                changed = true;
                            }
                        });
                    }
                    return changed ? next : prev;
                });
                return;
            }

            // REFRESH event for DnD updates
            if (payload && payload.type === "REFRESH") {
                fetchDocuments();
                return;
            }

            fetchDocuments();
        });

        return () => unsubscribe();
    }, [documents, parentDocumentId]);

    const onRedirect = (documentId: string) => {
        router.push(`/documents/${documentId}`);
    };

    if (documents === null) {
        return (
            <>
                <Item.Skeleton level={level} />
                {level === 0 && (
                    <>
                        <Item.Skeleton level={level} />
                        <Item.Skeleton level={level} />
                    </>
                )}
            </>
        );
    }

    return (
        <>
            <p
                style={{ paddingLeft: level ? `${(level * 12) + 25}px` : undefined }}
                className={cn(
                    "hidden text-sm font-medium text-muted-foreground/80",
                    expanded && "last:block",
                    level === 0 && "hidden"
                )}
            >
                No pages inside
            </p>
            <SortableContext
                items={documents.map(doc => doc.id)}
                strategy={verticalListSortingStrategy}
            >
                {documents.map((doc) => (
                    <SortableDocumentItem
                        key={doc.id}
                        document={doc}
                        level={level}
                        expanded={expanded[doc.id]}
                        onExpand={() => onExpand(doc.id)}
                        onRedirect={() => onRedirect(doc.id)}
                        active={params.documentId === doc.id}
                        parentDocumentId={parentDocumentId}
                    />
                ))}
            </SortableContext>
        </>
    );
};
