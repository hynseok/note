"use client";

import { Editor } from "@tiptap/react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LinkIcon, BookmarkIcon, Loader2Icon } from "lucide-react";

interface LinkPastePopupProps {
    editor: Editor;
}

export const LinkPastePopup = ({ editor }: LinkPastePopupProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [url, setUrl] = useState("");
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [insertPos, setInsertPos] = useState<number | null>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const text = event.clipboardData?.getData("text/plain");

            // Check if it's a URL
            if (text && isValidUrl(text)) {
                // Check if the selection is not inside a code block
                const { selection } = editor.state;
                const node = selection.$from.parent;

                if (node.type.name === "codeBlock") {
                    return; // Allow default paste in code blocks
                }

                // Prevent default AND stop propagation to other handlers
                event.preventDefault();
                event.stopImmediatePropagation();

                setUrl(text);
                setInsertPos(selection.from);

                // Get cursor position for popup
                const coords = editor.view.coordsAtPos(selection.from);
                setPosition({ x: coords.left, y: coords.bottom + 8 });
                setIsOpen(true);
            }
        };

        const editorDom = editor.view.dom;
        // Use capture phase to intercept before other handlers
        editorDom.addEventListener("paste", handlePaste, true);

        return () => {
            editorDom.removeEventListener("paste", handlePaste, true);
        };
    }, [editor]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const isValidUrl = (str: string): boolean => {
        try {
            const url = new URL(str);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch {
            return false;
        }
    };

    const handleInsertLink = () => {
        // Insert the URL text first, then convert it to a link
        editor
            .chain()
            .focus()
            .insertContent(url)
            .setTextSelection({
                from: editor.state.selection.from - url.length,
                to: editor.state.selection.from,
            })
            .setLink({ href: url })
            .run();
        setIsOpen(false);
        setUrl("");
    };

    const handleInsertBookmark = async () => {
        setIsLoading(true);

        const insertBookmark = (attrs: {
            url: string;
            title: string;
            description: string;
            image: string | null;
            favicon: string | null;
        }) => {
            console.log("Inserting bookmark:", attrs);
            const success = editor
                .chain()
                .focus()
                .insertContent({
                    type: "bookmark",
                    attrs,
                })
                .createParagraphNear()
                .run();
            console.log("Insert success:", success);
        };

        try {
            const response = await fetch("/api/link-preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });

            console.log("API response status:", response.status);

            if (response.ok) {
                const data = await response.json();
                console.log("API data:", data);
                insertBookmark({
                    url: data.url,
                    title: data.title,
                    description: data.description,
                    image: data.image,
                    favicon: data.favicon,
                });
            } else {
                // Fallback to simple bookmark without preview
                insertBookmark({
                    url,
                    title: new URL(url).hostname,
                    description: "",
                    image: null,
                    favicon: null,
                });
            }
        } catch (error) {
            console.error("Failed to fetch link preview:", error);
            // Fallback
            insertBookmark({
                url,
                title: new URL(url).hostname,
                description: "",
                image: null,
                favicon: null,
            });
        }

        setIsLoading(false);
        setIsOpen(false);
        setUrl("");
    };

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div
            ref={popupRef}
            className="fixed z-[99999] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-1 min-w-[200px]"
            style={{
                top: position.y,
                left: position.x,
            }}
        >
            <div className="text-xs text-neutral-500 px-2 py-1">
                링크 삽입 방식 선택
            </div>
            <button
                onClick={handleInsertLink}
                disabled={isLoading}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors disabled:opacity-50"
            >
                <LinkIcon className="w-4 h-4" />
                <span>URL로 삽입</span>
            </button>
            <button
                onClick={handleInsertBookmark}
                disabled={isLoading}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors disabled:opacity-50"
            >
                {isLoading ? (
                    <Loader2Icon className="w-4 h-4 animate-spin" />
                ) : (
                    <BookmarkIcon className="w-4 h-4" />
                )}
                <span>북마크로 삽입</span>
            </button>
        </div>,
        document.body
    );
};
