"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ImageIcon, X } from "lucide-react";
import { CoverPicker } from "./cover-picker";

interface CoverProps {
    url?: string;
    preview?: boolean;
    onRemove?: () => void;
    onChange?: (url: string) => void;
}

export const Cover = ({
    url,
    preview,
    onRemove,
    onChange
}: CoverProps) => {
    return (
        <div className={cn(
            "relative w-full h-[35vh] group/cover",
            !url && "h-[12vh]", // Smaller height if no cover (or hidden)
            url ? "bg-muted" : "hidden" // Hide if no url passed (logic handled in parent usually, but safe here)
        )}>
            {!!url && (
                <div
                    className="w-full h-full"
                    style={{ background: url.startsWith("http") || url.startsWith("/") ? `url(${url}) center/cover no-repeat` : url }}
                >
                    {/* Access buttons on hover */}
                    {!preview && (
                        <div className="opacity-0 group-hover/cover:opacity-100 absolute bottom-5 right-5 flex items-center gap-x-2 transition">
                            {!!onChange && (
                                <CoverPicker asChild onChange={onChange}>
                                    <Button
                                        className="text-muted-foreground text-xs"
                                        variant="outline"
                                        size="sm"
                                    >
                                        <ImageIcon className="h-4 w-4 mr-2" />
                                        Change cover
                                    </Button>
                                </CoverPicker>
                            )}
                            {!!onRemove && (
                                <Button
                                    onClick={onRemove}
                                    className="text-muted-foreground text-xs"
                                    variant="outline"
                                    size="sm"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Remove
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
