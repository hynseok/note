"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Reply, Trash2 } from "lucide-react";

interface CommentUser {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
}

interface DocumentCommentItem {
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    user: CommentUser;
    isAuthor: boolean;
    canDelete: boolean;
    replies: DocumentCommentItem[];
}

interface DocumentCommentsResponse {
    comments: DocumentCommentItem[];
}

interface DocumentCommentsProps {
    documentId: string;
    canComment: boolean;
    placement?: "top" | "bottom";
}

function getDisplayName(user: CommentUser): string {
    return user.name || user.email || "Unknown User";
}

function getInitials(value: string): string {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatCommentDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
}

function CommentRow({
    comment,
    onDelete,
    onReply,
    replyDraft,
    setReplyDraft,
    submittingReply,
    canComment,
}: {
    comment: DocumentCommentItem;
    onDelete: (commentId: string) => Promise<void>;
    onReply: (parentCommentId: string, content: string) => Promise<void>;
    replyDraft: string;
    setReplyDraft: (value: string) => void;
    submittingReply: boolean;
    canComment: boolean;
}) {
    const [replyOpen, setReplyOpen] = useState(false);

    return (
        <div className="space-y-3">
            <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.user.image || undefined} />
                    <AvatarFallback className="text-xs">
                        {getInitials(getDisplayName(comment.user))}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{getDisplayName(comment.user)}</span>
                        <span className="text-xs text-muted-foreground">{formatCommentDate(comment.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                        {comment.content}
                    </p>
                    <div className="mt-2 flex items-center gap-1">
                        {canComment && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => setReplyOpen((prev) => !prev)}
                            >
                                <Reply className="h-3.5 w-3.5" />
                                Reply
                            </Button>
                        )}
                        {comment.canDelete && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => onDelete(comment.id)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                            </Button>
                        )}
                    </div>
                    {replyOpen && canComment && (
                        <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
                            <TextareaAutosize
                                value={replyDraft}
                                onChange={(e) => setReplyDraft(e.target.value)}
                                minRows={2}
                                maxRows={6}
                                placeholder="Write a reply..."
                                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                            />
                            <div className="flex justify-end gap-2">
                                <Button type="button" size="xs" variant="ghost" onClick={() => setReplyOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    size="xs"
                                    disabled={submittingReply || !replyDraft.trim()}
                                    onClick={async () => {
                                        await onReply(comment.id, replyDraft);
                                        setReplyOpen(false);
                                    }}
                                >
                                    {submittingReply ? "Sending..." : "Reply"}
                                </Button>
                            </div>
                        </div>
                    )}
                    {comment.replies.length > 0 && (
                        <div className="mt-3 space-y-3 border-l border-border pl-4">
                            {comment.replies.map((reply) => (
                                <div key={reply.id} className="flex items-start gap-3">
                                    <Avatar className="h-7 w-7">
                                        <AvatarImage src={reply.user.image || undefined} />
                                        <AvatarFallback className="text-[10px]">
                                            {getInitials(getDisplayName(reply.user))}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-foreground">{getDisplayName(reply.user)}</span>
                                            <span className="text-[11px] text-muted-foreground">{formatCommentDate(reply.createdAt)}</span>
                                        </div>
                                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                                            {reply.content}
                                        </p>
                                        {reply.canDelete && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="xs"
                                                className="mt-1"
                                                onClick={() => onDelete(reply.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Delete
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function DocumentComments({
    documentId,
    canComment,
    placement = "top",
}: DocumentCommentsProps) {
    const [comments, setComments] = useState<DocumentCommentItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
    const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);

    const loadComments = useCallback(async () => {
        if (!documentId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/documents/${documentId}/comments`, {
                cache: "no-store",
            });

            if (!res.ok) {
                throw new Error("Failed to fetch comments");
            }

            const data = (await res.json()) as DocumentCommentsResponse;
            setComments(Array.isArray(data.comments) ? data.comments : []);
        } catch (error) {
            console.error("[COMMENTS_LOAD]", error);
            toast.error("Failed to load comments");
        } finally {
            setIsLoading(false);
        }
    }, [documentId]);

    useEffect(() => {
        loadComments();
    }, [loadComments]);

    const submitComment = useCallback(
        async (content: string, parentCommentId?: string) => {
            const trimmed = content.trim();
            if (!trimmed) return;

            if (parentCommentId) {
                setSubmittingReplyId(parentCommentId);
            } else {
                setIsSubmitting(true);
            }

            try {
                const res = await fetch(`/api/documents/${documentId}/comments`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        content: trimmed,
                        parentCommentId: parentCommentId || null,
                    }),
                });

                if (!res.ok) {
                    const message = await res.text();
                    throw new Error(message || "Failed to create comment");
                }

                if (parentCommentId) {
                    setReplyDrafts((prev) => ({ ...prev, [parentCommentId]: "" }));
                } else {
                    setNewComment("");
                }

                await loadComments();
            } catch (error) {
                console.error("[COMMENTS_CREATE]", error);
                toast.error("Failed to post comment");
            } finally {
                if (parentCommentId) {
                    setSubmittingReplyId(null);
                } else {
                    setIsSubmitting(false);
                }
            }
        },
        [documentId, loadComments]
    );

    const deleteComment = useCallback(
        async (commentId: string) => {
            try {
                const res = await fetch(`/api/documents/${documentId}/comments/${commentId}`, {
                    method: "DELETE",
                });

                if (!res.ok) {
                    const message = await res.text();
                    throw new Error(message || "Failed to delete comment");
                }

                await loadComments();
            } catch (error) {
                console.error("[COMMENTS_DELETE]", error);
                toast.error("Failed to delete comment");
            }
        },
        [documentId, loadComments]
    );

    const hasComments = comments.length > 0;
    const sectionTitle = useMemo(() => `Comments (${comments.length})`, [comments.length]);
    const sectionClassName =
        placement === "top"
            ? "mb-8 border-b border-border pb-6"
            : "mt-10 border-t border-border pt-8";

    return (
        <section className={sectionClassName}>
            <div className="mb-4 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                    {sectionTitle}
                </h3>
            </div>

            {canComment && (
                <div className="mb-6 space-y-2">
                    <TextareaAutosize
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        minRows={2}
                        maxRows={8}
                        placeholder="Add a comment..."
                        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            size="sm"
                            disabled={isSubmitting || !newComment.trim()}
                            onClick={() => submitComment(newComment)}
                        >
                            {isSubmitting ? "Posting..." : "Post comment"}
                        </Button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading comments...</p>
            ) : !hasComments ? (
                <p className="text-sm text-muted-foreground">
                    {canComment ? "No comments yet. Start the discussion." : "No comments."}
                </p>
            ) : (
                <div className="space-y-5">
                    {comments.map((comment) => (
                        <CommentRow
                            key={comment.id}
                            comment={comment}
                            canComment={canComment}
                            onDelete={deleteComment}
                            onReply={submitComment}
                            replyDraft={replyDrafts[comment.id] || ""}
                            setReplyDraft={(value) =>
                                setReplyDrafts((prev) => ({ ...prev, [comment.id]: value }))
                            }
                            submittingReply={submittingReplyId === comment.id}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
