"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileIcon, ChevronRight, ChevronDown } from "lucide-react";
import { Item } from "./item";
import { cn } from "@/lib/utils";
import { documentEvents } from "@/lib/events";

interface SharedDocument {
    id: string;
    title: string;
    icon: string | null;
    permission: string;
    userId: string;
    childDocuments?: SharedDocument[];
}

export const SharedList = () => {
    const params = useParams();
    const router = useRouter();
    const [documents, setDocuments] = useState<SharedDocument[]>([]);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const fetchShared = () => {
        fetch("/api/documents/shared")
            .then(res => res.json())
            .then(data => setDocuments(data))
            .catch(err => console.log(err));
    };

    useEffect(() => {
        fetchShared();

        const unsubscribe = documentEvents.subscribe((event: any) => {
            if (event.type === "UPDATE" || event.type === "CREATE") {
                fetchShared();
            }
        });

        return () => unsubscribe();
    }, []);

    const onRedirect = (documentId: string) => {
        router.push(`/documents/${documentId}`);
    };

    const onExpand = (documentId: string) => {
        setExpanded(prev => ({
            ...prev,
            [documentId]: !prev[documentId]
        }));
    };

    const renderDocument = (doc: SharedDocument, level: number = 0) => {
        const isExpanded = expanded[doc.id];
        const hasChildren = doc.childDocuments && doc.childDocuments.length > 0;

        return (
            <div key={doc.id}>
                <Item
                    id={doc.id}
                    onClick={() => onRedirect(doc.id)}
                    label={doc.title}
                    icon={FileIcon}
                    documentIcon={doc.icon ?? undefined}
                    active={params.documentId === doc.id}
                    level={level}
                    onExpand={hasChildren ? () => onExpand(doc.id) : undefined}
                    expanded={isExpanded}
                    userId={doc.userId}
                />
                {isExpanded && hasChildren && (
                    <div>
                        {doc.childDocuments!.map(child =>
                            renderDocument(child, level + 1)
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (documents.length === 0) {
        return null;
    }

    return (
        <>
            <div className="text-xs font-semibold text-muted-foreground/50 mb-1 pl-2 mt-4">
                Shared with me
            </div>
            {documents.map(doc => renderDocument(doc))}
        </>
    );
};
