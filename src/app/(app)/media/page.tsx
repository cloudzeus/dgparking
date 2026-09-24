import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MediaLibraryClient } from "@/components/media/media-library-client";
import { parseMediaAlt, type MediaAssetDTO } from "@/lib/media-asset";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Τη βιβλιοθήκη τη διαχειρίζονται διαχειριστές και υπεύθυνοι.
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    redirect("/dashboard");
  }

  const rows = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const assets: MediaAssetDTO[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    fileName: row.fileName,
    url: row.url,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    width: row.width,
    height: row.height,
    alt: parseMediaAlt(row.alt),
    folder: row.folder,
    createdAt: row.createdAt.toISOString(),
  }));

  return <MediaLibraryClient assets={assets} />;
}
