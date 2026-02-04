"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { Navigation } from "./_components/navigation";
import { SearchCommand } from "@/components/search-command";

const MainLayout = ({
    children
}: {
    children: React.ReactNode;
}) => {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <div className="h-full flex items-center justify-center">
                {/* Minimalist Spinner */}
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (status === "unauthenticated") {
        return redirect("/login");
    }

    return (
        <div className="h-screen flex dark:bg-[#1F1F1F]">
            <Navigation />
            <main className="flex-1 h-full overflow-y-auto bg-white dark:bg-[#1F1F1F]">
                <SearchCommand />
                {children}
            </main>
        </div>
    );
}

export default MainLayout;
