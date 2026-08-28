-- SCHOLARMATE AI - SUPABASE DATABASE SCHEMA
-- Run this SQL in your Supabase Project -> SQL Editor to set up all tables and security policies.

-- 1. PROFILES TABLE (Linked to Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    streak INTEGER DEFAULT 0,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    quizzes_taken INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    study_minutes INTEGER DEFAULT 0,
    mastery JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MATERIALS TABLE
CREATE TABLE IF NOT EXISTS public.materials (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size TEXT DEFAULT '1.0 MB',
    content TEXT,
    subject TEXT DEFAULT 'General',
    folder TEXT DEFAULT 'Default',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. QUIZ HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.quiz_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    score TEXT NOT NULL,
    question_count INTEGER DEFAULT 0,
    quiz_type TEXT DEFAULT 'Quiz',
    review_data JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. USER BADGES TABLE
CREATE TABLE IF NOT EXISTS public.user_badges (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_key TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge_key)
);

-- 5. USER CHATS TABLE
CREATE TABLE IF NOT EXISTS public.user_chats (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    attached_file TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. USER NOTES TABLE
CREATE TABLE IF NOT EXISTS public.user_notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures users can ONLY access and modify their own data.
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Materials Policies
CREATE POLICY "Users can view own materials" ON public.materials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own materials" ON public.materials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own materials" ON public.materials FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own materials" ON public.materials FOR DELETE USING (auth.uid() = user_id);

-- Quiz History Policies
CREATE POLICY "Users can view own quiz history" ON public.quiz_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quiz history" ON public.quiz_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own quiz history" ON public.quiz_history FOR DELETE USING (auth.uid() = user_id);

-- User Badges Policies
CREATE POLICY "Users can view own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Chats Policies
CREATE POLICY "Users can view own chats" ON public.user_chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chats" ON public.user_chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own chats" ON public.user_chats FOR DELETE USING (auth.uid() = user_id);

-- User Notes Policies
CREATE POLICY "Users can view own notes" ON public.user_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON public.user_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.user_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.user_notes FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- Automatically creates a profile record when a new user signs up via Auth
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, picture)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(public.profiles.name, EXCLUDED.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
