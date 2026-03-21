import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import prismadb from "@/lib/prismadb";
import { existsSync } from "fs";
import { PDFService } from "@/lib/services/pdf-service";
import { AIService } from "@/lib/services/ai-service";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

function getSafeExtension(filename: string): string {
    const extension = filename.split(".").pop()?.toLowerCase() || "pdf";
    if (!/^[a-z0-9]{1,10}$/.test(extension)) {
        return "pdf";
    }
    return extension;
}

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate Request via PAT
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
        }

        const token = authHeader.replace("Bearer ", "").trim();
        const user = await prismadb.user.findUnique({
            where: { apiToken: token }
        });

        if (!user) {
            return NextResponse.json({ error: "Unauthorized: Invalid Personal Access Token" }, { status: 401 });
        }

        // 2. Parse Multipart Form Data
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
        }

        // 3. Save Uploaded PDF
        if (!existsSync(UPLOAD_DIR)) {
            await mkdir(UPLOAD_DIR, { recursive: true });
        }

        const ext = getSafeExtension(file.name);
        const uniqueFilename = `${uuidv4()}.${ext}`;
        const filepath = join(UPLOAD_DIR, uniqueFilename);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        // 4. Extract Text from PDF
        const extractedText = await PDFService.extractText(uniqueFilename);

        // 5. Run AIService for Analysis
        const markdown = await AIService.summarizePaper(extractedText);

        // 6. Save Analysis as a Document (Note) in Database
        const publicFileUrl = `/api/files/${uniqueFilename}`;
        
        // Use HTML string to append link at bottom for the note
        const contentWithAttachment = `${markdown}\n\n<p><a href="${publicFileUrl}" target="_blank">📄 Original PDF: ${file.name}</a></p>`;

        // Find highest order to place note at the end
        const lastDocument = await prismadb.document.findFirst({
            where: {
                userId: user.id,
                parentDocumentId: null,
                isArchived: false
            },
            orderBy: {
                order: "desc"
            }
        });
        const newOrder = lastDocument ? lastDocument.order + 1 : 0;

        const document = await prismadb.document.create({
            data: {
                title: file.name.replace(/\.[^/.]+$/, ""), // remove extension
                userId: user.id,
                content: contentWithAttachment,
                isArchived: false,
                isPublished: false,
                isDatabase: false,
                order: newOrder,
            }
        });

        // 7. Return Response to CLI
        return NextResponse.json({
            markdown: markdown,
            metadata: {
                title: file.name.replace(/\.[^/.]+$/, ""),
                documentId: document.id,
                pdfUrl: publicFileUrl
            }
        });

    } catch (error) {
        console.error("[PAPERS_ANALYZE_POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
