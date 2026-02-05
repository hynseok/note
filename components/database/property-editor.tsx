"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Tag, Plus, X, MoreHorizontal, Trash2, Check } from "lucide-react";

// ... existing imports ...

// ... inside PropertyEditor ...

const COLOR_OPTIONS = [
    { name: "Red", dot: "bg-red-500", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
    { name: "Orange", dot: "bg-orange-500", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" },
    { name: "Amber", dot: "bg-amber-500", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
    { name: "Yellow", dot: "bg-yellow-500", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300" },
    { name: "Lime", dot: "bg-lime-500", color: "bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300" },
    { name: "Green", dot: "bg-green-500", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
    { name: "Emerald", dot: "bg-emerald-500", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
    { name: "Teal", dot: "bg-teal-500", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300" },
    { name: "Cyan", dot: "bg-cyan-500", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300" },
    { name: "Sky", dot: "bg-sky-500", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300" },
    { name: "Blue", dot: "bg-blue-500", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
    { name: "Indigo", dot: "bg-indigo-500", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300" },
    { name: "Violet", dot: "bg-violet-500", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300" },
    { name: "Purple", dot: "bg-purple-500", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" },
    { name: "Fuchsia", dot: "bg-fuchsia-500", color: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/50 dark:text-fuchsia-300" },
    { name: "Pink", dot: "bg-pink-500", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300" },
    { name: "Rose", dot: "bg-rose-500", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300" },
];
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";


interface PropertyEditorProps {
    properties: any;
    tagOptions?: { id: string; label: string; color: string }[];
    onUpdate: (newProperties: any) => void;
    onTagOptionsUpdate?: (newOptions: { id: string; label: string; color: string }[]) => void;
}

export const PropertyEditor = ({ properties, tagOptions = [], onUpdate, onTagOptionsUpdate }: PropertyEditorProps) => {
    const [date, setDate] = useState<Date | undefined>(
        properties?.date ? new Date(properties.date) : undefined
    );
    const [tags, setTags] = useState<string[]>(properties?.tags || []);
    const [isTagOpen, setIsTagOpen] = useState(false);
    const [tagInput, setTagInput] = useState("");

    useEffect(() => {
        if (properties?.date) {
            setDate(new Date(properties.date));
        } else {
            setDate(undefined);
        }
        if (properties?.tags) {
            setTags(properties.tags);
        } else {
            setTags([]);
        }
    }, [properties]);

    const handleDateSelect = (newDate: Date | undefined) => {
        setDate(newDate);
        onUpdate({
            ...properties,
            date: newDate ? newDate.toISOString() : null
        });
    };



    const getRandomColor = () => COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].color;

    const handleUpdateTagColor = (tagId: string, newColor: string) => {
        if (onTagOptionsUpdate) {
            const newOptions = tagOptions.map(opt =>
                opt.id === tagId ? { ...opt, color: newColor } : opt
            );
            onTagOptionsUpdate(newOptions);
        }
    };

    const handleRenameTag = (tagId: string, newLabel: string) => {
        if (!newLabel.trim()) return;

        // 1. Update Options
        if (onTagOptionsUpdate) {
            const oldOption = tagOptions.find(opt => opt.id === tagId);
            const newOptions = tagOptions.map(opt =>
                opt.id === tagId ? { ...opt, label: newLabel } : opt
            );
            onTagOptionsUpdate(newOptions);

            // 2. Update existing selections if label changed
            if (oldOption && tags.includes(oldOption.label)) {
                const newTags = tags.map(t => t === oldOption.label ? newLabel : t);
                setTags(newTags);
                onUpdate({
                    ...properties,
                    tags: newTags
                });
            }
        }
    };

    const handleAddTag = (tagName: string, color?: string) => {
        // 1. Check if tag exists in options
        let option = tagOptions.find(opt => opt.label === tagName);

        // 2. If not, create new option
        if (!option) {
            const newOption = {
                id: crypto.randomUUID(),
                label: tagName,
                color: color || getRandomColor()
            };
            // Optimistically add to options
            if (onTagOptionsUpdate) {
                onTagOptionsUpdate([...tagOptions, newOption]);
            }
            option = newOption;
        }

        // 3. Add to selections if not already selected
        if (!tags.includes(option.label)) {
            const newTags = [...tags, option.label];
            setTags(newTags);
            onUpdate({
                ...properties,
                tags: newTags
            });
        }
        setIsTagOpen(false);
        setTagInput("");
    };

    const handleRemoveTag = (tagToRemove: string) => {
        const newTags = tags.filter(tag => tag !== tagToRemove);
        setTags(newTags);
        onUpdate({
            ...properties,
            tags: newTags
        });
    };

    const handleDeleteOption = (e: React.MouseEvent, optionLabel: string) => {
        e.stopPropagation();
        if (onTagOptionsUpdate) {
            const newOptions = tagOptions.filter(opt => opt.label !== optionLabel);
            onTagOptionsUpdate(newOptions);
        }
    };

    const getTagColor = (tagName: string) => {
        const option = tagOptions.find(opt => opt.label === tagName);
        return option?.color || "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
    }

    return (
        <div className="flex flex-col gap-3 mb-6">
            {/* Date Property */}
            <div className="flex items-center h-8">
                <div className="w-[140px] flex items-center gap-2 text-muted-foreground/80 shrink-0">
                    <CalendarIcon className="h-4 w-4" />
                    <span className="text-sm">Date</span>
                </div>
                <Popover modal={false}>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"ghost"}
                            className={cn(
                                "justify-start text-left font-normal h-8 px-2 -ml-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
                                !date && "text-muted-foreground"
                            )}
                        >
                            {date ? format(date, "PPP") : <span className="opacity-50">Empty</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-auto p-0 shadow-xl border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden"
                        align="start"
                    >
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={handleDateSelect}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>

            {/* Tags Property */}
            <div className="flex items-start pt-1">
                <div className="w-[140px] flex items-center gap-2 text-muted-foreground/80 h-8 shrink-0">
                    <Tag className="h-4 w-4" />
                    <span className="text-sm">Tags</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 flex-1 min-h-[32px]">
                    {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className={cn("px-2 py-0.5 text-sm font-normal border-none shadow-none", getTagColor(tag))}>
                            {tag}
                            <div
                                role="button"
                                onClick={() => handleRemoveTag(tag)}
                                className="ml-1 hover:bg-black/20 dark:hover:bg-white/20 rounded-full p-0.5 cursor-pointer opacity-60 hover:opacity-100"
                            >
                                <X className="h-3 w-3" />
                            </div>
                        </Badge>
                    ))}
                    <Popover open={isTagOpen} onOpenChange={setIsTagOpen} modal={true}>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800">
                                <Plus className="h-4 w-4 mr-1" />
                                <span className="text-xs">Add</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0 border border-neutral-200 dark:border-neutral-800 shadow-xl" align="start">
                            <div className="flex flex-col">
                                <div className="flex items-center border-b border-neutral-200 dark:border-neutral-800 px-3">
                                    <input
                                        placeholder="Search or create..."
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.nativeEvent.isComposing && tagInput.trim()) {
                                                e.preventDefault();
                                                handleAddTag(tagInput);
                                            }
                                        }}
                                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                                <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
                                    {tagInput && !tagOptions.some(opt => opt.label.toLowerCase() === tagInput.toLowerCase()) && (
                                        <div
                                            role="button"
                                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-foreground hover:text-foreground"
                                            onClick={() => handleAddTag(tagInput)}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create "{tagInput}"
                                        </div>
                                    )}
                                    {tagOptions.length > 0 && (
                                        <>
                                            {tagInput && !tagOptions.some(opt => opt.label.toLowerCase() === tagInput.toLowerCase()) && (
                                                <div className="-mx-1 h-px bg-border my-1" />
                                            )}
                                            {tagOptions
                                                .filter(option => option.label.toLowerCase().includes(tagInput.toLowerCase()))
                                                .map(option => (
                                                    <div
                                                        key={option.id}
                                                        className="relative flex cursor-pointer select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800 group"
                                                        onClick={() => handleAddTag(option.label)}
                                                    >
                                                        <div className={cn("px-2 py-0.5 text-sm font-normal rounded-md", option.color)}>
                                                            {option.label}
                                                        </div>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <div
                                                                    role="button"
                                                                    className="p-1 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded transition text-muted-foreground hover:text-foreground z-10 opacity-0 group-hover:opacity-100"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                >
                                                                    <MoreHorizontal className="h-3 w-3" />
                                                                </div>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-52 p-2" align="start" side="right" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex items-center gap-2 px-1">
                                                                        <input
                                                                            className="flex-1 bg-transparent border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                                                                            defaultValue={option.label}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === "Enter") {
                                                                                    handleRenameTag(option.id, e.currentTarget.value);
                                                                                    e.currentTarget.blur();
                                                                                }
                                                                            }}
                                                                            onBlur={(e) => handleRenameTag(option.id, e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div
                                                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                                                                        onClick={(e) => handleDeleteOption(e, option.label)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                        <span className="text-sm">Delete</span>
                                                                    </div>
                                                                    <div className="h-px bg-border my-1" />
                                                                    <div className="px-2 text-xs font-medium text-muted-foreground mb-1">Colors</div>
                                                                    <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
                                                                        {COLOR_OPTIONS.map((col) => (
                                                                            <div
                                                                                key={col.name}
                                                                                className="flex items-center gap-2 px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer"
                                                                                onClick={() => handleUpdateTagColor(option.id, col.color)}
                                                                            >
                                                                                <div className={cn("w-4 h-4 rounded-full border border-black/10 dark:border-white/10", col.dot)} />
                                                                                <span className="text-sm">{col.name}</span>
                                                                                {option.color === col.color && <Check className="h-3 w-3 ml-auto opacity-50" />}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                ))}
                                        </>
                                    )}
                                    {tagOptions.length === 0 && !tagInput && (
                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                            No tags found.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    );
};
