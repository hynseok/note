"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConflictBannerProps {
    onViewLatest: () => void;
    onDismiss: () => void;
}

export const ConflictBanner = ({ onViewLatest, onDismiss }: ConflictBannerProps) => {
    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/90 dark:bg-yellow-600/90 text-white px-4 py-3 shadow-lg">
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <svg
                        className="w-5 h-5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    <div>
                        <p className="font-semibold text-sm">Document Conflict Detected</p>
                        <p className="text-xs opacity-90">
                            This document was modified by another user. Your changes might conflict with theirs.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={onViewLatest}
                        size="sm"
                        variant="secondary"
                        className="bg-white text-yellow-700 hover:bg-gray-100"
                    >
                        View Latest Version
                    </Button>
                    <Button
                        onClick={onDismiss}
                        size="icon"
                        variant="ghost"
                        className="text-white hover:bg-yellow-600/50"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
