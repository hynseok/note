import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface ImageOptions {
    HTMLAttributes: Record<string, unknown>;
    uploadFn: (file: File) => Promise<string>;
}

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        image: {
            setImage: (options: { src: string; alt?: string; title?: string }) => ReturnType;
        };
    }
}

export const Image = Node.create<ImageOptions>({
    name: "image",

    addOptions() {
        return {
            HTMLAttributes: {},
            uploadFn: async (file: File) => {
                const formData = new FormData();
                formData.append("file", file);

                const response = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error("Upload failed");
                }

                const data = await response.json();
                return data.url;
            },
        };
    },

    group: "block",

    draggable: true,

    addAttributes() {
        return {
            src: {
                default: null,
            },
            alt: {
                default: null,
            },
            title: {
                default: null,
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: "img[src]",
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            "div",
            { class: "image-wrapper my-4" },
            [
                "img",
                mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                    class: "max-w-full h-auto rounded-lg",
                }),
            ],
        ];
    },

    addCommands() {
        return {
            setImage:
                (options) =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs: options,
                        });
                    },
        };
    },

    addProseMirrorPlugins() {
        const uploadFn = this.options.uploadFn;

        return [
            new Plugin({
                key: new PluginKey("imagePaste"),
                props: {
                    handlePaste: (view, event) => {
                        const items = Array.from(event.clipboardData?.items || []);
                        const imageItem = items.find((item) => item.type.startsWith("image/"));

                        if (!imageItem) {
                            return false;
                        }

                        event.preventDefault();

                        const file = imageItem.getAsFile();
                        if (!file) return false;

                        // Insert placeholder
                        const { tr } = view.state;
                        const placeholderText = "Uploading image...";

                        // Upload and insert image
                        uploadFn(file)
                            .then((url) => {
                                const { state } = view;
                                const node = state.schema.nodes.image.create({ src: url });
                                const transaction = state.tr.replaceSelectionWith(node);
                                view.dispatch(transaction);
                            })
                            .catch((err) => {
                                console.error("Image upload failed:", err);
                            });

                        return true;
                    },
                    handleDrop: (view, event, slice, moved) => {
                        if (moved) return false;

                        const files = Array.from(event.dataTransfer?.files || []);
                        const imageFile = files.find((file) => file.type.startsWith("image/"));

                        if (!imageFile) {
                            return false;
                        }

                        event.preventDefault();

                        // Get drop position
                        const coordinates = view.posAtCoords({
                            left: event.clientX,
                            top: event.clientY,
                        });

                        if (!coordinates) return false;

                        // Upload and insert image at drop position
                        uploadFn(imageFile)
                            .then((url) => {
                                const { state } = view;
                                const node = state.schema.nodes.image.create({ src: url });
                                const transaction = state.tr.insert(coordinates.pos, node);
                                view.dispatch(transaction);
                            })
                            .catch((err) => {
                                console.error("Image upload failed:", err);
                            });

                        return true;
                    },
                },
            }),
        ];
    },
});
