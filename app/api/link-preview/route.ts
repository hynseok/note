import { NextRequest, NextResponse } from "next/server";

interface LinkPreview {
    title: string;
    description: string;
    image: string | null;
    favicon: string | null;
    url: string;
}

export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json();

        if (!url || typeof url !== "string") {
            return NextResponse.json(
                { error: "URL is required" },
                { status: 400 }
            );
        }

        // Fetch the page
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; LinkPreview/1.0)",
            },
        });

        if (!response.ok) {
            throw new Error("Failed to fetch URL");
        }

        const html = await response.text();

        // Extract metadata
        const title = extractMeta(html, "og:title") ||
            extractMeta(html, "twitter:title") ||
            extractTitle(html) ||
            new URL(url).hostname;

        const description = extractMeta(html, "og:description") ||
            extractMeta(html, "twitter:description") ||
            extractMeta(html, "description") ||
            "";

        const image = extractMeta(html, "og:image") ||
            extractMeta(html, "twitter:image") ||
            null;

        const favicon = extractFavicon(html, url);

        const preview: LinkPreview = {
            title,
            description: description.slice(0, 200),
            image: image ? resolveUrl(image, url) : null,
            favicon,
            url,
        };

        return NextResponse.json(preview);
    } catch (error) {
        console.error("Link preview error:", error);
        return NextResponse.json(
            { error: "Failed to fetch link preview" },
            { status: 500 }
        );
    }
}

function extractMeta(html: string, name: string): string | null {
    // Try property attribute (for og: tags)
    const propertyMatch = html.match(
        new RegExp(`<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']*)["']`, "i")
    );
    if (propertyMatch) return propertyMatch[1];

    // Try content before property
    const reversePropertyMatch = html.match(
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${name}["']`, "i")
    );
    if (reversePropertyMatch) return reversePropertyMatch[1];

    // Try name attribute (for standard meta tags)
    const nameMatch = html.match(
        new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, "i")
    );
    if (nameMatch) return nameMatch[1];

    // Try content before name
    const reverseNameMatch = html.match(
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`, "i")
    );
    if (reverseNameMatch) return reverseNameMatch[1];

    return null;
}

function extractTitle(html: string): string | null {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match ? match[1].trim() : null;
}

function extractFavicon(html: string, baseUrl: string): string | null {
    // Try to find favicon link
    const iconMatch = html.match(
        /<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']*)["']/i
    );
    if (iconMatch) {
        return resolveUrl(iconMatch[1], baseUrl);
    }

    // Try reverse order
    const reverseIconMatch = html.match(
        /<link[^>]*href=["']([^"']*)["'][^>]*rel=["'](?:icon|shortcut icon)["']/i
    );
    if (reverseIconMatch) {
        return resolveUrl(reverseIconMatch[1], baseUrl);
    }

    // Default to /favicon.ico
    try {
        const urlObj = new URL(baseUrl);
        return `${urlObj.origin}/favicon.ico`;
    } catch {
        return null;
    }
}

function resolveUrl(path: string, base: string): string {
    try {
        return new URL(path, base).href;
    } catch {
        return path;
    }
}
