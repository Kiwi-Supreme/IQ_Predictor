import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  adjustIqPrediction,
  alignToStandardIqScale,
  buildFeatureVector,
  computeSubScores,
  predictIq,
} from "./prediction.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { assessment_id, responses, age_group, age, user_id } = await req.json();

    if (!assessment_id || !responses || !age_group || age === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const numericAge = Number(age);
    const featureVector = buildFeatureVector(age_group, numericAge, responses);
    const raw_predicted_iq = predictIq(age_group, featureVector);
    const scaled_predicted_iq = alignToStandardIqScale(raw_predicted_iq);
    const predicted_iq = adjustIqPrediction(scaled_predicted_iq);
    const percentile = Math.max(1, Math.min(99, Math.round((0.5 * (1 + Math.tanh(((predicted_iq - 100) / 15) * 0.7071))) * 100)));
    const subScores = computeSubScores(age_group, numericAge, responses);
    const averageResponseTime = responses.length
      ? responses.reduce((sum: number, item: { response_time_ms?: number }) => sum + Number(item.response_time_ms || 0), 0) / responses.length
      : 0;
    const confidenceScore = Math.max(72, Math.min(96, Math.round(94 - averageResponseTime / 15000)));

    const { error: insertError } = await supabase.from("predictions").insert({
      assessment_id,
      user_id,
      age_group,
      predicted_iq,
      percentile,
      verbal_score: subScores.verbal,
      logical_score: subScores.logical,
      spatial_score: subScores.spatial,
      processing_speed_score: subScores.processing,
      confidence_score: confidenceScore,
      model_version: `${age_group}_dataset_linear_v2_calibrated`,
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: "Failed to save prediction" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalTimeSeconds = Math.round(
      responses.reduce((sum: number, item: { response_time_ms?: number }) => sum + Number(item.response_time_ms || 0), 0) / 1000
    );

    await supabase
      .from("assessments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        time_taken_seconds: totalTimeSeconds,
      })
      .eq("id", assessment_id);

    return new Response(
      JSON.stringify({
        predicted_iq,
        raw_predicted_iq: Math.round(raw_predicted_iq * 100) / 100,
        scaled_predicted_iq: Math.round(scaled_predicted_iq * 100) / 100,
        percentile,
        sub_scores: subScores,
        confidence: confidenceScore,
        feature_vector: featureVector,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
