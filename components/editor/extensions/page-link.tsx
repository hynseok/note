"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { NodeSelection, TextSelection, Plugin, PluginKey, Transaction, EditorState } from "@tiptap/pm/state";
import { FileIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PageLinkComponent = ({ node, deleteNode, getPos, editor }: any) => {
    const router = useRouter();
    const [data, setData] = useState<{ title: string; icon: string } | null>(null);

    useEffect(() => {
        const fetchDocument = async () => {
            try {
                const response = await fetch(`/api/documents/${node.attrs.id}`);
                if (response.ok) {
                    const doc = await response.json();
                    setData({ title: doc.title, icon: doc.icon });
                }
            } catch (error) {
                console.error("Failed to fetch document link data", error);
            }
        };

        fetchDocument();
    }, [node.attrs.id]);

    const title = data?.title || node.attrs.title;
    const icon = data?.icon || node.attrs.icon;

    const handleDragStart = (e: React.DragEvent) => {
        // Set document ID for sidebar drop support
        e.dataTransfer.setData("application/x-privatenote-document-id", node.attrs.id);
        e.dataTransfer.setData("application/x-privatenote-source", "editor");
        e.dataTransfer.effectAllowed = "move";

        // Select this node so ProseMirror knows what's being dragged
        if (typeof getPos === 'function') {
            const pos = getPos();
            if (pos !== undefined) {
                const tr = editor.view.state.tr.setSelection(
                    NodeSelection.create(editor.view.state.doc, pos)
                );
                editor.view.dispatch(tr);
            }
        }
    };

    return (
        <NodeViewWrapper className="page-link-block my-1 w-full block group">
            <div
                draggable="true"
                onDragStart={handleDragStart}
                onClick={() => {
                    router.push(`/documents/${node.attrs.id}`);
                }}
                className="flex items-center gap-1 p-1 px-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-sm cursor-pointer transition-colors w-full"
            >
                <div role="img" className="text-xl mr-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                    {icon || <FileIcon className="h-5 w-5 text-muted-foreground" />}
                </div>
                <span className="font-medium truncate underline decoration-neutral-300 underline-offset-4 text-neutral-700 dark:text-neutral-200 group-hover:text-primary transition-colors">
                    {title}
                </span>
            </div>
        </NodeViewWrapper>
    );
};

export const PageLink = Node.create({
    name: "pageLink",
    priority: 1000,
    group: "block",
    atom: true,
    isolating: true,

    addAttributes() {
        return {
            id: {
                default: null,
            },
            title: {
                default: "Untitled",
            },
            icon: {
                default: null,
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: "page-link",
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ["page-link", mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(PageLinkComponent);
    },

    addKeyboardShortcuts() {
        return {
            Backspace: () => {
                const { selection, doc } = this.editor.state;

                const isPageLinkSelected = (selection instanceof NodeSelection && selection.node.type.name === "pageLink") ||
                    (selection.from === selection.to - 1 && doc.nodeAt(selection.from)?.type.name === "pageLink");

                if (isPageLinkSelected) {
                    const pageLinkPos = selection.from;

                    if (pageLinkPos > 0) {
                        const $beforePageLink = doc.resolve(pageLinkPos);
                        const nodeBefore = $beforePageLink.nodeBefore;

                        if (nodeBefore && nodeBefore.isTextblock) {
                            const endOfPrevBlock = pageLinkPos - 1;
                            const tr = this.editor.state.tr.setSelection(
                                TextSelection.create(doc, endOfPrevBlock)
                            );
                            this.editor.view.dispatch(tr);
                            return true;
                        } else if (nodeBefore) {
                            const prevNodePos = pageLinkPos - nodeBefore.nodeSize;
                            const tr = this.editor.state.tr.setSelection(
                                NodeSelection.create(doc, prevNodePos)
                            );
                            this.editor.view.dispatch(tr);
                            return true;
                        }
                    }

                    const tr = this.editor.state.tr.setSelection(
                        TextSelection.create(doc, 0)
                    );
                    this.editor.view.dispatch(tr);
                    return true;
                }

                const { empty, $anchor } = selection;

                if (empty && $anchor.parentOffset === 0 && $anchor.depth > 0) {
                    const blockStart = $anchor.before($anchor.depth);

                    if (blockStart > 0) {
                        const $beforeBlock = doc.resolve(blockStart - 1);
                        const nodeBefore = $beforeBlock.nodeBefore;

                        if (nodeBefore && nodeBefore.type.name === "pageLink") {
                            const pageLinkStart = blockStart - nodeBefore.nodeSize;

                            if (pageLinkStart > 0) {
                                const $beforePageLink = doc.resolve(pageLinkStart - 1);
                                const nodeBeforePageLink = $beforePageLink.nodeBefore;

                                if (nodeBeforePageLink && nodeBeforePageLink.isTextblock) {
                                    const endOfPrevBlock = pageLinkStart - 1;
                                    const tr = this.editor.state.tr.setSelection(
                                        TextSelection.create(doc, endOfPrevBlock)
                                    );
                                    this.editor.view.dispatch(tr);
                                    return true;
                                } else if (nodeBeforePageLink) {
                                    const tr = this.editor.state.tr.setSelection(
                                        NodeSelection.create(doc, pageLinkStart)
                                    );
                                    this.editor.view.dispatch(tr);
                                    return true;
                                }
                            }

                            const tr = this.editor.state.tr.setSelection(
                                NodeSelection.create(doc, pageLinkStart)
                            );
                            this.editor.view.dispatch(tr);
                            return true;
                        }
                    }
                }
                return false;
            }
        };
    },

    addStorage() {
        return {
            isServerUpdate: false
        };
    },

    addProseMirrorPlugins() {
        const storage = this.storage;

        return [
            // Plugin to protect pageLinks from deletion (restores them if deleted)
            new Plugin({
                key: new PluginKey('protect-page-link'),
                appendTransaction: (transactions, oldState, newState) => {
                    // Skip protection during server-initiated updates
                    if (storage.isServerUpdate) return null;

                    // Only check if document changed
                    if (!transactions.some(tr => tr.docChanged)) return null;

                    // Collect old pageLinks with their data
                    const oldPageLinks = new Map<string, { title: string, icon: string | null }>();
                    oldState.doc.descendants((node) => {
                        if (node.type.name === 'pageLink' && node.attrs.id) {
                            oldPageLinks.set(node.attrs.id, {
                                title: node.attrs.title,
                                icon: node.attrs.icon
                            });
                        }
                    });

                    // Collect new pageLinks
                    const newPageLinks = new Set<string>();
                    newState.doc.descendants((node) => {
                        if (node.type.name === 'pageLink' && node.attrs.id) {
                            newPageLinks.add(node.attrs.id);
                        }
                    });

                    // Find deleted pageLinks
                    const deletedLinks: { id: string, title: string, icon: string | null }[] = [];
                    for (const [id, data] of oldPageLinks) {
                        if (!newPageLinks.has(id)) {
                            deletedLinks.push({ id, ...data });
                        }
                    }

                    // If no pageLinks were deleted, no need to restore
                    if (deletedLinks.length === 0) return null;

                    // Create transaction to restore deleted pageLinks at the end
                    const tr = newState.tr;
                    const endPos = newState.doc.content.size;

                    deletedLinks.forEach(({ id, title, icon }) => {
                        const node = newState.schema.nodes.pageLink.create({
                            id,
                            title,
                            icon
                        });
                        tr.insert(endPos, node);
                    });

                    return tr;
                }
            }),
            // Plugin to deduplicate pageLinks
            new Plugin({
                key: new PluginKey('unique-page-link'),
                appendTransaction: (transactions: readonly Transaction[], oldState: EditorState, newState: EditorState) => {
                    if (!transactions.some(tr => tr.docChanged)) {
                        return null;
                    }

                    const pageLinks = new Map<string, { pos: number, node: import("@tiptap/pm/model").Node }[]>();

                    newState.doc.descendants((node, pos) => {
                        if (node.type.name === 'pageLink') {
                            const id = node.attrs.id;
                            if (id) {
                                const existing = pageLinks.get(id) || [];
                                // @ts-ignore
                                existing.push({ pos, node });
                                pageLinks.set(id, existing);
                            }
                        }
                    });

                    const tr = newState.tr;
                    let modified = false;
                    const selectionPos = newState.selection.from;

                    pageLinks.forEach((instances, id) => {
                        if (instances.length > 1) {
                            instances.sort((a, b) => {
                                const distA = Math.abs(a.pos - selectionPos);
                                const distB = Math.abs(b.pos - selectionPos);
                                return distA - distB;
                            });

                            const toDelete = instances.slice(1).sort((a, b) => b.pos - a.pos);

                            toDelete.forEach(({ pos, node }) => {
                                // @ts-ignore
                                tr.delete(pos, pos + node.nodeSize);
                                modified = true;
                            });
                        }
                    });

                    return modified ? tr : null;
                }
            })
        ];
    },
});
