"use client";

import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Share, Check, UserPlus, X, ChevronDown, MoreHorizontal, Globe, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useOrigin } from "@/hooks/use-origin";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const SharePopover = () => {
    const origin = useOrigin();
    const params = useParams();
    const documentId = params.documentId as string;

    const [friends, setFriends] = useState<any[]>([]);
    const [collaborators, setCollaborators] = useState<any[]>([]);
    const [owner, setOwner] = useState<any>(null);
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(false);

    // Publish State
    const [isPublished, setIsPublished] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!documentId) return;

        fetch("/api/friends")
            .then(res => res.json())
            .then(data => setFriends(data));

        refreshCollaborators();
        fetchDocumentStatus(); // Fetch published status
    }, [documentId]);

    const refreshCollaborators = () => {
        fetch(`/api/documents/${documentId}/share`)
            .then(res => {
                if (res.ok) return res.json();
                return { isOwner: false, collaborators: [], owner: null };
            })
            .then(data => {
                setCollaborators(data.collaborators || []);
                setIsOwner(data.isOwner || false);
                setOwner(data.owner || null);
            });
    };

    const fetchDocumentStatus = async () => {
        try {
            const res = await fetch(`/api/documents/${documentId}`);
            if (res.ok) {
                const data = await res.json();
                setIsPublished(data.isPublished);
            }
        } catch (error) {
            console.error("Failed to fetch document status", error);
        }
    };

    const onInvite = async (userId: string, permission: "READ" | "EDIT" = "READ", isUpdate = false) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/documents/${documentId}/share`, {
                method: "POST",
                body: JSON.stringify({ userId, permission })
            });

            if (res.ok) {
                if (isUpdate) {
                    toast.success("Permission updated");
                } else {
                    toast.success(permission === "READ" ? "Invited as Viewer" : "Invited as Editor");
                }
                refreshCollaborators();
            } else {
                toast.error("Failed to update.");
            }
        } catch {
            toast.error("Error updating.");
        } finally {
            setLoading(false);
        }
    };

    const onRemove = async (userId: string) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/documents/${documentId}/share?userId=${userId}`, {
                method: "DELETE"
            });

            if (res.ok) {
                toast.success("Removed access.");
                refreshCollaborators();
            } else {
                toast.error("Failed to remove.");
            }
        } catch {
            toast.error("Error removing user.");
        } finally {
            setLoading(false);
        }
    };

    const onPublish = async () => {
        setPublishing(true);
        try {
            const res = await fetch(`/api/documents/${documentId}`, {
                method: "PATCH",
                body: JSON.stringify({ isPublished: true }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                setIsPublished(true);
                toast.success("Document published");
            } else {
                toast.error("Failed to publish");
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setPublishing(false);
        }
    };

    const onUnpublish = async () => {
        setPublishing(true);
        try {
            const res = await fetch(`/api/documents/${documentId}`, {
                method: "PATCH",
                body: JSON.stringify({ isPublished: false }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                setIsPublished(false);
                toast.success("Document unpublished");
            } else {
                toast.error("Failed to unpublish");
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setPublishing(false);
        }
    };

    const onCopy = () => {
        const url = `${origin}/preview/${documentId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);

        setTimeout(() => {
            setCopied(false);
        }, 1000);

        toast.success("Link copied to clipboard");
    };

    const onViewSite = () => {
        window.open(`${origin}/preview/${documentId}`, "_blank");
    };

    const uninvitedFriends = friends.filter(f =>
        !collaborators.some(c => c.userId === f.friend.id)
    );

    const publishUrl = `${origin}/preview/${documentId}`;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors">
                    <Share className="h-4 w-4 mr-1" />
                    Share
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0 overflow-hidden" align="end" alignOffset={8} forceMount>
                <Tabs defaultValue="share" className="w-full">
                    <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 pt-2">
                        <TabsList className="bg-transparent p-0 h-auto gap-4">
                            <TabsTrigger
                                value="share"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-b-neutral-900 dark:data-[state=active]:border-b-neutral-700 bg-transparent px-4 pb-2 pt-2 font-medium text-muted-foreground data-[state=active]:text-foreground shadow-none transition-none focus-visible:ring-0"
                            >
                                Share
                            </TabsTrigger>
                            <TabsTrigger
                                value="publish"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-b-neutral-900 dark:data-[state=active]:border-b-neutral-700 bg-transparent px-4 pb-2 pt-2 font-medium text-muted-foreground data-[state=active]:text-foreground shadow-none transition-none focus-visible:ring-0"
                            >
                                Publish
                                {isPublished && <span className="ml-1.5 flex h-1.5 w-1.5 rounded-full bg-blue-500" />}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="share" className="p-4 m-0 outline-none">
                        <div className="space-y-4">
                            {isOwner && (
                                <div>
                                    <h4 className="font-medium mb-2 text-sm">Invite Friends</h4>
                                    {uninvitedFriends.length === 0 ? (
                                        <p className="text-sm text-neutral-500 text-center py-2 bg-neutral-50 dark:bg-neutral-900/50 rounded-md">
                                            All friends invited or no friends.
                                        </p>
                                    ) : (
                                        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                                            {uninvitedFriends.map(f => (
                                                <div key={f.friend.id} className="flex items-center justify-between p-1 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-7 w-7">
                                                            <AvatarImage src={f.friend.image} />
                                                            <AvatarFallback>{f.friend.name?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm font-medium truncate max-w-[140px]">{f.friend.name}</span>
                                                    </div>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading}>
                                                                Invite <ChevronDown className="h-3 w-3 ml-1" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => onInvite(f.friend.id, "READ")}>
                                                                Invite as Viewer
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => onInvite(f.friend.id, "EDIT")}>
                                                                Invite as Editor
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className={cn("space-y-3", isOwner && "border-t border-neutral-200 dark:border-neutral-800 pt-4")}>
                                <h4 className="font-medium text-sm">Collaborators</h4>
                                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                                    {owner && (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-7 w-7">
                                                    <AvatarImage src={owner.image} />
                                                    <AvatarFallback>{owner.name?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium truncate max-w-[140px]">{owner.name}</span>
                                                    <span className="text-[10px] text-muted-foreground">Owner</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {collaborators.length === 0 && !owner ? (
                                        <p className="text-sm text-neutral-500 text-center py-2">No collaborators.</p>
                                    ) : (
                                        collaborators.map(c => (
                                            <div key={c.id} className="flex items-center justify-between p-1">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-7 w-7">
                                                        <AvatarImage src={c.user.image} />
                                                        <AvatarFallback>{c.user.name?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium truncate max-w-[140px]">{c.user.name}</span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {c.permission === "READ" ? "Viewer" : "Editor"}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {isOwner && (
                                                        <>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="outline" className="h-7 text-xs w-[85px] justify-between px-2" disabled={loading}>
                                                                        {c.permission === "READ" ? "Viewer" : "Editor"}
                                                                        <ChevronDown className="h-3 w-3 opacity-50" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => onInvite(c.userId, "READ", true)}>
                                                                        Viewer
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => onInvite(c.userId, "EDIT", true)}>
                                                                        Editor
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => onRemove(c.userId)} disabled={loading}>
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="publish" className="p-0 m-0 outline-none">
                        {isPublished ? (
                            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-blue-500">
                                                <Globe className="h-4 w-4" />
                                                <h4 className="font-medium text-sm">Site is live</h4>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Anyone with the link can view this page.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center">
                                        <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-l-md px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400 truncate border border-r-0 border-neutral-200 dark:border-neutral-700 h-9 flex items-center">
                                            <span className="truncate">{publishUrl}</span>
                                        </div>
                                        <Button
                                            onClick={onCopy}
                                            className="rounded-l-none h-9 border border-l-0 border-neutral-200 dark:border-neutral-700"
                                            variant="outline"
                                        >
                                            {copied ? (
                                                <Check className="h-4 w-4" />
                                            ) : (
                                                <Copy className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>

                                    <div className="space-y-0.5">
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start h-8 px-2 text-sm font-normal"
                                            onClick={onViewSite}
                                        >
                                            <ExternalLink className="h-4 w-4 mr-2 text-muted-foreground" />
                                            View site
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start h-8 px-2 text-sm font-normal"
                                            onClick={() => {
                                                if (navigator.share) {
                                                    navigator.share({
                                                        title: "Private Note",
                                                        text: `Check out this note: ${publishUrl}`,
                                                        url: publishUrl,
                                                    })
                                                        .then(() => console.log('Successful share'))
                                                        .catch((error) => console.log('Error sharing', error));
                                                } else {
                                                    onCopy(); // Fallback
                                                }
                                            }}
                                        >
                                            <Share className="h-4 w-4 mr-2 text-muted-foreground" />
                                            Share via social
                                        </Button>
                                    </div>
                                </div>

                                <div className="p-4 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/30">
                                    <Button
                                        variant="outline"
                                        className="h-9 w-full bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
                                        onClick={onUnpublish}
                                        disabled={publishing}
                                    >
                                        Unpublish
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 flex flex-col items-center text-center space-y-4">
                                <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                                    <Globe className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-medium">Publish to web</h4>
                                    <p className="text-sm text-muted-foreground max-w-[260px]">
                                        Create a public website with Notion. Share your specific page with anyone.
                                    </p>
                                </div>
                                <Button
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                                    onClick={onPublish}
                                    disabled={publishing}
                                >
                                    {publishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Publish
                                </Button>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover>
    );
};
