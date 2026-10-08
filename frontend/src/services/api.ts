import { useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { getAzureSource } from "@/services/azure-fns";
import { useAppState } from "@/components/app/app-state";
import { applyOverrides, buildSnapshot, mockSource, type Source } from "./capacity";
import { defaultConfig } from "./config";

export interface SourceResult {
  source: Source;
  /** Mensagem quando o Azure falhou e caímos para os dados de exemplo. */
  warning?: string;
}

/**
 * Busca os dados no Azure DevOps (pelo servidor). Se o .env não estiver
 * configurado ou o Azure falhar, usa os dados de exemplo — a demo nunca quebra.
 */
export async function fetchSource(): Promise<SourceResult> {
  try {
    const azure = await getAzureSource();
    if (azure) return { source: azure };
    return { source: mockSource };
  } catch (e) {
    return { source: mockSource, warning: e instanceof Error ? e.message : "Falha ao falar com o Azure DevOps" };
  }
}

export const sourceQuery = queryOptions({
  queryKey: ["snapshot"],
  queryFn: fetchSource,
  staleTime: 5 * 60 * 1000,
});

/**
 * Hook usado pelas telas. Monta o snapshot a partir dos dados e aplica as
 * realocações feitas no painel (antes de gravar no Azure).
 */
export function useSnapshot() {
  const q = useQuery(sourceQuery);
  const { overrides } = useAppState();
  const data = useMemo(
    () => (q.data ? buildSnapshot(defaultConfig, applyOverrides(q.data.source, overrides)) : undefined),
    [q.data, overrides],
  );
  return { data, source: q.data?.source, warning: q.data?.warning, isLoading: q.isLoading };
}
