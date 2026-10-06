import { queryOptions } from "@tanstack/react-query";
import { buildSnapshot } from "./capacity";

/**
 * Camada de serviço. Hoje lê dados mock; depois, trocar por chamadas à API
 * que consome o Azure DevOps sem alterar as telas.
 */
export async function fetchSnapshot() {
  await new Promise((r) => setTimeout(r, 450));
  return buildSnapshot();
}

export const snapshotQuery = queryOptions({
  queryKey: ["snapshot"],
  queryFn: fetchSnapshot,
  staleTime: 5 * 60 * 1000,
});
