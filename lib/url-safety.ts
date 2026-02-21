import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "localhost.localdomain",
]);

function parseIpv4Parts(address: string): number[] | null {
    const parts = address.split(".");
    if (parts.length !== 4) return null;

    const parsed = parts.map((part) => Number(part));
    if (parsed.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
        return null;
    }

    return parsed;
}

function normalizeIpv6(address: string): string {
    return address.toLowerCase().split("%")[0];
}

export function isPrivateOrLocalAddress(address: string): boolean {
    const ipVersion = isIP(address);
    if (ipVersion === 4) {
        const parts = parseIpv4Parts(address);
        if (!parts) return true;

        const [a, b] = parts;
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 0) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        return false;
    }

    if (ipVersion === 6) {
        const ip = normalizeIpv6(address);
        if (ip === "::1") return true;
        if (ip === "::") return true;
        if (ip.startsWith("fe80:")) return true;
        if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
        if (ip.startsWith("::ffff:127.")) return true;
        return false;
    }

    return true;
}

export function isBlockedHostname(hostname: string): boolean {
    const normalized = hostname.toLowerCase().trim();
    if (!normalized) return true;
    if (BLOCKED_HOSTNAMES.has(normalized)) return true;
    if (normalized.endsWith(".localhost")) return true;
    if (normalized.endsWith(".local")) return true;
    return false;
}

export async function assertSafePublicHttpUrl(rawUrl: string): Promise<URL> {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error("Invalid URL");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Only HTTP(S) URLs are allowed");
    }

    const hostname = parsed.hostname;
    if (isBlockedHostname(hostname)) {
        throw new Error("Blocked hostname");
    }

    if (isIP(hostname)) {
        if (isPrivateOrLocalAddress(hostname)) {
            throw new Error("Blocked address");
        }
        return parsed;
    }

    const resolved = await lookup(hostname, { all: true, verbatim: true });
    if (resolved.length === 0) {
        throw new Error("Could not resolve host");
    }

    if (resolved.some((entry) => isPrivateOrLocalAddress(entry.address))) {
        throw new Error("Blocked address");
    }

    return parsed;
}
