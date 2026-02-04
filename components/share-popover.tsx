import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Share, Check, UserPlus, X, ChevronDown, MoreHorizontal } from "lucide-react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export const SharePopover = () => {
    const origin = useOrigin();
    const params = useParams();
    const documentId = params.documentId as string;

    const [friends, setFriends] = useState<any[]>([]);
    const [collaborators, setCollaborators] = useState<any[]>([]);
    const [owner, setOwner] = useState<any>(null);
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!documentId) return;

        fetch("/api/friends")
            .then(res => res.json())
            .then(data => setFriends(data));

        refreshCollaborators();
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
    }

    const uninvitedFriends = friends.filter(f =>
        !collaborators.some(c => c.userId === f.friend.id)
    );

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors">
                    <Share className="h-4 w-4 mr-2" />
                    Share
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end" alignOffset={8} forceMount>
                <div className="space-y-4">
                    {isOwner && (
                        <div>
                            <h4 className="font-medium mb-2">Invite Friends</h4>
                            {uninvitedFriends.length === 0 ? (
                                <p className="text-sm text-muted-foreground">All friends invited or no friends.</p>
                            ) : (
                                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                                    {uninvitedFriends.map(f => (
                                        <div key={f.friend.id} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={f.friend.image} />
                                                    <AvatarFallback>{f.friend.name?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm truncate max-w-[120px]">{f.friend.name}</span>
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

                    <div className={isOwner ? "border-t border-neutral-200 dark:border-neutral-800 pt-4" : ""}>
                        <h4 className="font-medium mb-2">Collaborators</h4>
                        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                            {owner && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={owner.image} />
                                            <AvatarFallback>{owner.name?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-sm truncate max-w-[100px] font-medium">{owner.name}</span>
                                            <span className="text-[10px] text-muted-foreground">Owner</span>
                                        </div>
                                    </div>
                                    {/* No actions for owner */}
                                </div>
                            )}

                            {collaborators.length === 0 && !owner ? (
                                <p className="text-sm text-muted-foreground">No collaborators.</p>
                            ) : (
                                collaborators.map(c => (
                                    <div key={c.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={c.user.image} />
                                                <AvatarFallback>{c.user.name?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm truncate max-w-[100px] font-medium">{c.user.name}</span>
                                                {!isOwner && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {c.permission === "READ" ? "Viewer" : "Editor"}
                                                    </span>
                                                )}
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
            </PopoverContent>
        </Popover>
    );
};
