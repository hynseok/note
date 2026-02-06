"use client";

import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DatabaseItemCard } from "./database-item-card";
import { DocumentModal } from "./document-modal";

interface CalendarViewProps {
    documents: any[];
    tagOptions?: any[];
    onMoveItem: (documentId: string, newDate: Date) => void;
    onCreateItem: (date: Date) => void;
}

export const CalendarView = ({ documents, tagOptions = [], onMoveItem, onCreateItem }: CalendarViewProps) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const onOpenModal = (documentId: string) => {
        setSelectedDocumentId(documentId);
        setIsModalOpen(true);
    };

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    let endDate = endOfWeek(monthEnd);

    let days = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    // If the month fits in exactly 4 weeks (28 days, rare but happens in Feb), 
    // we fill it to 5 weeks to avoid the "gray void" at the bottom of the grid, 
    // matching the look of other months.
    if (days.length <= 28) {
        endDate = addDays(endDate, 7);
        days = eachDayOfInterval({
            start: startDate,
            end: endDate,
        });
    }

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const today = () => setCurrentDate(new Date());

    const getDocumentsForDay = (day: Date) => {
        return documents.filter((doc) => {
            if (!doc.properties) return false;
            try {
                const props = JSON.parse(doc.properties);
                if (!props.date) return false;
                return isSameDay(new Date(props.date), day);
            } catch (e) {
                return false;
            }
        });
    };

    const handleDrop = (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        const documentId = e.dataTransfer.getData("application/x-database-item");
        if (documentId) {
            onMoveItem(documentId, date);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    return (
        <div className="flex h-full flex-col p-2 md:p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{format(currentDate, "MMMM yyyy")}</h2>
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={today}>Today</Button>
                    <Button variant="ghost" size="icon" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className={cn(
                "flex-1 grid grid-cols-7 gap-px bg-neutral-200 dark:bg-neutral-800 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800",
                days.length / 7 <= 5 ? "grid-rows-5" : "grid-rows-6"
            )}>
                {days.map((day) => {
                    const dayDocs = getDocumentsForDay(day);
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isSelected = isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <div
                            key={day.toISOString()}
                            onDrop={(e) => handleDrop(e, day)}
                            onDragOver={handleDragOver}
                            onClick={() => setSelectedDate(day)}
                            className={cn(
                                "bg-white dark:bg-neutral-900 p-2 relative group hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors flex flex-col items-center md:items-stretch cursor-pointer md:cursor-default",
                                "min-h-[60px] md:min-h-[100px]",
                                !isCurrentMonth && "bg-neutral-50 dark:bg-neutral-950/50 text-muted-foreground",
                                isSelected && "bg-primary/5 dark:bg-primary/10 md:bg-white md:dark:bg-neutral-900" // Mobile selection state
                            )}
                        >
                            <div className="flex items-center justify-center md:justify-between w-full">
                                <span className={cn(
                                    "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                                    isToday && "bg-primary text-primary-foreground",
                                    isSelected && !isToday && "bg-neutral-200 dark:bg-neutral-700 md:bg-transparent md:dark:bg-transparent"
                                )}>
                                    {format(day, "d")}
                                </span>
                                <Button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCreateItem(day);
                                    }}
                                    variant="ghost"
                                    size="icon"
                                    className="hidden md:flex h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>

                            {/* Mobile Dot Indicator */}
                            <div className="md:hidden mt-1 h-2 flex justify-center">
                                {dayDocs.length > 0 && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                                )}
                            </div>

                            {/* Desktop Items List */}
                            <div className="hidden md:flex flex-col gap-1 mt-1 overflow-y-auto max-h-[100px]">
                                {dayDocs.map((doc) => (
                                    <div key={doc.id} onClick={(e) => e.stopPropagation()}>
                                        <DatabaseItemCard
                                            document={doc}
                                            tagOptions={tagOptions}
                                            onOpen={onOpenModal}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Mobile Daily List View */}
            <div className="md:hidden mt-4 border-t border-neutral-200 dark:border-neutral-800 pt-4">
                <div className="flex items-center justify-between mb-2 px-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                        {format(selectedDate, "MMM d, yyyy")}
                    </h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCreateItem(selectedDate)}
                        className="h-8 text-xs text-muted-foreground"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        Add item
                    </Button>
                </div>
                <div className="flex flex-col gap-2 min-h-[100px]">
                    {getDocumentsForDay(selectedDate).length === 0 ? (
                        <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                            No items for this day
                        </div>
                    ) : (
                        getDocumentsForDay(selectedDate).map((doc) => (
                            <DatabaseItemCard
                                key={doc.id}
                                document={doc}
                                tagOptions={tagOptions}
                                onOpen={onOpenModal}
                            />
                        ))
                    )}
                </div>
            </div>
            {selectedDocumentId && (
                <DocumentModal
                    documentId={selectedDocumentId}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};
