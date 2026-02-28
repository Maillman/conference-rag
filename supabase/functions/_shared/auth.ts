import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export async function verifyAuth(req: Request): Promise<{ userId: string }> {
    // Extract the JWT token from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        throw new Error("Missing Authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
        throw new Error("Invalid Authorization header format");
    }

    // Get Supabase URL and anon key from environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing Supabase configuration");
    }

    // Create Supabase client and verify the JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
        throw new Error("Invalid or expired token");
    }

    return { userId: user.id };
}
