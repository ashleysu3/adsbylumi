import { supabase } from "@/integrations/supabase/client";

/**
 * Idempotently seed a task from the guided onboarding flow.
 * De-duped on (user_id, title) — won't create twice.
 */
export async function seedDeferredTask(input: {
  title: string;
  description?: string;
  link_to?: string;
  brand_id?: string | null;
}) {
  try {
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return;
    const { data: existing } = await supabase
      .from("tasks" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("title", input.title)
      .neq("status", "done")
      .limit(1);
    if (existing && existing.length > 0) return;
    await supabase.from("tasks" as any).insert({
      user_id: userId,
      title: input.title,
      description: input.description || null,
      link_to: input.link_to || null,
      brand_id: input.brand_id || null,
      source: "guided_onboarding",
      status: "open",
    });
  } catch (e) {
    console.error("[seedDeferredTask] failed", e);
  }
}

/** Seed the first-campaign step-by-step task list. */
export async function seedFirstCampaignTasks(brandId: string | null) {
  const steps = [
    { title: "Pick a campaign angle", link_to: "/create" },
    { title: "Approve your ad copy", link_to: "/create" },
    { title: "Approve your first creative", link_to: "/creative-studio" },
    { title: "Launch your first campaign", link_to: "/launch" },
  ];
  await Promise.all(steps.map((s) => seedDeferredTask({ ...s, brand_id: brandId })));
}
