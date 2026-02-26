# Step 5: Embeddings & Semantic Search — 🧠 Second Green Light!

```
  🏁 LAUNCH ──→ 🔐 SIGN IN ──→ ✅ KEYWORD ──→ ▶ 🧠 SEMANTIC ──→ 🤖 RAG ──→ 🚀 YOURS
                                                   ~~~~~~~~~~~~
                                                   YOU ARE HERE
```

## What You'll Learn
- What vector embeddings are and how they represent meaning
- Why we split text into sentences (chunking strategy)
- How OpenAI's embedding API works
- What Edge Functions are and why we need them
- How to deploy serverless functions with the Supabase CLI

## Why This Matters

Keyword search is powerful, but it only finds exact matches. Try searching for *"How can I find peace during hard times?"* with keyword search — you probably won't get great results. Semantic search solves this by understanding **meaning**, not just words. After this step, that same question will find talks about comfort, hope, and overcoming trials.

> 💪 **This is the biggest step in the assignment** — embedding generation, database updates, CLI setup, and edge function creation. Grab a snack while embeddings generate (~15 min). You've got this!

## What to Do

### Step 5a: Generate Embeddings

Run the embedding script to generate vector representations and save them to disk:

```bash
python scripts/04_embed_data.py
```

This script:
1. Reads `scripts/output/sentences.json`
2. Calls OpenAI's `text-embedding-3-small` to generate a 1,536-dimensional vector for each sentence
3. Saves results to `scripts/output/sentences_with_embeddings.json`
4. Supports resuming if interrupted (your progress is saved!)

> ⏱️ **This takes 10-15 minutes** and costs ~$0.60 in OpenAI API usage.
> 💰 **Your embeddings are safe**: They're saved to disk in `scripts/output/`, so even if the next step fails, you won't pay twice.

### Step 5b: Update Database with Embeddings

```bash
python scripts/05_update_embeddings.py
```

This reads the saved embeddings and updates each row in the database.

### How Embeddings Work

```
"Faith is the assurance of things hoped for"
    ↓ OpenAI text-embedding-3-small
[0.012, -0.034, 0.089, ... 1,536 dimensions]
```

Similar sentences produce similar vectors. This is what enables semantic search — finding content by **meaning** rather than exact keywords.

> 💡 **Ask your AI assistant**: *"What are the trade-offs between different chunking strategies in RAG systems? Why did we choose sentence-level chunking?"*

### Step 5c: Create & Deploy the embed-question Edge Function

Your app needs to call OpenAI's API to embed user questions, but you can't put your API key in client-side JavaScript (anyone could steal it). Edge Functions solve this:

```
❌ Bad:  Browser → OpenAI API (API key exposed in browser!)
✅ Good: Browser → Edge Function → OpenAI API (API key stays on server)
```

**You'll create an Edge Function called `embed-question`** that:
- Receives a question from the browser
- Calls OpenAI to generate an embedding vector
- Returns the embedding to the browser

#### 1. Install the Supabase CLI

> 💡 **Ask your AI assistant**: *"How do I install the Supabase CLI on my operating system?"*

Common installation methods:
- **npm**: `npm install -g supabase`
- **Homebrew (macOS)**: `brew install supabase/tap/supabase`
- **Scoop (Windows)**: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` then `scoop install supabase`

Verify: `supabase --version`

#### 2. Initialize Supabase & Link to Your Project

```bash
supabase init
supabase link --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with the value from your `config.secret.json`.

#### 3. Set Your OpenAI Key as a Secret

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
```

#### 4. Create the embed-question Function

Ask your AI assistant to help you create the Edge Function:

> 🤖 **Tell your AI assistant**: *"I need to create a Supabase Edge Function called `embed-question`. It should:*
> - *Accept a POST request with `{ "question": "..." }` in the body*
> - *Use the OpenAI API to generate an embedding with `text-embedding-3-small`*
> - *Return `{ "embedding": [...] }` in the response*
> - *Handle CORS for cross-origin requests from GitHub Pages*
> - *Verify the user is authenticated before processing"*

The function lives at: `supabase/functions/embed-question/index.ts`

You'll also need a shared CORS helper at: `supabase/functions/_shared/cors.ts`

> 💡 **Need a reference?** You can see a working implementation at [github.com/michaeltreynolds/cragger](https://github.com/michaeltreynolds/cragger/tree/main/supabase/functions)

> ⚠️ **Auth note**: Supabase is currently transitioning its JWT verification approach. Deploy with `--no-verify-jwt` and handle authentication manually inside your function using the `Authorization` header. See the cragger repo's `_shared/auth.ts` for this pattern.

#### 5. Deploy the Function

```bash
supabase functions deploy embed-question --no-verify-jwt
```

### 3. See Your Second Green Light! 🟢

After deploying the embed-question function:

1. **Refresh your site** (hard refresh: Ctrl+Shift+R)
2. The **🧠 Semantic Search** panel should now show **🟢 Ready**!

Try searching for *"How can I find peace during hard times?"* — notice how it finds relevant talks even without those exact keywords!

## Verification

- [ ] `04_embed_data.py` completes and reports embeddings generated
- [ ] `scripts/output/sentences_with_embeddings.json` exists (your safety net!)
- [ ] `05_update_embeddings.py` completes and reports rows updated
- [ ] `supabase --version` shows a version number
- [ ] `embed-question` function deployed without errors
- [ ] You can see the function in Supabase Dashboard → Edge Functions
- [ ] On your site: **🧠 Semantic Search** turns green and returns results!

## 🎉 Milestone: Second green light! Semantic Search works!

## → Next: [Step 06: RAG — All Lights Green](06_rag.md)
