import { supabase } from "./supabase";
import type { Params } from "./profitability";

export type Scenario = {
  id: string;
  name: string;
  is_preset: boolean;
  params: Params;
  created_at: string;
};

const TABLE = "hedging_profitability_scenarios";

export async function listScenarios(): Promise<Scenario[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,name,is_preset,params,created_at")
    .order("is_preset", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Scenario[];
}

export async function saveScenario(name: string, params: Params): Promise<Scenario> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ name, params, is_preset: false })
    .select("id,name,is_preset,params,created_at")
    .single();
  if (error) throw error;
  return data as Scenario;
}

export async function updateScenario(id: string, name: string, params: Params): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ name, params, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteScenario(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
