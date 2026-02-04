"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { PageLink } from "./editor/extensions/page-link";
import { Image } from "./editor/extensions/image";
import { Bookmark } from "./editor/extensions/bookmark";
import { DragAndDropHandler } from "./editor/extensions/drag-and-drop-handler";
import { SlashCommand, getSuggestionItems, renderItems } from "./editor/slash-command";
import { useEffect, useCallback } from "react";
import { BlockMenu } from "./editor/block-menu";
import { LinkPastePopup } from "./editor/link-paste-popup";
import { documentEvents } from "@/lib/events";

interface EditorProps {
    documentId?: string;
    initialContent?: string;
    editable?: boolean;
    onChange?: (value: string) => void;
}

export const Editor = ({
    documentId,
    initialContent,
    editable = true,
    onChange
}: EditorProps) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                dropcursor: {
                    color: "#0096FF",
                    width: 2,
                },
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Link.configure({
                openOnClick: false,
                autolink: true
            }),
            PageLink,
            Image,
            Bookmark,
            DragAndDropHandler,
            SlashCommand.configure({
                suggestion: {
                    items: ({ query }: { query: string }) => getSuggestionItems({ query }),
                    render: renderItems,
                },
            }),
        ],
        content: (() => {
            if (typeof initialContent === 'string') {
                try {
                    const trimmed = initialContent.trim();
                    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                        const parsed = JSON.parse(trimmed);
                        if (parsed && typeof parsed === 'object') {
                            return parsed;
                        }
                    }
                } catch (e) {
                    // Fallback to string (HTML)
                }
            }
            return initialContent;
        })(),
        editable: editable,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            // Don't trigger onChange during server-initiated updates
            // @ts-ignore
            if (editor.storage.pageLink?.isServerUpdate) return;
            onChange?.(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: "prose dark:prose-invert focus:outline-none max-w-full leading-normal"
            },
            handleKeyDown: (view, event) => {
                if (event.key === "ArrowUp") {
                    const { selection } = view.state;
                    if (selection.$from.pos === 1) {
                        event.preventDefault();
                        const titleInput = document.getElementById("document-title");
                        if (titleInput) titleInput.focus();
                        return true;
                    }
                }
                return false;
            }
        }
    });

    // Memoized refetch function
    const refetchContent = useCallback(async () => {
        if (!editor || !documentId) return;

        try {
            const res = await fetch(`/api/documents/${documentId}`);
            if (!res.ok) return;

            const doc = await res.json();
            if (doc.content) {
                let content = doc.content;
                try {
                    const trimmed = content.trim();
                    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                        content = JSON.parse(trimmed);
                    }
                } catch (e) { }

                // Set flag to allow pageLink removal during server update
                if ((editor.storage as any).pageLink) {
                    (editor.storage as any).pageLink.isServerUpdate = true;
                }
                editor.commands.setContent(content);
                // Reset flag after update
                setTimeout(() => {
                    if ((editor.storage as any).pageLink) {
                        (editor.storage as any).pageLink.isServerUpdate = false;
                    }
                }, 50);
            }
        } catch (error) {
            console.error("Failed to refetch content", error);
        }
    }, [editor, documentId]);

    useEffect(() => {
        if (editor && documentId) {
            if ((editor.storage as any).slashCommand) {
                (editor.storage as any).slashCommand.documentId = documentId;
            }
        }

        const unsubscribe = documentEvents.subscribe((payload: any) => {
            if (payload.type === "CREATE_CHILD" && payload.parentId === documentId) {
                setTimeout(refetchContent, 200);
            }

            if (payload.type === "CONTENT_REFRESH" && payload.documentId === documentId) {
                refetchContent();
            }
        });

        return () => unsubscribe();
    }, [editor, documentId, refetchContent]);

    if (!editor) {
        return null;
    }

    return (
        <div className="w-full h-full min-h-[50vh] relative group/editor" onClick={() => editor.chain().focus().run()}>
            {editable && <BlockMenu editor={editor} />}
            {editable && <LinkPastePopup editor={editor} />}
            <EditorContent editor={editor} className="h-full" />
        </div>
    );
};
