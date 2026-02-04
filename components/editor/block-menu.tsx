"use client";

import { Editor } from "@tiptap/react";
import { GripVertical, Plus } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface BlockMenuProps {
    editor: Editor;
}

interface ActiveBlock {
    pos: number;
    dom: HTMLElement;
    index: number;
}

export const BlockMenu = ({ editor }: BlockMenuProps) => {
    const [activeBlock, setActiveBlock] = useState<ActiveBlock | null>(null);
    const [mounted, setMounted] = useState(false);
    const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const draggedBlockRef = useRef<ActiveBlock | null>(null);
    const isDraggingRef = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const findBlockFromPoint = useCallback((y: number): ActiveBlock | null => {
        if (!editor?.view?.dom) return null;

        const children = Array.from(editor.view.dom.children) as HTMLElement[];

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const rect = child.getBoundingClientRect();

            if (y >= rect.top - 5 && y <= rect.bottom + 5) {
                try {
                    // Try to get position for regular blocks
                    const pos = editor.view.posAtDOM(child, 0);
                    if (pos >= 0) {
                        const $pos = editor.view.state.doc.resolve(pos);
                        let blockPos = $pos.before($pos.depth);
                        if (blockPos < 0) blockPos = 0;
                        return { pos: blockPos, dom: child, index: i };
                    }
                } catch (e) {
                    // For NodeView elements (like PageLink), try a different approach
                    // They still count as blocks at index i
                    try {
                        // Get position from document children
                        const doc = editor.view.state.doc;
                        if (i < doc.childCount) {
                            let pos = 0;
                            for (let j = 0; j < i; j++) {
                                pos += doc.child(j).nodeSize;
                            }
                            return { pos, dom: child, index: i };
                        }
                    } catch (e2) {
                        // Ignore
                    }
                }
            }
        }
        return null;
    }, [editor]);

    const getDropIndex = useCallback((y: number): number => {
        if (!editor?.view?.dom) return 0;

        const children = Array.from(editor.view.dom.children) as HTMLElement[];

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const rect = child.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            if (y < midY) {
                return i;
            }
        }
        return children.length;
    }, [editor]);

    const isOverEditor = useCallback((clientX: number, clientY: number): boolean => {
        if (!editor?.view?.dom) return false;
        const rect = editor.view.dom.getBoundingClientRect();
        return clientX >= rect.left - 30 &&
            clientX <= rect.right + 30 &&
            clientY >= rect.top - 20 &&
            clientY <= rect.bottom + 20;
    }, [editor]);

    const handleDragEnd = useCallback((e?: DragEvent) => {
        // If the drag was a move operation (e.g. dropped in sidebar), remove the block
        // Only trigger this if we haven't already processed the drop internaly (draggedBlockRef check)
        if (isDraggingRef.current && e?.dataTransfer?.dropEffect === "move" && draggedBlockRef.current) {
            const pos = draggedBlockRef.current.pos;
            if (typeof pos === "number") {
                try {
                    const node = editor.state.doc.nodeAt(pos);
                    if (node) {
                        editor.chain().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
                    }
                } catch (err) {
                    console.error("Failed to delete moved block", err);
                }
            }
        }

        isDraggingRef.current = false;
        draggedBlockRef.current = null;
        setDropIndicatorIndex(null);

        const ghost = document.getElementById("drag-ghost");
        if (ghost) ghost.remove();
    }, [editor]);

    const handleDragOver = useCallback((e: DragEvent) => {
        if (!draggedBlockRef.current) return;

        if (isOverEditor(e.clientX, e.clientY)) {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = "move";
            }
            const dropIdx = getDropIndex(e.clientY);
            setDropIndicatorIndex(dropIdx);
        } else {
            setDropIndicatorIndex(null);
        }
    }, [isOverEditor, getDropIndex]);

    const handleDrop = useCallback((e: DragEvent) => {
        const draggedBlock = draggedBlockRef.current;
        if (!draggedBlock) return;

        e.preventDefault();
        e.stopPropagation();

        if (!isOverEditor(e.clientX, e.clientY)) {
            handleDragEnd();
            return;
        }

        const dropIndex = getDropIndex(e.clientY);
        const sourceIndex = draggedBlock.index;

        if (dropIndex === sourceIndex || dropIndex === sourceIndex + 1) {
            handleDragEnd();
            return;
        }

        try {
            const { doc } = editor.view.state;
            const sourceNode = doc.child(sourceIndex);

            let sourceStart = 0;
            for (let i = 0; i < sourceIndex; i++) {
                sourceStart += doc.child(i).nodeSize;
            }
            const sourceEnd = sourceStart + sourceNode.nodeSize;

            let tr = editor.view.state.tr;
            tr = tr.delete(sourceStart, sourceEnd);

            let targetPos = 0;
            const adjustedDropIndex = dropIndex > sourceIndex ? dropIndex - 1 : dropIndex;
            const intermediateDoc = tr.doc;

            for (let i = 0; i < adjustedDropIndex; i++) {
                targetPos += intermediateDoc.child(i).nodeSize;
            }

            tr = tr.insert(targetPos, sourceNode);
            editor.view.dispatch(tr);
            editor.commands.focus();

            // Successfully dropped internally. 
            // Reset dragging state here so handleDragEnd doesn't try to delete again if specific conditions met
            isDraggingRef.current = false;
            draggedBlockRef.current = null;
            setDropIndicatorIndex(null);
        } catch (err) {
            console.error("Drop error:", err);
            handleDragEnd(); // Reset on error
        }
    }, [editor, getDropIndex, isOverEditor, handleDragEnd]);

    useEffect(() => {
        if (!editor) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingRef.current) return;

            const target = e.target as HTMLElement;
            if (menuRef.current?.contains(target)) return;

            const editorRect = editor.view.dom.getBoundingClientRect();
            const isNear =
                e.clientX >= editorRect.left - 60 &&
                e.clientX <= editorRect.right + 10 &&
                e.clientY >= editorRect.top - 5 &&
                e.clientY <= editorRect.bottom + 5;

            if (!isNear) {
                setActiveBlock(null);
                return;
            }

            const block = findBlockFromPoint(e.clientY);
            setActiveBlock(block);
        };

        const handleMouseLeave = () => {
            if (isDraggingRef.current) return;
            setTimeout(() => {
                if (!menuRef.current?.matches(':hover')) {
                    setActiveBlock(null);
                }
            }, 100);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("dragover", handleDragOver);
        document.addEventListener("dragend", handleDragEnd);
        document.addEventListener("drop", handleDrop);
        editor.view.dom.addEventListener("mouseleave", handleMouseLeave);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("dragover", handleDragOver);
            document.removeEventListener("dragend", handleDragEnd);
            document.removeEventListener("drop", handleDrop);
            editor.view.dom.removeEventListener("mouseleave", handleMouseLeave);
        };
    }, [editor, findBlockFromPoint, handleDragEnd, handleDragOver, handleDrop]);

    const handleDragStart = (e: React.DragEvent) => {
        if (!activeBlock) return;

        draggedBlockRef.current = activeBlock;
        isDraggingRef.current = true;

        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-block-drag", String(activeBlock.index));

        try {
            // @ts-ignore
            const pos = activeBlock.pos;
            if (typeof pos === "number") {
                const node = editor.state.doc.nodeAt(pos);
                if (node && node.type.name === "pageLink" && node.attrs.id) {
                    e.dataTransfer.setData("application/x-privatenote-document-id", node.attrs.id);
                    // Do NOT set text/plain to avoid URL text insertion bug in editor
                }
            }
        } catch (err) {
            console.error("Failed to set document drag data", err);
        }

        const clone = activeBlock.dom.cloneNode(true) as HTMLElement;
        clone.id = "drag-ghost";
        clone.style.position = "absolute";
        clone.style.top = "-1000px";
        clone.style.opacity = "0.8";
        clone.style.width = `${activeBlock.dom.offsetWidth}px`;
        document.body.appendChild(clone);
        e.dataTransfer.setDragImage(clone, 0, 0);

        requestAnimationFrame(() => {
            // We keep the clone for drag image until end, or remove it?
            // Standard practice is to let browser handle drag image.
            // If we remove it immediately, some browsers might lose it. 
            // But usually it's captured on start.
            // Previous code removed it immediately. Let's stick to that if it worked.
            // But I added an ID to remove it in dragEnd just in case.
        });

        // Remove clone slightly later to ensure browser captured it
        setTimeout(() => {
            const ghost = document.getElementById("drag-ghost");
            if (ghost) ghost.remove();
        }, 0);
    };

    const handleAddBlock = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!activeBlock) return;

        try {
            const node = editor.view.state.doc.nodeAt(activeBlock.pos);
            if (node) {
                const insertPos = activeBlock.pos + node.nodeSize;
                editor
                    .chain()
                    .focus()
                    .insertContentAt(insertPos, { type: "paragraph" })
                    .setTextSelection(insertPos + 1)
                    .run();
            } else {
                editor.chain().focus("end").createParagraphNear().run();
            }
        } catch (err) {
            console.error("Add block error:", err);
            editor.chain().focus("end").createParagraphNear().run();
        }
    };

    if (!mounted || !editor?.view?.dom) return null;

    const isVisible = activeBlock !== null && !isDraggingRef.current;
    const blockRect = activeBlock?.dom.getBoundingClientRect();

    let dropIndicatorY: number | null = null;
    if (dropIndicatorIndex !== null && isDraggingRef.current) {
        const children = Array.from(editor.view.dom.children) as HTMLElement[];
        if (children.length > 0) {
            if (dropIndicatorIndex === 0) {
                dropIndicatorY = children[0].getBoundingClientRect().top;
            } else if (dropIndicatorIndex <= children.length) {
                dropIndicatorY = children[dropIndicatorIndex - 1].getBoundingClientRect().bottom;
            }
        }
    }

    const editorRect = editor.view.dom.getBoundingClientRect();

    return createPortal(
        <>
            <div
                ref={menuRef}
                className={`fixed flex items-center gap-0.5 transition-opacity duration-100 z-[99999] ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                style={{
                    top: blockRect?.top ?? 0,
                    left: (blockRect?.left ?? 0) - 52,
                }}
            >
                <button
                    type="button"
                    onClick={handleAddBlock}
                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    title="Click to add below"
                >
                    <Plus className="w-4 h-4" />
                </button>

                <div
                    draggable="true"
                    onDragStart={handleDragStart}
                    className="flex items-center justify-center w-6 h-6 rounded cursor-grab active:cursor-grabbing hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    title="Drag to move"
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            </div>

            {dropIndicatorY !== null && (
                <div
                    className="fixed z-[99999] pointer-events-none flex items-center"
                    style={{
                        top: dropIndicatorY - 2,
                        left: editorRect.left - 8,
                        width: editorRect.width + 16,
                    }}
                >
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <div className="flex-1 h-1 bg-blue-500" />
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                </div>
            )}
        </>,
        document.body
    );
};
