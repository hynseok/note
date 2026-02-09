"use client";

import { TiptapBubbleMenu, useTiptap } from "@tiptap/react";
import {
    Bold,
    Italic,
    Strikethrough,
    Highlighter,
    Code
} from "lucide-react";
import { cn } from "@/lib/utils";

export const EditorBubbleMenu = () => {
    const { editor } = useTiptap();
    if (!editor) return null;

    return (
        <TiptapBubbleMenu
            options={{
                placement: "top",
            }}
            className="flex items-center gap-0.5 bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl p-1 overflow-hidden z-[99999]"
        >
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn(
                    "p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                    editor.isActive("bold") ? "text-primary bg-primary/10" : "text-neutral-600 dark:text-neutral-400"
                )}
                title="Bold"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={cn(
                    "p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                    editor.isActive("italic") ? "text-primary bg-primary/10" : "text-neutral-600 dark:text-neutral-400"
                )}
                title="Italic"
            >
                <Italic className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={cn(
                    "p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                    editor.isActive("strike") ? "text-primary bg-primary/10" : "text-neutral-600 dark:text-neutral-400"
                )}
                title="Strike"
            >
                <Strikethrough className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={cn(
                    "p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                    editor.isActive("highlight") ? "text-amber-600 dark:text-amber-400 bg-amber-500/10" : "text-neutral-600 dark:text-neutral-400"
                )}
                title="Highlight"
            >
                <Highlighter className="w-4 h-4" />
            </button>

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={cn(
                    "p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
                    editor.isActive("code") ? "text-primary bg-primary/10" : "text-neutral-600 dark:text-neutral-400"
                )}
                title="Code"
            >
                <Code className="w-4 h-4" />
            </button>
        </TiptapBubbleMenu>
    );
};
