import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prismadb from "@/lib/prismadb";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ filename: string }> }
) {
    const session = await getServerSession(authOptions);
    const params = await props.params;
    const filename = params.filename;

    // Security: Validate filename to prevent directory traversal
    // Only allow alphanumeric, dots, dashes, and underscores
    if (!filename.match(/^[a-zA-Z0-9._-]+$/)) {
        return new NextResponse("Invalid filename", { status: 400 });
    }

    let isAllowed = !!session;

    if (!isAllowed) {
        // Check for public document access
        const { searchParams } = new URL(request.url);
        const documentId = searchParams.get("documentId");

        if (documentId) {
            try {
                const document = await prismadb.document.findUnique({
                    where: { id: documentId },
                    select: { isPublished: true, content: true }
                });

                if (document?.isPublished) {
                    // Verify the file is actually used in this document
                    // This is a simple string check, but effective enough for this filename format
                    if (document.content && document.content.includes(filename)) {
                        isAllowed = true;
                    }
                }
            } catch (error) {
                console.error("Error checking document permission", error);
            }
        }
    }

    if (!isAllowed) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const filepath = join(process.cwd(), "public", "uploads", filename);

    if (!existsSync(filepath)) {
        return new NextResponse("File not found", { status: 404 });
    }

    try {
        const fileBuffer = await readFile(filepath);

        // Detect Content-Type
        const ext = filename.split('.').pop()?.toLowerCase();
        let contentType = "application/octet-stream";

        switch (ext) {
            case "pdf":
                contentType = "application/pdf";
                break;
            case "jpg":
            case "jpeg":
                contentType = "image/jpeg";
                break;
            case "png":
                contentType = "image/png";
                break;
            case "gif":
                contentType = "image/gif";
                break;
            case "webp":
                contentType = "image/webp";
                break;
            case "svg":
                contentType = "image/svg+xml";
                break;
        }

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable", // Long term caching
            },
        });
    } catch (error) {
        console.error("[FILE_SERVE_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
