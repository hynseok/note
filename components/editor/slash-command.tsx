import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import {
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    MessageSquarePlus,
    Text,
    CheckSquare,
    FileText
} from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "sonner";
import { documentEvents } from "@/lib/events";

// Command List Component
const CommandList = forwardRef((props: any, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            props.command(item);
        }
    };

    useEffect(() => {
        setSelectedIndex(0);
    }, [props.items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === "ArrowUp") {
                setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
                return true;
            }
            if (event.key === "ArrowDown") {
                setSelectedIndex((selectedIndex + 1) % props.items.length);
                return true;
            }
            if (event.key === "Enter") {
                selectItem(selectedIndex);
                return true;
            }
            return false;
        },
    }));

    return (
        <div className="z-50 h-auto max-h-[330px] w-72 overflow-y-auto rounded-md border border-neutral-200 bg-white px-1 py-2 shadow-md transition-all dark:border-neutral-800 dark:bg-neutral-900">
            {props.items.length ? (
                props.items.map((item: any, index: number) => (
                    <button
                        className={`flex w-full items-center space-x-2 rounded-sm px-2 py-1 text-left text-sm text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800 ${index === selectedIndex ? "bg-neutral-100 dark:bg-neutral-800" : ""
                            }`}
                        key={index}
                        onClick={() => selectItem(index)}
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
                            {item.icon}
                        </div>
                        <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                    </button>
                ))
            ) : (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No result
                </div>
            )}
        </div>
    );
});

CommandList.displayName = "CommandList";

// Command List Items
export const getSuggestionItems = ({ query }: { query: string }) => {
    return [
        {
            title: "Text",
            description: "Just start typing with plain text.",
            searchTerms: ["p", "paragraph"],
            icon: <Text className="h-4 w-4" />,
            command: ({ editor, range }: any) => {
                editor
                    .chain()
                    .focus()
                    .deleteRange(range)
                    .toggleNode("paragraph", "paragraph")
                    .run();
            },
        },
        {
            title: "Page",
            description: "Embed a sub-page inside this document.",
            searchTerms: ["page", "new", "doc"],
            icon: <FileText className="h-4 w-4" />,
            command: async ({ editor, range, props }: any) => {
                const parentId = editor.storage.slashCommand.documentId;
                const title = "Untitled"; // Default title

                // Optimistic insertion (Link Text first)
                // Actually we need the ID to make the link. So we must fetch first or use a placeholder.
                // Let's create the document.

                // We need to access the documentId passed to the editor. 
                // We'll store it in editor.storage or pass it through props if possible contextually, 
                // but simpler to use a storage hack or context.
                // The implementation plan says "Call POST /api/documents".

                try {
                    const response = await fetch("/api/documents", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            title: title,
                            parentDocumentId: parentId
                        }),
                    });

                    if (!response.ok) {
                        toast.error("Failed to create page");
                        return;
                    }

                    const newDoc = await response.json();

                    documentEvents.emit({ type: "CREATE" }); // Notify sidebar

                    // Insert link to the new page
                    // We can use the standard Link extension or a custom node.
                    // For now, standard link is fine, but maybe a "mention" style would be better?
                    // Let's insert title with link.
                    // Insert custom PageLink node
                    editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .insertContent({
                            type: "pageLink",
                            attrs: {
                                id: newDoc.id,
                                title: newDoc.title,
                                icon: newDoc.icon
                            }
                        })
                        .run();


                    toast.success("Page created");
                } catch (error) {
                    toast.error("Failed to create page");
                }
            },
        },
        {
            title: "Heading 1",
            description: "Big section heading.",
            searchTerms: ["title", "big", "large"],
            icon: <Heading1 className="h-4 w-4" />,
            command: ({ editor, range }: any) => {
                editor
                    .chain()
                    .focus()
                    .deleteRange(range)
                    .setNode("heading", { level: 1 })
                    .run();
            },
        },
        {
            title: "Heading 2",
            description: "Medium section heading.",
            searchTerms: ["subtitle", "medium"],
            icon: <Heading2 className="h-4 w-4" />,
            command: ({ editor, range }: any) => {
                editor
                    .chain()
                    .focus()
                    .deleteRange(range)
                    .setNode("heading", { level: 2 })
                    .run();
            },
        },
        {
            title: "Heading 3",
            description: "Small section heading.",
            searchTerms: ["subtitle", "small"],
            icon: <Heading3 className="h-4 w-4" />,
            command: ({ editor, range }: any) => {
                editor
                    .chain()
                    .focus()
                    .deleteRange(range)
                    .setNode("heading", { level: 3 })
                    .run();
            },
        },
        {
            title: "Bullet List",
            description: "Create a simple bulleted list.",
            searchTerms: ["unordered", "point"],
            icon: <List className="h-4 w-4" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).toggleBulletList().run();
            },
        },
        {
            title: "Numbered List",
            description: "Create a list with numbering.",
            searchTerms: ["ordered"],
            icon: <ListOrdered className="h-4 w-4" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).toggleOrderedList().run();
            },
        },
        {
            title: "To-do List",
            description: "Track tasks with a to-do list.",
            searchTerms: ["todo", "task", "check", "square"],
            icon: <CheckSquare className="h-4 w-4" />,
            command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).toggleTaskList().run();
            },
        },
    ].filter((item) => {
        if (typeof query === "string" && query.length > 0) {
            const search = query.toLowerCase();
            return (
                item.title.toLowerCase().includes(search) ||
                item.description.toLowerCase().includes(search) ||
                (item.searchTerms && item.searchTerms.some((term: string) => term.includes(search)))
            );
        }
        return true;
    });
};

export const SlashCommand = Extension.create({
    name: "slashCommand",

    addStorage() {
        return {
            documentId: null,
        }
    },

    addOptions() {
        return {
            suggestion: {
                char: "/",
                command: ({ editor, range, props }: any) => {
                    props.command({ editor, range, props });
                },
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ];
    },
});

export const renderItems = () => {
    let component: ReactRenderer | null = null;
    let popup: any | null = null;

    return {
        onStart: (props: any) => {
            component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
            });

            // @ts-ignore
            popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
            });
        },
        onUpdate: (props: any) => {
            component?.updateProps(props);

            if (!props.clientRect) {
                return;
            }

            popup?.[0].setProps({
                getReferenceClientRect: props.clientRect,
            });
        },
        onKeyDown: (props: any) => {
            if (props.event.key === "Escape") {
                popup?.[0].hide();
                return true;
            }

            // @ts-ignore
            return component?.ref?.onKeyDown(props);
        },
        onExit: () => {
            popup?.[0].destroy();
            component?.destroy();
        },
    };
};
