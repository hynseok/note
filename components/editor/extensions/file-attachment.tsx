import { mergeAttributes, Node, nodeInputRule } from '@tiptap/core';
import { parseMarkdownToHTML } from '@/lib/markdown-parser';
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface FileAttachmentOptions {
    HTMLAttributes: Record<string, unknown>;
    uploadFn: (file: File) => Promise<string>;
}

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        fileAttachment: {
            setFileAttachment: (options: { src: string; title: string; size?: string; type?: string }) => ReturnType;
        };
    }
}

const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();

    // Default File Icon (Lucide File)
    const defaultIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;

    // PDF Icon (FileText) - Red
    const pdfIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13H8"/><path d="M16 13h-2.5"/><path d="M10 17h6"/></svg>`;

    // Image Icon (Image) - Blue
    const imageIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;

    // Video Icon (Video) - Purple
    const videoIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-video"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>`;

    // Audio Icon (Music) - Pink
    const audioIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-music"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;

    // Code Icon (Code) - Green
    const codeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-code"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;

    // Archive Icon (Archive) - Orange
    const archiveIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-archive"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>`;

    if (ext === 'pdf') return { icon: pdfIcon, colorClass: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400" };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return { icon: imageIcon, colorClass: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" };
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext || '')) return { icon: videoIcon, colorClass: "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400" };
    if (['mp3', 'wav', 'ogg'].includes(ext || '')) return { icon: audioIcon, colorClass: "bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400" };
    if (['js', 'ts', 'tsx', 'jsx', 'html', 'css', 'json', 'py', 'java', 'c', 'cpp'].includes(ext || '')) return { icon: codeIcon, colorClass: "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400" };
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return { icon: archiveIcon, colorClass: "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400" };

    return { icon: defaultIcon, colorClass: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400" };
}

