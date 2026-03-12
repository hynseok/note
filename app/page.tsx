import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  LAST_VIEWED_DOCUMENT_COOKIE,
  resolveLastViewedDocumentPath,
} from "@/lib/last-viewed-document";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();
  const lastViewedDocumentId = cookieStore.get(LAST_VIEWED_DOCUMENT_COOKIE)?.value;
  const lastViewedDocumentPath = await resolveLastViewedDocumentPath(
    lastViewedDocumentId,
    session
  );

  if (lastViewedDocumentPath) {
    redirect(lastViewedDocumentPath);
  }

  redirect("/documents");
}
