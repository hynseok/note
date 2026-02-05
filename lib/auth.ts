import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prismadb from "@/lib/prismadb";

export const authOptions: AuthOptions = {
    adapter: PrismaAdapter(prismadb),
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    debug: process.env.NODE_ENV === "development",
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async session({ token, session }) {
            if (token && session.user) {
                (session.user as any).id = token.sub;
            }
            return session;
        },
        async jwt({ token, user }) {
            // Initial sign in
            if (user) {
                token.sub = user.id;
            }
            return token;
        }
    },
    secret: process.env.NEXTAUTH_SECRET,
};
