# GitHub & Enable Pages Setup

## What was fixed

- **502 / "Repo not found: haiconsulting/https://..."** — The app was treating a pasted **full GitHub URL** as the repo name, so the API tried to open a repo path like `haiconsulting/https://github.com/...`. That is fixed: you can paste either the **repo name** (e.g. `hai-demo-vincent-dental-roswell`) or the **full URL** (e.g. `https://github.com/haiconsulting/hai-demo-vincent-dental-roswell`). The app now parses the URL and uses the correct owner and repo.

## Where are the demo repos?

- If they’re under **https://github.com/haiconsulting/...** → they’re in the **HAI org**. Use a PAT that can access the **haiconsulting** organization (see below).
- If they’re under **https://github.com/YourUsername/...** → they’re on your **personal account**. You can still use “Enable Pages & link”: paste the **full repo URL** and the app will use the owner from the URL (your username), so no need to change `GITHUB_ORG`.

## Env variables (local and Vercel)

### 1. `GITHUB_PAT` (required)

- **What:** A GitHub Personal Access Token (PAT) or Fine-grained token used to create repos, push files, and enable GitHub Pages.
- **Where:** Add in `.env` locally and in **Vercel → Project → Settings → Environment Variables** for the same values you use in production.
- **Scopes (classic PAT):**
  - `repo` (full)
  - For **organization** repos: the token must be allowed access to the **haiconsulting** org:
    - GitHub → Settings → Developer settings → Personal access tokens → (edit token) → **Organization permissions** → find **haiconsulting** → set to **Access: Read and write** (or at least **Read and write** for repos and Pages).
- **Fine-grained token:** Repo permissions: **Contents** (Read and write), **Pages** (Read and write), **Metadata** (Read). Restrict to the repos or org you use.

### 2. `GITHUB_ORG` (optional)

- **What:** Default owner when you type only the **repo name** (e.g. `hai-demo-vincent-dental-roswell`) in “Link existing repo”.
- **Default:** `haiconsulting`.
- **When to set:** If your demo repos are in an org, set `GITHUB_ORG` to that org (e.g. `haiconsulting`). If you only ever paste **full GitHub URLs**, the app uses the owner from the URL and `GITHUB_ORG` is only used as fallback.

## Steps to get Enable Pages & Linking working

1. **Confirm repo location**
   - Open https://github.com/haiconsulting/hai-demo-vincent-dental-roswell (or your repo) in the browser.
   - If you get 404, the repo might be under your **personal** account; in that case use the URL that works (e.g. `https://github.com/YourUsername/hai-demo-vincent-dental-roswell`).

2. **Use a token that can see that repo**
   - **Org repos:** Create (or edit) a classic PAT with `repo` and **Organization permissions** for **haiconsulting** set to **Read and write**.
   - **Personal repos:** A classic PAT with `repo` is enough; paste the **full repo URL** in the app.

3. **Set env in Vercel**
   - **Vercel** → your **website-enhancer** project → **Settings** → **Environment Variables**.
   - Add `GITHUB_PAT` with the token value; apply to **Production** (and Preview if you use it).
   - Optionally set `GITHUB_ORG` to `haiconsulting` (or leave unset to use the default).

4. **Redeploy**
   - After changing env vars, trigger a new deployment (e.g. **Deployments** → … → **Redeploy**) so the new values are used.

5. **In the app**
   - On the prospect page, under “Already have a repo on GitHub?”, paste either:
     - Repo name: `hai-demo-vincent-dental-roswell`, or  
     - Full URL: `https://github.com/haiconsulting/hai-demo-vincent-dental-roswell`
   - Click **Enable Pages & link**. If you still get “Repo not found”, the PAT doesn’t have access to that owner/repo — double-check org permissions or use the full URL for a personal repo.

## Quick check: who owns the repo?

- In the repo on GitHub, look at the top: it shows **haiconsulting / repo-name** (org) or **YourUsername / repo-name** (personal).
- If it’s **haiconsulting**, your `GITHUB_PAT` must have **organization** access to **haiconsulting** (classic PAT: org permission **Read and write** for that org).
