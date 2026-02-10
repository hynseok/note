"use client";

import { Editor } from "@/components/editor";
import { useEffect, useState, use } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Cover } from "@/components/cover";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function DocumentPreviewPage({
    params
}: {
    params: Promise<{ documentId: string }>
}) {
    const { documentId } = use(params);
    const [document, setDocument] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDocument = async () => {
            try {
                const res = await fetch(`/api/documents/${documentId}`);
                if (!res.ok) {
                    throw new Error("Failed to load document");
                }
                const data = await res.json();
                setDocument(data);
            } catch (error) {
                console.error(error);
                setDocument(null);
            } finally {
                setLoading(false);
            }
        };

        fetchDocument();
    }, [documentId]);

    if (loading) {
        return (
            <div className="md:max-w-3xl lg:max-w-4xl mx-auto mt-10">
                <div className="space-y-4 pl-8 pt-4">
                    <Skeleton className="h-14 w-[50%]" />
                    <Skeleton className="h-4 w-[80%]" />
                    <Skeleton className="h-4 w-[40%]" />
                    <Skeleton className="h-4 w-[60%]" />
                </div>
            </div>
        );
    }

    if (document === null) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
                <p className="text-xl font-medium text-muted-foreground">
                    This document is either private or does not exist.
                </p>
                <Link href="/documents">
                    <Button>Return to App</Button>
                </Link>
            </div>
        );
    }


    // Helper to process content: 
    // 1. Filter out sensitive blocks (File Attachments)
    // 2. Inject documentId into image URLs for access permission
    const processContent = (content: any): any => {
        if (!content) return content;

        let parsedContent = content;
        const isString = typeof content === 'string';

        if (isString) {
            try {
                parsedContent = JSON.parse(content);
            } catch (e) {
                // Formatting is likely HTML
                if (typeof window !== 'undefined') {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(content, 'text/html');

                        // 1. Remove file attachments
                        const attachments = doc.querySelectorAll('[data-type="file-attachment"]');
                        attachments.forEach(el => el.remove());

                        // 2. Update Image URLs
                        const images = doc.querySelectorAll('img');
                        images.forEach(img => {
                            const src = img.getAttribute('src');
                            if (src && src.startsWith('/api/files/')) {
                                // Check if query param already exists to avoid duplication
                                if (!src.includes('documentId=')) {
                                    const separator = src.includes('?') ? '&' : '?';
                                    img.setAttribute('src', `${src}${separator}documentId=${documentId}`);
                                }
                            }
                        });


                        return doc.body.innerHTML;
                    } catch (domError) {
                        console.error("DOM parsing failed", domError);
                        return content;
                    }
                }
                return content;
            }
        }

        if (typeof parsedContent !== 'object') return content;

        const processNode = (node: any): any | null => {
            if (node.type === 'fileAttachment') {
                return null; // Remove this node
            }

            // Process Image nodes
            if (node.type === 'image' && node.attrs && node.attrs.src) {
                const src = node.attrs.src;
                if (src.startsWith('/api/files/') && !src.includes('documentId=')) {
                    const separator = src.includes('?') ? '&' : '?';
                    // Create a new node with updated attrs to avoid mutating original state if it matters (though passing to initialContent usually makes a copy/parse)
                    return {
                        ...node,
                        attrs: {
                            ...node.attrs,
                            src: `${src}${separator}documentId=${documentId}`
                        }
                    };
                }
            }

            if (node.content && Array.isArray(node.content)) {
                const filteredChildren = node.content
                    .map((child: any) => processNode(child))
                    .filter((child: any) => child !== null);

                return { ...node, content: filteredChildren };
            }

            return node;
        };

        const processed = processNode(parsedContent);
        return processed;
    };

    const processedContent = processContent(document.content);

    return (
        <div className="pb-40">
            <Cover preview url={document.coverImage} />
            <div className="md:max-w-3xl lg:max-w-4xl mx-auto">
                <div className="px-12 md:px-24 pb-8 pt-[20px]">
                    <Link
                        href="/documents"
                        className="opacity-0 group-hover:opacity-100 transition absolute left-4 top-4 md:left-20 md:top-20 z-50"
                    >
                        {/* 
                            Optional: Add a "Back to App" or Logo here if we want a header.
                            For now, keeping it clean like Notion. 
                        */}
                    </Link>

                    {/* Header: Icon & Title */}
                    <div className="group relative">
                        {!!document.icon && (
                            <div className="p-1 pl-0 pt-2 mb-2">
                                <p className="text-6xl">
                                    {document.icon}
                                </p>
                            </div>
                        )}
                        <div className="text-5xl font-bold text-[#3F3F3F] dark:text-[#CFCFCF] pb-4 break-words">
                            {document.title}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="">
                        <Editor
                            onChange={() => { }}
                            initialContent={processedContent}
                            editable={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
