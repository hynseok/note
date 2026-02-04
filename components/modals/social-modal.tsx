"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSocial } from "@/hooks/use-social"; // Need to create this hook
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, Users, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDebounce } from "@/hooks/use-debounce";

export const SocialModal = () => {
    const social = useSocial();

    // Tab state
    const [activeTab, setActiveTab] = useState("friends");

    // Data state
    const [friends, setFriends] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 400);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasPerformedSearch, setHasPerformedSearch] = useState(false);

    // Fetch data
    const refreshData = () => {
        // Fetch friends
        fetch("/api/friends")
            .then(res => res.json())
            .then(data => setFriends(data))
            .catch(err => console.error(err));

        // Fetch requests
        fetch("/api/friends/requests")
            .then(res => res.json())
            .then(data => setRequests(data))
            .catch(err => console.error(err));
    };

    useEffect(() => {
        if (social.isOpen) {
            refreshData();
        }
    }, [social.isOpen]);

    const handleSearch = async (query: string) => {
        if (query.length < 3) {
            setSearchResults([]);
            setHasPerformedSearch(false);
            return;
        }

        setIsSearching(true);
        try {
            const res = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`);
            const data = await res.json();
            setSearchResults(data);
            setHasPerformedSearch(true);
        } catch (error) {
            toast.error("Failed to search users");
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if (debouncedSearch) {
            handleSearch(debouncedSearch);
        } else {
            setSearchResults([]);
            setHasPerformedSearch(false);
        }
    }, [debouncedSearch]);

    const sendRequest = async (receiverId: string) => {
        try {
            const res = await fetch("/api/friends/requests", {
                method: "POST",
                body: JSON.stringify({ receiverId })
            });

            if (res.ok) {
                toast.success("Friend request sent!");
                setSearchResults(prev => prev.filter(user => user.id !== receiverId));
            } else {
                const msg = await res.text();
                toast.error(msg || "Failed to send request");
            }
        } catch (error) {
            toast.error("Something went wrong");
        }
    };

    const handleRequestAction = async (requestId: string, action: "ACCEPT" | "REJECT") => {
        try {
            const res = await fetch(`/api/friends/requests/${requestId}`, {
                method: "PATCH",
                body: JSON.stringify({ action })
            });

            if (res.ok) {
                toast.success(action === "ACCEPT" ? "Friend request accepted" : "Request rejected");
                refreshData();
            } else {
                toast.error("Failed to process request");
            }
        } catch (error) {
            toast.error("Something went wrong");
        }
    };

    const removeFriend = async (friendId: string) => {
        try {
            const res = await fetch(`/api/friends/${friendId}`, {
                method: "DELETE"
            });

            if (res.ok) {
                toast.success("Friend removed");
                setFriends(prev => prev.filter(f => f.friend.id !== friendId));
            } else {
                toast.error("Failed to remove friend");
            }
        } catch (error) {
            toast.error("Something went wrong");
        }
    };

    return (
        <Dialog open={social.isOpen} onOpenChange={social.onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Social Requests</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="friends" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="friends">My Friends</TabsTrigger>
                        <TabsTrigger value="add">Add Friend</TabsTrigger>
                        <TabsTrigger value="requests" className="relative">
                            Requests
                            {requests.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                                    {requests.length}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {/* Friends List Tab */}
                    <TabsContent value="friends" className="mt-4">
                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                            {friends.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-4">
                                    No friends yet. Add some!
                                </p>
                            ) : (
                                friends.map((f: any) => (
                                    <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-background/50 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={f.friend.image} />
                                                <AvatarFallback>{f.friend.name?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{f.friend.name}</span>
                                                <span className="text-xs text-muted-foreground">{f.friend.email}</span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => removeFriend(f.friend.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    {/* Add Friend Tab */}
                    <TabsContent value="add" className="mt-4">
                        <div className="flex gap-2 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by email..."
                                    className="pl-8 border-neutral-200 dark:border-neutral-800 focus-visible:ring-neutral-400"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                                />
                            </div>
                            <Button onClick={() => handleSearch(searchQuery)} disabled={isSearching} className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200">
                                {isSearching ? "Searching..." : "Search"}
                            </Button>
                        </div>
                        <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto">
                            {searchResults.map((user: any) => (
                                <div key={user.id} className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-background/50">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.image} />
                                            <AvatarFallback>{user.name?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{user.name}</span>
                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                        </div>
                                    </div>
                                    <Button size="sm" onClick={() => sendRequest(user.id)} className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200">
                                        <UserPlus className="h-4 w-4 mr-2" />
                                        Add
                                    </Button>
                                </div>
                            ))}
                            {searchResults.length === 0 && hasPerformedSearch && !isSearching && (
                                <p className="text-center text-sm text-muted-foreground py-2">No users found.</p>
                            )}
                        </div>
                    </TabsContent>

                    {/* Pending Requests Tab */}
                    <TabsContent value="requests" className="mt-4">
                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                            {requests.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-4">
                                    No pending requests.
                                </p>
                            ) : (
                                requests.map((req: any) => (
                                    <div key={req.id} className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-background/50">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={req.sender.image} />
                                                <AvatarFallback>{req.sender.name?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{req.sender.name}</span>
                                                <span className="text-xs text-muted-foreground">{req.sender.email}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                onClick={() => handleRequestAction(req.id, "ACCEPT")}
                                            >
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleRequestAction(req.id, "REJECT")}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
