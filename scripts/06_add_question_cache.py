"""
Add Question Cache Table
=========================
Creates a table to cache user questions, their embeddings, and AI-generated answers.
This saves money on OpenAI API calls and improves response time.

Usage:
    python scripts/06_add_question_cache.py

Prerequisites:
    - Existing database schema from 01_create_schema.py
    - config files with Supabase credentials
"""

import json
import sys
import time
import requests
from supabase import create_client

# Load configuration
with open('config.public.json', 'r') as f:
    public_config = json.load(f)
with open('config.secret.json', 'r') as f:
    secrets = json.load(f)

SUPABASE_URL = public_config['SUPABASE_URL']
SUPABASE_SERVICE_KEY = secrets['SUPABASE_SERVICE_KEY']
SUPABASE_ACCESS_TOKEN = secrets['SUPABASE_ACCESS_TOKEN']
SUPABASE_PROJECT_REF = secrets['SUPABASE_PROJECT_REF']


def create_question_cache_table():
    print("=" * 60)
    print("Creating Question Cache Table")
    print("=" * 60)

    schema_sql = """
-- Create question_cache table
CREATE TABLE IF NOT EXISTS question_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_embedding VECTOR(1536),
    ai_answer TEXT,
    context_talk_ids UUID[],  -- Array of talk IDs used to generate answer
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for exact question lookup (fastest)
CREATE INDEX IF NOT EXISTS idx_question_cache_question 
ON question_cache(question);

-- Index for embedding similarity search (find similar questions)
CREATE INDEX IF NOT EXISTS idx_question_cache_embedding 
ON question_cache USING ivfflat (question_embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_question_cache_user_id 
ON question_cache(user_id);

-- Index for created_at (to find recent queries)
CREATE INDEX IF NOT EXISTS idx_question_cache_created_at 
ON question_cache(created_at DESC);

-- Enable Row Level Security
ALTER TABLE question_cache ENABLE ROW LEVEL SECURITY;

-- RLS: Users can read their own cached questions
DROP POLICY IF EXISTS "Users can read own questions" ON question_cache;
CREATE POLICY "Users can read own questions"
ON question_cache FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS: Users can insert their own questions
DROP POLICY IF EXISTS "Users can insert own questions" ON question_cache;
CREATE POLICY "Users can insert own questions"
ON question_cache FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS: Users can update their own questions
DROP POLICY IF EXISTS "Users can update own questions" ON question_cache;
CREATE POLICY "Users can update own questions"
ON question_cache FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to find similar cached questions
CREATE OR REPLACE FUNCTION find_similar_questions(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.95,
    max_results INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    question TEXT,
    question_embedding VECTOR(1536),
    ai_answer TEXT,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
    SELECT
        question_cache.id,
        question_cache.question,
        question_cache.question_embedding,
        question_cache.ai_answer,
        1 - (question_cache.question_embedding <=> query_embedding) AS similarity,
        question_cache.created_at
    FROM question_cache
    WHERE question_cache.question_embedding IS NOT NULL
        AND question_cache.ai_answer IS NOT NULL
        AND (1 - (question_cache.question_embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY question_cache.question_embedding <=> query_embedding
    LIMIT max_results;
$$;
"""

    url = f"https://api.supabase.com/v1/projects/{SUPABASE_PROJECT_REF}/database/query"
    headers = {
        "Authorization": f"Bearer {SUPABASE_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    print("Creating question_cache table and indexes...")
    resp = requests.post(url, headers=headers, json={"query": schema_sql})
    
    if resp.status_code in (200, 201):
        print("✅ question_cache table created successfully!")
    else:
        print(f"❌ Table creation failed: {resp.status_code}")
        print(resp.text[:500])
        return False

    # Verify table exists
    print("Verifying table creation...")
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    for attempt in range(5):
        try:
            result = client.table('question_cache').select('id', count='exact').limit(1).execute()
            print(f"✅ Table verified! Current cached questions: {result.count or 0}")
            return True
        except Exception as e:
            if attempt < 4:
                print(f"   Waiting for schema cache to refresh... ({attempt + 1}/5)")
                time.sleep(3)
            else:
                print(f"⚠️  Table created but PostgREST cache hasn't refreshed yet: {e}")
                print("   It should be ready shortly.")
                return True


if __name__ == '__main__':
    if not create_question_cache_table():
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("✅ Question cache table ready!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Deploy updated embed-question function")
    print("2. Deploy updated generate-answer function")
    print("3. Questions and answers will now be cached automatically!")
