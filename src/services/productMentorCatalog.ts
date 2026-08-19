import { PRODUCT_MENTOR_SOURCE } from "@/config/productRuntime";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

type MentorRow = Tables<"mentors">;
type GracewardGuideRow = Tables<"graceward_guides">;

/**
 * Stable read model shared by the mentors table and the Graceward presentation
 * view. View columns are nullable even where the underlying mentor row is not,
 * so consumers must handle that honestly instead of querying through a union
 * table name that PostgREST's generated overloads cannot type safely.
 */
export type ProductMentorRecord = {
  archetype: string | null;
  avatar_url: string | null;
  created_at: string | null;
  description: string;
  gender_energy: string | null;
  id: string;
  identity_description: string | null;
  intensity_level: string | null;
  is_active: boolean | null;
  mentor_type: string;
  name: string;
  primary_color: string | null;
  short_title: string | null;
  signature_line: string | null;
  slug: string;
  style: string | null;
  style_description: string | null;
  tags: string[];
  target_user: string | null;
  target_user_type: string | null;
  theme_config: Json | null;
  themes: string[] | null;
  tone_description: string;
  voice_style: string;
  welcome_message: string | null;
};

const normalizeProductMentor = (
  row: MentorRow | GracewardGuideRow,
): ProductMentorRecord => {
  if (!row.id) {
    throw new Error("Product mentor source returned a row without an ID");
  }

  return {
    archetype: row.archetype,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
    description: row.description ?? "",
    gender_energy: row.gender_energy,
    id: row.id,
    identity_description: row.identity_description,
    intensity_level: row.intensity_level,
    is_active: row.is_active,
    mentor_type: row.mentor_type ?? "",
    name: row.name ?? "Guide",
    primary_color: row.primary_color,
    short_title: row.short_title,
    signature_line: row.signature_line,
    slug: row.slug ?? "",
    style: row.style,
    style_description: row.style_description,
    tags: row.tags ?? [],
    target_user: row.target_user,
    target_user_type: row.target_user_type,
    theme_config: row.theme_config,
    themes: row.themes,
    tone_description: row.tone_description ?? "",
    voice_style: row.voice_style ?? "",
    welcome_message: row.welcome_message,
  };
};

type ProductMentorLookupColumn = "id" | "slug";

const fetchProductMentorBy = async (
  column: ProductMentorLookupColumn,
  value: string,
): Promise<ProductMentorRecord | null> => {
  if (PRODUCT_MENTOR_SOURCE === "graceward_guides") {
    const { data, error } = await supabase
      .from("graceward_guides")
      .select("*")
      .eq(column, value)
      .maybeSingle();

    if (error) throw error;
    return data ? normalizeProductMentor(data) : null;
  }

  const { data, error } = await supabase
    .from("mentors")
    .select("*")
    .eq(column, value)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeProductMentor(data) : null;
};

export const fetchProductMentorById = (id: string) =>
  fetchProductMentorBy("id", id);

export const fetchProductMentorBySlug = (slug: string) =>
  fetchProductMentorBy("slug", slug);

export const fetchActiveProductMentors = async (): Promise<ProductMentorRecord[]> => {
  const sortByName = (rows: ProductMentorRecord[]) =>
    rows.sort((left, right) => left.name.localeCompare(right.name));

  if (PRODUCT_MENTOR_SOURCE === "graceward_guides") {
    const { data, error } = await supabase
      .from("graceward_guides")
      .select("*")
      .eq("is_active", true);

    if (error) throw error;
    return sortByName((data ?? []).map(normalizeProductMentor));
  }

  const { data, error } = await supabase
    .from("mentors")
    .select("*")
    .eq("is_active", true);

  if (error) throw error;
  return sortByName((data ?? []).map(normalizeProductMentor));
};
