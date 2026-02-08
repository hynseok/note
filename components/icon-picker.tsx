"use client";

import EmojiPicker, { Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";

import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";

interface IconPickerProps {
    onChange: (icon: string) => void;
    children: React.ReactNode;
    asChild?: boolean;
};

export const IconPicker = ({
    onChange,
    children,
    asChild
}: IconPickerProps) => {
    const { theme } = useTheme();
    const currentTheme = (theme === "system" ? "light" : theme) as Theme;

    return (
        <Popover modal={true}>
            <PopoverTrigger asChild={asChild}>
                {children}
            </PopoverTrigger>
            <PopoverContent className="p-0 w-full border-none shadow-none z-[99999]">
                <EmojiPicker
                    height={350}
                    theme={currentTheme}
                    onEmojiClick={(data) => onChange(data.emoji)}
                />
            </PopoverContent>
        </Popover>
    );
};
