import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { Franchise } from "@/lib/franchise.functions";
import { listSavedFranchises, removeSavedFranchise, saveFranchise } from "@/lib/saved-franchises.functions";

export function useSavedFranchises() {
  const list = useServerFn(listSavedFranchises);
  return useQuery({ queryKey: ["saved-franchises"], queryFn: () => list(), staleTime: 30_000 });
}

export function useSaveFranchise() {
  const client = useQueryClient();
  const save = useServerFn(saveFranchise);
  return useMutation({
    mutationFn: (franchise: Franchise) => save({ data: franchise }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["saved-franchises"] }),
  });
}

export function useRemoveSavedFranchise() {
  const client = useQueryClient();
  const remove = useServerFn(removeSavedFranchise);
  return useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["saved-franchises"] }),
  });
}