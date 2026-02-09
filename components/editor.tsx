"use client";

import { useEditor, EditorContent, Tiptap } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import { BubbleMenu as BubbleMenuExtension } from "@tiptap/extension-bubble-menu";

import { PageLink } from "./editor/extensions/page-link";
import { Image } from "./editor/extensions/image";
import { Bookmark } from "./editor/extensions/bookmark";
import { DragAndDropHandler } from "./editor/extensions/drag-and-drop-handler";
import { FileAttachment } from "./editor/extensions/file-attachment";
import { SlashCommand, getSuggestionItems, renderItems } from "./editor/slash-command";
import { EditorBubbleMenu } from "./editor/bubble-menu";

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
                code: {
                    HTMLAttributes: {
                        class: 'rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono font-medium text-destructive',
                    },
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
            FileAttachment,
            SlashCommand.configure({
                suggestion: {
                    items: ({ query }: { query: string }) => getSuggestionItems({ query }),
                    render: renderItems,
                },
            }),
            Highlight.configure({
                multicolor: true,
            }),
            BubbleMenuExtension,
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
            },
            handlePaste: (view, event) => {
                const text = event.clipboardData?.getData('text/plain');
                const html = event.clipboardData?.getData('text/html');

                // If no HTML but we have text that looks like markdown, parse it
                if (!html && text) {
                    const isMarkdown = /^(#|\*|- |>|`)/m.test(text);
                    if (isMarkdown) {
                        event.preventDefault(); // Prevent default paste immediately

                        // Dynamically import to avoid circular dependency
                        import("@/lib/markdown-parser").then(({ parseMarkdownToHTML }) => {
                            const parsedHTML = parseMarkdownToHTML(text);

                            // Parse HTML to ProseMirror Node
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(parsedHTML, 'text/html');
                            import("@tiptap/pm/model").then(({ DOMParser: PMDOMParser }) => {
                                const fragment = PMDOMParser.fromSchema(view.state.schema).parseSlice(doc.body);
                                view.dispatch(view.state.tr.replaceSelection(fragment));
                            });
                        }).catch(e => {
                            console.error("Markdown paste failed", e);
                            // Fallback: insert as text?
                            view.dispatch(view.state.tr.insertText(text));
                        });
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

            // Handle real-time remote updates from WebSocket
            if (payload.type === "REMOTE_CONTENT_UPDATE" && payload.documentId === documentId) {
                if (!editor || !payload.content) return;

                try {
                    let content = payload.content;
                    const trimmed = content.trim();
                    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                        content = JSON.parse(trimmed);
                    }

                    // Set flag to prevent onChange trigger
                    if ((editor.storage as any).pageLink) {
                        (editor.storage as any).pageLink.isServerUpdate = true;
                    }

                    editor.commands.setContent(content);

                    // Reset flag
                    setTimeout(() => {
                        if ((editor.storage as any).pageLink) {
                            (editor.storage as any).pageLink.isServerUpdate = false;
                        }
                    }, 50);
                } catch (error) {
                    console.error("Failed to apply remote content update", error);
                }
            }

            if (payload.type === "DELETE") {
                const { id } = payload;
                if (!id || !editor) return;

                // Set flag to bypass protection plugin
                if ((editor.storage as any).pageLink) {
                    (editor.storage as any).pageLink.bypassProtection = true;
                }

                // Find and remove ALL pageLink nodes with this ID
                let found = true;
                while (found) {
                    found = false;
                    let posToDelete: { from: number, to: number } | null = null;

                    editor.state.doc.descendants((node, pos) => {
                        if (node.type.name === 'pageLink' && node.attrs.id === id) {
                            posToDelete = { from: pos, to: pos + node.nodeSize };
                            found = true;
                            return false;
                        }
                    });

                    if (posToDelete) {
                        editor.commands.deleteRange(posToDelete);
                    }
                }

                // Reset flag
                setTimeout(() => {
                    if ((editor.storage as any).pageLink) {
                        (editor.storage as any).pageLink.bypassProtection = false;
                    }
                }, 50);
            }
        });

        return () => unsubscribe();
    }, [editor, documentId, refetchContent]);

    if (!editor) {
        return null;
    }

    return (
        <Tiptap instance={editor}>
            <div className="w-full h-full min-h-[50vh] relative group/editor" onClick={() => editor.chain().focus().run()}>
                {editable && <BlockMenu editor={editor} />}
                {editable && <LinkPastePopup editor={editor} />}
                {editable && <EditorBubbleMenu />}
                <EditorContent editor={editor} className="h-full" />
            </div>
        </Tiptap>
    );
};
