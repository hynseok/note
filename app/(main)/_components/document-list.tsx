"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Item } from "./item";
import { cn } from "@/lib/utils";
import { FileIcon, FileText } from "lucide-react";
import { documentEvents, getActiveExpandIds } from "@/lib/events";

interface Document {
    id: string;
    title: string;
    icon?: string;
    // ... other fields
}

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
                            // Store content snippet or existence flag if passed, to update dynamic icon
                            // For now we assume payload.content implies content exists if not empty
                            content: payload.content !== undefined ? payload.content : (doc as any).content
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

            fetchDocuments();
        });

        return () => unsubscribe();
    }, [documents, parentDocumentId]); // Dependent on documents to fix closure

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
            {documents.map((doc) => (
                <div key={doc.id}>
                    <Item
                        id={doc.id}
                        onClick={() => onRedirect(doc.id)}
                        label={doc.title}
                        icon={
                            (doc as any).content && (doc as any).content !== "" && (doc as any).content !== "<p></p>"
                                ? FileText
                                : FileIcon
                        }
                        documentIcon={doc.icon}
                        active={params.documentId === doc.id}
                        level={level}
                        onExpand={() => onExpand(doc.id)}
                        expanded={expanded[doc.id]}
                    />
                    {expanded[doc.id] && (
                        <DocumentList
                            parentDocumentId={doc.id}
                            level={level + 1}
                        />
                    )}
                </div>
            ))}
        </>
    );
};
