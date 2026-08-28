# ScholarMate AI 2.0 - Professional AI Learning Platform

ScholarMate AI is an intelligent workspace for students and researchers, offering AI file quiz generation, study guide synthesis, 3D active recall flashcards, and telemetry tracking powered by Supabase and Gemini AI.

---

## 🚀 Quick Setup Guide

### 1. Supabase Database & Auth Setup

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and open your project.
2. Go to **SQL Editor** on the left menu.
3. Click **New Query**, paste the contents of `supabase_schema.sql` into the editor, and click **Run**. This automatically creates all required database tables (`profiles`, `materials`, `quiz_history`, `user_badges`, `user_chats`, `user_notes`), sets up Row Level Security (RLS), and registers the user signup trigger.
4. Go to **Project Settings -> API** in Supabase and copy:
   - **Project URL**
   - **anon public key**
5. Open `config.js` in your project and replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with your credentials:
   ```javascript
   const SUPABASE_URL = window.ENV_SUPABASE_URL || 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || 'your-actual-anon-key';
   ```

---

### 2. Real Google Authentication Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create your project, go to **APIs & Services -> Credentials**, and click **Create Credentials -> OAuth client ID**.
3. Select Application type: **Web application**.
4. Add to **Authorized JavaScript origins**:
   - `https://your-project.supabase.co`
   - `https://your-app-name.vercel.app` (your Vercel site URL)
   - `http://localhost:3000` or `http://127.0.0.1:5500` (for local development)
5. Add to **Authorized redirect URIs**:
   - `https://<YOUR-SUPABASE-PROJECT-REF>.supabase.co/auth/v1/callback`
6. Copy your **Client ID** and **Client Secret**.
7. Go back to your [Supabase Dashboard](https://supabase.com/dashboard) -> **Authentication -> Providers -> Google**:
   - Enable the Google Provider toggle.
   - Paste your **Client ID** and **Client Secret**.
   - Click **Save**.

---

### 3. Forgot Password / Email Configuration

1. In your Supabase Dashboard, go to **Authentication -> Email Templates -> Reset Password**.
2. Ensure the redirect URL is set to `{{ .SiteURL }}` or `https://your-app-name.vercel.app`.
3. When users click **Forgot password?** on the sign-in form, Supabase sends a recovery link. Clicking the email link brings the user back to ScholarMate AI with an active recovery session, automatically prompting the **Set New Password** modal to enter their new password!

---

### 4. Push to GitHub & Deploy to Vercel

#### Step A: Push Code to GitHub
Open your terminal in the `ScholarMate.ai` folder and run:
```bash
git init
git add .
git commit -m "Migrate to Supabase, Google Auth, Password Reset, and Vercel Serverless"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/ScholarMate.ai.git
git push -u origin main
```

#### Step B: Deploy to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/) and click **Add New -> Project**.
2. Import your `ScholarMate.ai` GitHub repository.
3. In the **Environment Variables** section, add the following variables:
   - `SUPABASE_URL`: `https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY`: `your-anon-key`
   - `GEMINI_API_KEY`: `your-gemini-api-key`
4. Click **Deploy**. Vercel will host your website and serverless backend (`/api/chat`) instantly!

---

## 🛠 Features Included
- **Cloud-Native Auth & Database**: Powered by Supabase (No local SQLite needed).
- **Google OAuth**: Official authentication flow via Google Cloud Console & Supabase.
- **Forgot Password Recovery**: Regenerate lost passwords via email magic link.
- **AI Engine**: Document context quiz generator, study guide synthesis, and tutor assistant.
- **Zero Demo Accounts**: Clean production authentication for real users.
