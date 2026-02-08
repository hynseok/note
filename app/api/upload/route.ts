import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { existsSync } from "fs";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // Validate file type
        // if (!ALLOWED_TYPES.includes(file.type)) {
        //     return NextResponse.json(
        //         { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" },
        //         { status: 400 }
        //     );
        // }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: "File size exceeds 5MB limit" },
                { status: 400 }
            );
        }

        // Ensure upload directory exists
        if (!existsSync(UPLOAD_DIR)) {
            await mkdir(UPLOAD_DIR, { recursive: true });
        }

        // Generate unique filename
        const ext = file.name.split(".").pop() || "png";
        const filename = `${uuidv4()}.${ext}`;
        const filepath = join(UPLOAD_DIR, filename);

        // Write file to disk
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        // Return the public URL
        const url = `/api/files/${filename}`;

        return NextResponse.json({ url });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Failed to upload file" },
            { status: 500 }
        );
    }
}
