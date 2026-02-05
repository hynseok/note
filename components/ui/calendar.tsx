"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    startOfMonth,
    startOfWeek,
    subMonths,
} from "date-fns"

import { cn } from "@/lib/utils"

export type CalendarProps = {
    mode?: "single"
    selected?: Date
    onSelect?: (date: Date | undefined) => void
    className?: string
    initialFocus?: boolean
}

function Calendar({
    mode = "single",
    selected,
    onSelect,
    className,
}: CalendarProps) {
    const [currentMonth, setCurrentMonth] = React.useState<Date>(selected || new Date())

    // Generate days for the grid
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    })

    const handlePreviousMonth = (e: React.MouseEvent) => {
        e.preventDefault()
        setCurrentMonth((prev) => subMonths(prev, 1))
    }

    const handleNextMonth = (e: React.MouseEvent) => {
        e.preventDefault()
        setCurrentMonth((prev) => addMonths(prev, 1))
    }

    const handleToday = (e: React.MouseEvent) => {
        e.preventDefault()
        setCurrentMonth(new Date())
    }

    const handleDateClick = (e: React.MouseEvent, day: Date) => {
        e.preventDefault()
        if (onSelect) {
            onSelect(day)
        }
    }

    return (
        <div className={cn("p-2", className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-1 pb-4">
                <div className="text-sm font-semibold text-foreground">
                    {format(currentMonth, "MMM yyyy")}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleToday}
                        className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition"
                    >
                        Today
                    </button>
                    <div className="flex items-center">
                        <button
                            onClick={handlePreviousMonth}
                            className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={handleNextMonth}
                            className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Days Header */}
            <div className="flex w-full mb-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <div
                        key={day}
                        className="h-8 w-8 flex items-center justify-center text-[0.8rem] text-muted-foreground/60 font-normal"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 w-full gap-y-1">
                {calendarDays.map((day, dayIdx) => {
                    const isSelected = selected && isSameDay(day, selected)
                    const isCurrentMonth = isSameMonth(day, currentMonth)
                    const isDayToday = isToday(day)

                    return (
                        <div key={day.toString()} className="flex justify-center">
                            <button
                                onClick={(e) => handleDateClick(e, day)}
                                className={cn(
                                    "h-8 w-8 p-0 font-normal text-sm rounded flex items-center justify-center transition-colors relative",
                                    !isCurrentMonth && "text-muted-foreground opacity-30",
                                    isCurrentMonth && "text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800",
                                    isSelected &&
                                    "bg-[#2383E2] text-white hover:bg-[#2383E2] hover:text-white shadow-sm z-10",
                                    !isSelected && isDayToday && "font-semibold after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-red-500 after:rounded-full"
                                )}
                            >
                                {format(day, "d")}
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

Calendar.displayName = "Calendar"

export { Calendar }
