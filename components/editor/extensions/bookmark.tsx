import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { GlobeIcon } from "lucide-react";

interface BookmarkData {
    url: string;
    title: string;
    description: string;
    image: string | null;
    favicon: string | null;
}

const BookmarkComponent = ({ node }: any) => {
    const { url, title, description, image, favicon } = node.attrs as BookmarkData;

    const handleClick = () => {
        window.open(url, "_blank", "noopener,noreferrer");
    };

    return (
        <NodeViewWrapper className="bookmark-block my-3">
            <div
                onClick={handleClick}
                className="flex border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
                {/* Text Content */}
                <div className="flex-1 p-3 min-w-0">
                    <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate">
                        {title || url}
                    </div>
                    {description && (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                            {description}
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                        {favicon ? (
                            <img
                                src={favicon}
                                alt=""
                                className="w-4 h-4 rounded-sm"
                                onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                }}
                            />
                        ) : (
                            <GlobeIcon className="w-4 h-4" />
                        )}
                        <span className="truncate">{url ? new URL(url).hostname : ""}</span>
                    </div>
                </div>

                {/* Preview Image */}
                {image && (
                    <div className="w-[120px] h-[80px] flex-shrink-0 bg-neutral-100 dark:bg-neutral-800">
                        <img
                            src={image}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.currentTarget.parentElement!.style.display = "none";
                            }}
                        />
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
};

export const Bookmark = Node.create({
    name: "bookmark",

    group: "block",

    atom: true,

    draggable: true,

    addAttributes() {
        return {
            url: { default: "" },
            title: { default: "" },
            description: { default: "" },
            image: { default: null },
            favicon: { default: null },
        };
    },

    parseHTML() {
        return [{ tag: "div[data-bookmark]" }];
    },

    renderHTML({ HTMLAttributes }) {
        return ["div", mergeAttributes(HTMLAttributes, { "data-bookmark": "" })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(BookmarkComponent);
    },
});

