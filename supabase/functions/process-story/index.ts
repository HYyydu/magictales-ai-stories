import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storyText } = await req.json();

    if (!storyText || typeof storyText !== "string" || storyText.length > 20000) {
      return new Response(JSON.stringify({ error: "Invalid story text (max 20000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a story analyzer for a children's audiobook app. Extract characters and split the story into narrated segments. Return structured data using the provided tool.`,
          },
          {
            role: "user",
            content: `Analyze this story and extract all characters with their voice traits, then split into narrated segments. Each segment should have a speaker (character name or "narrator"), emotion, and the text to speak. Keep segments short (1-3 sentences max).

Story:
${storyText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_story_data",
              description: "Extract characters and story segments for audiobook generation",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Story title" },
                  characters: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        voiceTrait: {
                          type: "string",
                          enum: ["calm", "deep", "cheerful", "high-pitched", "gruff", "gentle", "wise", "playful"],
                        },
                        emoji: { type: "string", description: "Single emoji representing the character" },
                      },
                      required: ["name", "voiceTrait", "emoji"],
                      additionalProperties: false,
                    },
                  },
                  segments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        speaker: { type: "string", description: "Character name or 'narrator'" },
                        emotion: {
                          type: "string",
                          enum: ["neutral", "happy", "sad", "angry", "scared", "excited", "calm", "suspenseful"],
                        },
                        text: { type: "string" },
                      },
                      required: ["speaker", "emotion", "text"],
                      additionalProperties: false,
                    },
                  },
                  summary: { type: "string", description: "One-sentence moral or lesson of the story" },
                  learningInsights: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 skills or lessons children learn from this story",
                  },
                },
                required: ["title", "characters", "segments", "summary", "learningInsights"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_story_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI processing failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No structured output from AI");
    }

    const storyData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(storyData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-story error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
