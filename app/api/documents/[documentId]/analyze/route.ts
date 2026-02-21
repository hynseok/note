import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PDFService } from "@/lib/services/pdf-service";
import { AIService } from "@/lib/services/ai-service";
import { getCurrentUserFromSession, getDocumentAccess } from "@/lib/permissions";

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

        const currentUser = await getCurrentUserFromSession(session);
        if (!currentUser) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!fileUrl) {
            return new NextResponse("Missing file URL", { status: 400 });
        }

        const access = await getDocumentAccess(params.documentId, currentUser.id);
        if (!access.exists) {
            return new NextResponse("Document not found", { status: 404 });
        }
        if (!access.canEdit) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

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
