"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Trash, Undo } from "lucide-react";
import { toast } from "sonner";
import { documentEvents } from "@/lib/events";

import { Spinner } from "@/components/spinner";
import { Input } from "@/components/ui/input";
import { ConfirmModal } from "@/components/modals/confirm-modal";

// Inline Spinner if not exists (usually in components/spinner.tsx)
// Inline ConfirmModal if not exists

export const TrashBox = () => {
    const router = useRouter();
    const params = useParams();
    const [documents, setDocuments] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        fetch("/api/documents?isArchived=true")
            .then(res => res.json())
            .then(data => {
                setDocuments(data);
                setLoading(false);
            });
    }, []);

    const filteredDocuments = documents.filter((doc) => {
        return doc.title.toLowerCase().includes(search.toLowerCase());
    });

    const onClick = (documentId: string) => {
        router.push(`/documents/${documentId}`);
    };

    const onRestore = async (event: React.MouseEvent<HTMLDivElement, MouseEvent>, documentId: string) => {
        event.stopPropagation();
        const promise = fetch(`/api/documents/${documentId}`, {
            method: "PATCH",
            body: JSON.stringify({ isArchived: false })
        }).then(res => {
            if (!res.ok) throw new Error("Failed to restore");
            return res.json();
        });

        toast.promise(promise, {
            loading: "Restoring note...",
            success: "Note restored!",
            error: "Failed to restore note."
        });

        await promise;
        // Update local state
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
        // Notify global list
        documentEvents.emit({ type: "CREATE", parentId: null }); // Trigger refresh, treating restore as create
        router.refresh();
    };

    const onRemove = async (documentId: string) => {
        const promise = fetch(`/api/documents/${documentId}`, {
            method: "DELETE",
        }).then(res => {
            if (!res.ok) throw new Error("Failed to delete");
            return res.json();
        });

        toast.promise(promise, {
            loading: "Deleting note...",
            success: "Note deleted!",
            error: "Failed to delete note."
        });

        await promise;
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
        router.refresh();

        if (params.documentId === documentId) {
            router.push("/documents");
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="text-sm">
            <div className="flex items-center gap-x-1 p-2">
                <Search className="h-4 w-4" />
                <Input
                    value={search}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    className="h-7 px-2 focus-visible:ring-transparent bg-secondary"
                    placeholder="Filter by page title..."
                />
            </div>
            <div className="mt-2 px-1 pb-1">
                <p className="hidden last:block text-xs text-center text-muted-foreground pb-2">
                    No documents found.
                </p>
                {filteredDocuments.map((doc) => (
                    <div
                        key={doc.id}
                        role="button"
                        onClick={() => onClick(doc.id)}
                        className="text-sm rounded-sm w-full hover:bg-primary/5 flex items-center text-primary justify-between"
                    >
                        <span className="truncate pl-2">
                            {doc.title}
                        </span>
                        <div className="flex items-center">
                            <div
                                onClick={(e) => onRestore(e as any, doc.id)}
                                role="button"
                                className="rounded-sm p-2 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                            >
                                <Undo className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <ConfirmModal onConfirm={() => onRemove(doc.id)}>
                                <div
                                    role="button"
                                    className="rounded-sm p-2 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                                >
                                    <Trash className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </ConfirmModal>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
