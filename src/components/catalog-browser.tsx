import { CatalogWorkspace } from "@/components/catalog-workspace";

export function CatalogBrowser({ kind }: { kind: "movie" | "series"; title: string; description: string; detailRoute: "/movies/$id" | "/series/$id" }) {
  return <CatalogWorkspace kind={kind} />;
}