import { corsHeaders } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Verify authentication and get user ID
        const { userId } = await verifyAuth(req);

        // Parse request body
        const { question } = await req.json();

        if (!question || typeof question !== "string") {
            return new Response(
                JSON.stringify({ error: "Question is required and must be a string" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Create Supabase client for cache operations
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Check cache for existing question (exact match)
        const { data: cachedQuestion, error: cacheError } = await supabase
            .from("question_cache")
            .select("id, question_embedding")
            .eq("user_id", userId)
            .eq("question", question)
            .not("question_embedding", "is", null)
            .single();

        if (cachedQuestion && !cacheError) {
            console.log("✅ Cache hit! Returning cached embedding");
            return new Response(
                JSON.stringify({ 
                    embedding: cachedQuestion.question_embedding,
                    cache_id: cachedQuestion.id,
                    cached: true
                }),
                {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Cache miss - call OpenAI API
        console.log("⚡ Cache miss. Calling OpenAI API...");
        const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openaiApiKey) {
            throw new Error("OpenAI API key not configured");
        }

        const response = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openaiApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "text-embedding-3-small",
                input: question,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        const embedding = data.data[0].embedding;

        // Store in cache
        const { data: newCacheEntry, error: insertError } = await supabase
            .from("question_cache")
            .insert({
                user_id: userId,
                question: question,
                question_embedding: embedding,
            })
            .select("id")
            .single();

        if (insertError) {
            console.error("Failed to cache question:", insertError);
            // Don't fail the request if caching fails
        }

        // Return the embedding with cache info
        return new Response(
            JSON.stringify({ 
                embedding,
                cache_id: newCacheEntry?.id,
                cached: false
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error in embed-question function:", error);

        return new Response(
            JSON.stringify({ 
                error: error.message || "Internal server error" 
            }),
            {
                status: error.message?.includes("Authorization") || 
                       error.message?.includes("token") ? 401 : 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