export const FileAttachment = Node.create<FileAttachmentOptions>({
    name: "fileAttachment",

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
                parseHTML: (element) => element.getAttribute('data-src'),
                renderHTML: (attributes) => {
                    return {
                        'data-src': attributes.src,
                    }
                },
            },
            title: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-title'),
                renderHTML: (attributes) => {
                    return {
                        'data-title': attributes.title,
                    }
                },
            },
            size: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-size'),
                renderHTML: (attributes) => {
                    return {
                        'data-size': attributes.size,
                    }
                },
            },
            type: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-type-file'),
                renderHTML: (attributes) => {
                    return {
                        'data-type-file': attributes.type,
                    }
                },
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: "div[data-type='file-attachment']",
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            "div",
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                "data-type": "file-attachment",
                class: "file-attachment-wrapper",
            }),
        ];
    },

    addNodeView() {
        return ({ node, getPos, editor }) => {
            const dom = document.createElement('div');
            dom.className = "file-attachment-wrapper group my-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#202020] hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors select-none shadow-sm block overflow-hidden";
            dom.contentEditable = "false";
            dom.setAttribute('data-type', 'file-attachment');

            // Header Container (The Card)
            const header = document.createElement('div');
            header.className = "flex items-center gap-3 p-2.5 cursor-pointer";

            // Style Icon
            const { icon, colorClass } = getFileIcon(node.attrs.title || "file");

            // Icon Container
            const iconDiv = document.createElement('div');
            iconDiv.className = `flex items-center justify-center w-8 h-8 rounded-md shrink-0 ml-2 ${colorClass}`;
            iconDiv.innerHTML = icon;

            // Content Container
            const contentDiv = document.createElement('div');
            contentDiv.className = "flex-1 min-w-0 flex flex-col justify-center";

            // Title Link
            const link = document.createElement('a');
            link.href = node.attrs.src;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.className = "block text-sm font-medium truncate text-neutral-700 dark:text-neutral-200 hover:text-primary transition-colors hover:underline decoration-primary decoration-2 underline-offset-2";
            link.textContent = node.attrs.title || "Attachment";
            link.onclick = (e) => e.stopPropagation();

            // Size Text
            const sizeText = document.createElement('p');
            sizeText.className = "text-[10px] text-muted-foreground mt-0.5 font-mono";
            sizeText.textContent = node.attrs.size || "";

            contentDiv.appendChild(link);
            contentDiv.appendChild(sizeText);

            // Download Button (visible on hover)
            const downloadBtn = document.createElement('a');
            downloadBtn.href = node.attrs.src;
            downloadBtn.download = node.attrs.title || "download";
            downloadBtn.target = "_blank";
            downloadBtn.className = "opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-muted-foreground";
            downloadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`;

            // Preview Button (visible on hover for PDFs)
            let previewBtn: HTMLButtonElement | null = null;
            // Analyze Button (visible on hover for PDFs - sparkles icon)
            let analyzeBtn: HTMLButtonElement | null = null;

            const isPdf = node.attrs.type === 'application/pdf' || node.attrs.title?.toLowerCase().endsWith('.pdf') || node.attrs.src?.toLowerCase().endsWith('.pdf');

            if (isPdf) {
                // Preview Button
                previewBtn = document.createElement('button');
                previewBtn.className = "opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-muted-foreground mr-1";
                previewBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
                previewBtn.title = "Toggle Preview";
                previewBtn.addEventListener('click', (e) => e.stopPropagation());

                // Analyze Button
                analyzeBtn = document.createElement('button');
                analyzeBtn.className = "opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-muted-foreground mr-1";
                // Sparkles Icon
                analyzeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/></svg>`;
                analyzeBtn.title = "Analyze with AI";
                analyzeBtn.addEventListener('click', (e) => e.stopPropagation());
            }

            header.appendChild(iconDiv);
            header.appendChild(contentDiv);
            if (analyzeBtn) header.appendChild(analyzeBtn);
            if (previewBtn) header.appendChild(previewBtn);
            header.appendChild(downloadBtn);

            dom.appendChild(header);

            // PDF Preview & AI Analysis Result Container
            if (isPdf) {
                const pdfContainer = document.createElement('div');
                pdfContainer.className = "hidden w-full h-[800px] border-t border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900";

                const iframe = document.createElement('iframe');
                iframe.src = node.attrs.src;
                iframe.className = "w-full h-full";
                iframe.setAttribute('loading', 'lazy');
                pdfContainer.appendChild(iframe);
                dom.appendChild(pdfContainer);

                // AI Result Container
                const aiContainer = document.createElement('div');
                aiContainer.className = "hidden w-full p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-sm leading-relaxed prose dark:prose-invert max-w-none";
                dom.appendChild(aiContainer);

                // Toggle Logic for Preview
                if (previewBtn) {
                    previewBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Hide AI if open? Optional. Let's keep them independent.
                        const isHidden = pdfContainer.classList.contains('hidden');
                        if (isHidden) {
                            pdfContainer.classList.remove('hidden');
                            previewBtn!.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;
                        } else {
                            pdfContainer.classList.add('hidden');
                            previewBtn!.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
                        }
                    });
                }

                // Logic for Analyze
                if (analyzeBtn) {
                    analyzeBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const isHidden = aiContainer.classList.contains('hidden');

                        if (!isHidden) {
                            // Just toggle off
                            aiContainer.classList.add('hidden');
                            aiContainer.style.display = '';
                            return;
                        }

                        // Open and Loading
                        console.log("Analyzing document: started");
                        aiContainer.classList.remove('hidden');
                        aiContainer.style.display = 'block'; // Force display
                        aiContainer.innerHTML = `
                            <div class="flex items-center gap-2 text-muted-foreground p-2">
                                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg> 
                                <span>Analyzing document...</span>
                            </div>
                        `;

                        try {
                            // Extract document ID from URL path (e.g. /documents/[id])
                            // This is tricky inside a node view as we don't have router param directly easily 
                            // BUT we are in a text editor, usually the URL is the document.
                            const docId = window.location.pathname.split('/').pop();

                            if (!docId) throw new Error("Document ID not found");

                            const response = await fetch(`/api/documents/${docId}/analyze`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ fileUrl: node.attrs.src })
                            });

                            if (!response.ok) throw new Error("Analysis failed");

                            const data = await response.json();

                            // Insert summary into editor
                            // We want to insert it after the current node.
                            // getPos() gives the position of the file attachment node.
                            const pos = getPos();
                            if (typeof pos === 'number') {
                                // Create content structure for the summary
                                // We'll use a heading and then paragraphs
                                // data.summary is markdown-like text, we need to convert it or insert as text
                                // For simplicity, let's insert as Markdown if editor supports it, 
                                // or just paragraphs. The editor is Tiptap, so we can insert HTML or JSON.
                                // Let's assume data.summary is plain text with some markdown.

                                // We can use the 'insertContentAt' command.
                                // We want to insert AFTER the file attachment. 
                                // The file attachment node size is 1.
                                const insertPos = pos + node.nodeSize;

                                // Convert markdown to HTML using our custom parser
                                const htmlContent = parseMarkdownToHTML(data.summary);

                                // Insert the HTML content directly. Tiptap will parse it.
                                editor.chain()
                                    .focus()
                                    .insertContentAt(insertPos, htmlContent)
                                    .run();

                                // Remove loading state
                                aiContainer.remove();
                                // Or notify success
                            }

                        } catch (err) {
                            console.error(err);
                            aiContainer.innerHTML = `<div class="text-red-500">Failed to analyze document. Please try again.</div>`;
                        }
                    });
                }
            }

            // Click listener for the header only
            header.addEventListener('click', () => {
                window.open(node.attrs.src, '_blank');
            });

            return {
                dom,
            }
        }
    },

    addCommands() {
        return {
            setFileAttachment:
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleFile = (view: any, file: File, pos?: number) => {
            // Calculate size MB
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            const fileSize = `${sizeMB} MB`;

            uploadFn(file)
                .then((url) => {
                    const { state } = view;
                    const node = state.schema.nodes.fileAttachment.create({
                        src: url,
                        title: file.name,
                        size: fileSize,
                        type: file.type
                    });

                    const transaction = pos !== undefined
                        ? state.tr.insert(pos, node)
                        : state.tr.replaceSelectionWith(node);

                    view.dispatch(transaction);
                })
                .catch((err) => {
                    console.error("File upload failed:", err);
                });
        };

        return [
            new Plugin({
                key: new PluginKey("fileAttachmentHandler"),
                props: {
                    handlePaste: (view, event) => {
                        const items = Array.from(event.clipboardData?.items || []);
                        // Try to find any file that isn't an image (images handled by Image extension usually)
                        // But wait, user might want to attach image as file? 
                        // Usually image paste -> Image Node.
                        // Let's look for "not image" files first.
                        const fileItem = items.find((item) => item.kind === 'file' && !item.type.startsWith('image/'));

                        // If we find a non-image file, handle it. 
                        // If we only find images, let Image extension handle it?
                        // User request: "copy and paste other files" (besides PDF).

                        if (fileItem) {
                            const file = fileItem.getAsFile();
                            if (file) {
                                event.preventDefault();
                                handleFile(view, file);
                                return true;
                            }
                        }
                        return false;
                    },
                    handleDrop: (view, event, slice, moved) => {
                        if (moved) return false;

                        const files = Array.from(event.dataTransfer?.files || []);
                        // Same logic: Look for non-image files to treat as attachments.
                        // Or maybe PDF specifically? User said "other files".
                        const file = files.find((file) => !file.type.startsWith('image/'));

                        if (file) {
                            event.preventDefault();
                            const coordinates = view.posAtCoords({
                                left: event.clientX,
                                top: event.clientY,
                            });

                            if (coordinates) {
                                handleFile(view, file, coordinates.pos);
                                return true;
                            }
                        }
                        return false;
                    },
                },
            }),
        ];
    },
});
