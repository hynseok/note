"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface TitleProps {
    initialData: {
        title: string;
        id: string;
        icon?: string;
    }
};

export const Title = ({
    initialData
}: TitleProps) => {
    // For now, simple static display or basic editing.
    // The main title editing happens in the page body.
    // This is for the Navigation bar.
    return (
        <div className="flex items-center gap-x-1 px-2 py-0.5 rounded-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-[#3F3F3F] dark:text-[#CFCFCF]">
            {!!initialData.icon && <p className="text-base">{initialData.icon}</p>}
            <span className="truncate font-medium">
                {initialData.title}
            </span>
        </div>
    );

};

Title.Skeleton = function TitleSkeleton() {
    return (
        <Skeleton className="h-4 w-20 rounded-md" />
    );
};
