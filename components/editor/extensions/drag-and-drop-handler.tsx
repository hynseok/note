"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, NodeSelection } from "@tiptap/pm/state";
import { Node } from "@tiptap/pm/model";
import { toast } from "sonner";
import { documentEvents } from "@/lib/events";

export const DragAndDropHandler = Extension.create({
    name: "dragAndDropHandler",

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey("dragAndDropHandler"),
                props: {
                    handleDOMEvents: {
                        dragstart: (view, event) => {
                            if (!event.dataTransfer) return false;

                            const { selection } = view.state;
                            if (selection instanceof NodeSelection && selection.node.type.name === 'pageLink') {
                                const id = selection.node.attrs.id;
                                if (id) {
                                    event.dataTransfer.setData("application/x-privatenote-document-id", id);
                                    event.dataTransfer.setData("application/x-privatenote-source", "editor");
                                    event.dataTransfer.effectAllowed = "move";
                                }
                            }
                            return false;
                        }
                    },
                    handleDrop: (view, event, slice, moved) => {
                        const draggedId = event.dataTransfer?.getData("application/x-privatenote-document-id");

                        if (!draggedId) return false;

                        const coordinates = view.posAtCoords({
                            left: event.clientX,
                            top: event.clientY,
                        });

                        if (!coordinates) return false;

                        // Check if the dragged link already exists in the document (Internal Move)
                        let existingNode: { node: Node, pos: number } | null = null;

                        view.state.doc.descendants((node, pos) => {
                            if (node.type.name === 'pageLink' && node.attrs.id === draggedId) {
                                existingNode = { node, pos };
                                return false;
                            }
                        });

                        // If it exists, let ProseMirror handle the internal move
                        if (existingNode) {
                            return false;
                        }

                        // @ts-ignore
                        const currentDocId = this.editor.storage.slashCommand?.documentId;

                        if (currentDocId && draggedId === currentDocId) {
                            toast.error("Cannot move a document into itself");
                            return true;
                        }

                        // External drop: reparent the document
                        if (currentDocId) {
                            fetch(`/api/documents/${draggedId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ parentDocumentId: currentDocId })
                            }).then(async (res) => {
                                if (res.ok) {
                                    const data = await res.json();

                                    // Insert PageLink at drop position
                                    const { state } = view;
                                    const { pos } = coordinates;

                                    const node = state.schema.nodes.pageLink.create({
                                        id: data.id,
                                        title: data.title,
                                        icon: data.icon
                                    });

                                    const tr = state.tr.insert(pos, node);
                                    view.dispatch(tr);

                                    toast.success("Note moved!");

                                    // Emit CONTENT_REFRESH for current editor and sidebar update
                                    documentEvents.emit({ type: "CONTENT_REFRESH", documentId: currentDocId });
                                    documentEvents.emit({ type: "UPDATE" });
                                } else {
                                    const errorText = await res.text();
                                    if (errorText.includes("descendant")) {
                                        throw new Error("Cannot move a parent into its child");
                                    }
                                    throw new Error("Failed to move note");
                                }
                            }).catch((err) => {
                                toast.error(err.message || "Failed to move note");
                            });
                        }

                        return true;
                    },
                },
            }),
        ];
    },
});
