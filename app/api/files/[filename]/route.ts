import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ filename: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const params = await props.params;
    const filename = params.filename;

    // Security: Validate filename to prevent directory traversal
    // Only allow alphanumeric, dots, dashes, and underscores
    if (!filename.match(/^[a-zA-Z0-9._-]+$/)) {
        return new NextResponse("Invalid filename", { status: 400 });
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
