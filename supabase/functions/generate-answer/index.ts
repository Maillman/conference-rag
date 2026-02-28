import { corsHeaders } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";

interface ContextTalk {
    title: string;
    speaker: string;
    text: string;
}

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Verify authentication
        await verifyAuth(req);

        // Parse request body
        const { question, context_talks } = await req.json();

        if (!question || typeof question !== "string") {
            return new Response(
                JSON.stringify({ error: "Question is required and must be a string" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        if (!Array.isArray(context_talks) || context_talks.length === 0) {
            return new Response(
                JSON.stringify({ error: "context_talks is required and must be a non-empty array" }),
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

        // Build the context from the provided talks
        const contextText = context_talks
            .map((talk: ContextTalk, index: number) => {
                return `[${index + 1}] "${talk.title}" by ${talk.speaker}\n${talk.text}`;
            })
            .join("\n\n---\n\n");

        // Create the prompt for GPT-4o
        const systemPrompt = `You are a helpful assistant that answers questions about General Conference talks from The Church of Jesus Christ of Latter-day Saints. 

You will be provided with relevant excerpts from conference talks. Your task is to:
1. Answer the user's question based ONLY on the provided talk excerpts
2. Cite which talks you're drawing from by referencing their titles and speakers
3. Be direct and helpful in your response
4. If the provided talks don't contain relevant information to answer the question, say so honestly

Remember to cite your sources by mentioning the talk titles and speakers when you reference them.`;

        const userPrompt = `Context from Conference Talks:

${contextText}

---

Question: ${question}

Please provide a thoughtful answer based on the conference talk excerpts above, citing which talks you reference.`;

        // Call OpenAI API to generate answer
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openaiApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 1000,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        const answer = data.choices[0].message.content;

        // Return the generated answer
        return new Response(
            JSON.stringify({ answer }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error in generate-answer function:", error);

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
