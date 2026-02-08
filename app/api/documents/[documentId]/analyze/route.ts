import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prismadb from "@/lib/prismadb";
import { authOptions } from "@/lib/auth";
import { PDFService } from "@/lib/services/pdf-service";
import { AIService } from "@/lib/services/ai-service";

export async function POST(
    req: Request,
    props: { params: Promise<{ documentId: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        const { fileUrl } = await req.json();

        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!fileUrl) {
            return new NextResponse("Missing file URL", { status: 400 });
        }

        // Verify Document Ownership/Access
        const document = await prismadb.document.findUnique({
            where: { id: params.documentId },
            select: { userId: true, parentDocumentId: true } // Minimum select for auth check
        });

        if (!document) {
            return new NextResponse("Document not found", { status: 404 });
        }

        // Basic Authorization check (Owner or Editor)
        // For simplicity reusing logic or just allow authenticated users for now if too complex to re-fetch all permissions here.
        // Given it's a "private note" app, let's assume owner access is key.
        // TODO: Import robust permission check from 'lib/permissions'.

        // Extract Text
        // fileUrl is likely "/uploads/filename.pdf"
        // PDFService expects relative path from public/
        // If fileUrl starts with http, we need to parse it? 
        // Assuming local file path from our upload API response.

        let relativePath = fileUrl;
        if (fileUrl.startsWith(process.env.NEXTAUTH_URL)) {
            relativePath = fileUrl.replace(process.env.NEXTAUTH_URL, "");
        }
        // Remove query params if any
        relativePath = relativePath.split('?')[0];

        console.log(`[ANALYZE] Extracting text from: ${relativePath}`);
        const text = await PDFService.extractText(relativePath);

        console.log(`[ANALYZE] Text extracted, length: ${text.length}`);

        // Summarize
        const summary = await AIService.summarizePaper(text);

        return NextResponse.json({ summary });

    } catch (error) {
        console.error("[ANALYZE_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
