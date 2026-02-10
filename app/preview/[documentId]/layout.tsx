"use client";

const PreviewLayout = ({
    children
}: {
    children: React.ReactNode;
}) => {
    return (
        <div className="min-h-screen dark:bg-[#1F1F1F]">
            <main className="h-full">
                {children}
            </main>
        </div>
    );
}

export default PreviewLayout;
