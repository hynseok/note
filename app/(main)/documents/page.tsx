"use client";

import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const DocumentsPage = () => {
    const router = useRouter();
    const { data: session } = useSession();

    const onCreate = () => {
        const promise = fetch("/api/documents", {
            method: "POST",
            body: JSON.stringify({ title: "Untitled" })
        }).then((res) => {
            if (res.ok) return res.json();
            throw new Error("Failed to create");
        });

        toast.promise(promise, {
            loading: "Creating a new note...",
            success: "New note created!",
            error: "Failed to create a new note."
        });

        promise.then((data) => {
            import("@/lib/events").then(({ documentEvents }) => {
                documentEvents.emit({ type: "CREATE" });
            });
            router.push(`/documents/${data.id}`);
        });
    }

    return (
        <div className="h-full flex flex-col items-center justify-center space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">
                    Welcome to PrivateNote
                </h2>
                <p className="text-muted-foreground text-sm">
                    Your minimalist workspace for clutter-free thinking.
                </p>
            </div>
            <Button onClick={onCreate} size="lg" className="rounded-full px-8 shadow-lg hover:shadow-xl transition-all">
                <PlusCircle className="h-4 w-4 mr-2" />
                Create a note
            </Button>
        </div>
    );
}

export default DocumentsPage;
