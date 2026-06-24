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

export type CreativeStatus = "working" | "ready" | "used" | "failed";

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
  status: CreativeStatus;
  task_label: string | null;
  error_message: string | null;
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

export interface StartCreativeInput {
  brandId: string;
  type: CreativeType;
  taskLabel: string;
  title?: string;
  source?: CreativeSource;
  sourceRef?: any;
  tags?: string[];
}

/**
 * Create a "working" creative placeholder the instant a generation starts.
 * Returns its id so the caller can `completeCreative` / `failCreative` later.
 */
export async function startCreative(input: StartCreativeInput): Promise<string | null> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return null;
    const { data, error } = await (supabase as any)
      .from("creatives")
      .insert({
        brand_id: input.brandId,
        user_id: u.user.id,
        type: input.type,
        title: input.title ?? input.taskLabel.slice(0, 80),
        content: {},
        source: input.source ?? "lab",
        source_ref: input.sourceRef ?? {},
        tags: input.tags ?? [],
        status: "working",
        task_label: input.taskLabel,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[startCreative]", error);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error("[startCreative] threw", e);
    return null;
  }
}

export async function completeCreative(
  id: string,
  patch: {
    type?: CreativeType;
    title?: string;
    content?: any;
    assetUrl?: string | null;
    thumbUrl?: string | null;
  }
): Promise<boolean> {
  try {
    const update: any = { status: "ready", task_label: null, error_message: null };
    if (patch.type) update.type = patch.type;
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.content !== undefined) update.content = patch.content;
    if (patch.assetUrl !== undefined) update.asset_url = patch.assetUrl;
    if (patch.thumbUrl !== undefined) update.thumb_url = patch.thumbUrl;
    const { error } = await (supabase as any).from("creatives").update(update).eq("id", id);
    if (error) {
      console.error("[completeCreative]", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[completeCreative] threw", e);
    return false;
  }
}

export async function failCreative(id: string, message: string): Promise<void> {
  try {
    await (supabase as any)
      .from("creatives")
      .update({ status: "failed", error_message: message?.slice(0, 500) || "Generation failed" })
      .eq("id", id);
  } catch (e) {
    console.error("[failCreative] threw", e);
  }
}

/**
 * Save a finished creative (status='ready') directly. Useful when output is
 * already in hand and there's no separate "kickoff" step.
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
        status: "ready",
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
