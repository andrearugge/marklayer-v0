import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { assertProjectOwnership } from "@/lib/projects";
import { SemanticSearchPanel } from "../semantic-search-panel";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SearchPage({ params }: PageProps) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  await assertProjectOwnership(id, currentUser.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ricerca semantica</h1>
        <p className="text-sm text-muted-foreground">
          Cerca contenuti per significato utilizzando embeddings vettoriali
        </p>
      </div>
      <SemanticSearchPanel projectId={id} />
    </div>
  );
}
