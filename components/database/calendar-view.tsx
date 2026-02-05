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
        <div className="flex h-full flex-col p-4">
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

            {/* Days Header */}
            <div className="grid grid-cols-7 gap-px border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
                    <div key={dayName} className="text-center text-xs font-semibold text-muted-foreground uppercase">
                        {dayName}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className={cn(
                "flex-1 grid grid-cols-7 gap-px bg-neutral-200 dark:bg-neutral-800 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800",
                days.length / 7 <= 5 ? "grid-rows-5" : "grid-rows-6"
            )}>
                {days.map((day) => {
                    const dayDocs = getDocumentsForDay(day);
                    const isCurrentMonth = isSameMonth(day, monthStart);

                    return (
                        <div
                            key={day.toISOString()}
                            onDrop={(e) => handleDrop(e, day)}
                            onDragOver={handleDragOver}
                            className={cn(
                                "bg-white dark:bg-neutral-900 p-2 min-h-[100px] flex flex-col gap-1 relative group hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors",
                                !isCurrentMonth && "bg-neutral-50 dark:bg-neutral-950/50 text-muted-foreground"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className={cn(
                                    "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                                    isSameDay(day, new Date()) && "bg-primary text-primary-foreground"
                                )}>
                                    {format(day, "d")}
                                </span>
                                <Button
                                    onClick={() => onCreateItem(day)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>

                            <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-[100px]">
                                {dayDocs.map((doc) => (
                                    <DatabaseItemCard
                                        key={doc.id}
                                        document={doc}
                                        tagOptions={tagOptions}
                                        onOpen={onOpenModal}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                })}
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
