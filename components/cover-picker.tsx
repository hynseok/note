"use client";

import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GALLERY_IMAGES, COVERS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverPickerProps {
    children: React.ReactNode;
    asChild?: boolean;
    onChange: (cover: string) => void;
}



export const CoverPicker = ({
    children,
    asChild,
    onChange
}: CoverPickerProps) => {
    return (
        <Popover>
            <PopoverTrigger asChild={asChild}>
                {children}
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[280px] overflow-hidden">
                <Tabs defaultValue="gallery" className="w-full">
                    <div className="border-b border-neutral-200 dark:border-neutral-800">
                        <TabsList className="w-full h-9 bg-transparent p-0 justify-start gap-x-2 px-2">
                            <TabsTrigger
                                value="gallery"
                                className="h-full px-2 text-xs font-normal data-[state=active]:bg-neutral-100 dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-foreground text-muted-foreground rounded-sm transition"
                            >
                                Gallery
                            </TabsTrigger>
                            <TabsTrigger
                                value="colors"
                                className="h-full px-2 text-xs font-normal data-[state=active]:bg-neutral-100 dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-foreground text-muted-foreground rounded-sm transition"
                            >
                                Colors
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <TabsContent value="gallery" className="p-2 m-0 max-h-[300px] overflow-y-auto">
                        <div className="grid grid-cols-3 gap-2">
                            {GALLERY_IMAGES.map((img, index) => (
                                <div
                                    key={index}
                                    onClick={() => onChange(img.url)}
                                    className="group relative h-16 w-full rounded-md cursor-pointer hover:opacity-80 transition active:scale-95 overflow-hidden"
                                >
                                    {/* Use thumb for performance, but here we just use url or thumb if we had separate ones. Using thumb is safer. */}
                                    <img
                                        src={img.thumb}
                                        alt={img.label}
                                        className="object-cover w-full h-full"
                                    />
                                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-white p-0.5 truncate text-center">
                                        {img.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                    <TabsContent value="colors" className="p-2 m-0 max-h-[300px] overflow-y-auto">
                        <div className="grid grid-cols-3 gap-2">
                            {COVERS.map((cover, index) => (
                                <div
                                    key={index}
                                    onClick={() => onChange(cover)}
                                    className={cn(
                                        "h-16 w-full rounded-md cursor-pointer hover:opacity-80 transition active:scale-95",
                                    )}
                                    style={{ background: cover }}
                                />
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover>
    );
};
