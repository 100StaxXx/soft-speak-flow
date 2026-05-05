type SupabaseSchemaError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export const isSupabaseMissingRelationError = (
  error: SupabaseSchemaError | null | undefined,
  relationName: string,
): boolean => {
  if (!error) return false;

  const normalizedRelationName = relationName.toLowerCase();
  const code = (error.code ?? "").toUpperCase();
  const haystack = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  const mentionsRelation =
    haystack.includes(normalizedRelationName) ||
    haystack.includes(`public.${normalizedRelationName}`);

  if (!mentionsRelation) return false;
  if (code === "42P01" || code === "PGRST205") return true;

  return (
    code.startsWith("PGRST") ||
    haystack.includes("schema cache") ||
    haystack.includes("does not exist") ||
    haystack.includes("could not find the table") ||
    haystack.includes("relation")
  );
};
