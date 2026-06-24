import { supabase } from "@/integrations/supabase/client";

export type CreativeType =
  | "hook"
  | "primary_copy"
  | "headline"
  | "description"
  | "caption"
  | "cta"
  | "angle"
  | "concept"
  | "broll_idea"
  | "broll_clip"
  | "graphic"
  | "trend";

export type CreativeSource =
  | "lab"
  | "guided_flow"
  | "lead_fit_feedback"
  | "trend_translator";

export interface CreativeDraft {
  id: string;
  brand_id: string;
  user_id: string;
  type: CreativeType;
  title: string | null;
  content: any;
  asset_url: string | null;
  thumb_url: string | null;
  source: CreativeSource | string;
  source_ref: any;
  status: "unused" | "used";
  used_in: any;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SaveCreativeInput {
  brandId: string;
  type: CreativeType;
  title?: string;
  content?: any;
  assetUrl?: string | null;
  thumbUrl?: string | null;
  source?: CreativeSource;
  sourceRef?: any;
  tags?: string[];
}

/**
 * Save a creative draft to My Creatives. Returns the saved row id, or null
 * on failure (errors are logged + toasted-like, never thrown to caller).
 */
export async function saveCreative(input: SaveCreativeInput): Promise<string | null> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return null;
    const { data, error } = await (supabase as any)
      .from("creatives")
      .insert({
        brand_id: input.brandId,
        user_id: u.user.id,
        type: input.type,
        title: input.title ?? null,
        content: input.content ?? {},
        asset_url: input.assetUrl ?? null,
        thumb_url: input.thumbUrl ?? null,
        source: input.source ?? "lab",
        source_ref: input.sourceRef ?? {},
        tags: input.tags ?? [],
      })
      .select("id")
      .single();
    if (error) {
      console.error("[saveCreative]", error);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error("[saveCreative] threw", e);
    return null;
  }
}

export async function saveManyCreatives(items: SaveCreativeInput[]): Promise<number> {
  let n = 0;
  for (const it of items) {
    const id = await saveCreative(it);
    if (id) n++;
  }
  return n;
}
