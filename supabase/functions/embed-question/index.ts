import { corsHeaders } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Verify authentication
        await verifyAuth(req);

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

        // Get OpenAI API key from environment
        const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openaiApiKey) {
            throw new Error("OpenAI API key not configured");
        }

        // Call OpenAI API to generate embedding
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

        // Return the embedding
        return new Response(
            JSON.stringify({ embedding }),
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
