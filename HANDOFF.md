# Handoff: publish MathBridge AI to GitHub and Replit

This folder holds the finished MathBridge AI app, with its git history. It was built and tested in a cloud Claude session. What's left is to put it on GitHub and run it on Replit, which needs the owner's own GitHub and Replit logins.

## For Claude Code (running on the owner's computer, inside this folder)

Do these steps in order, and confirm each one before moving on.

1. **Check the code.**
   - Run `node --version`; it must be 20 or newer.
   - Run `npm test`; all tests should pass. The app has no dependencies, so skip `npm install`.
   - Optionally run `npm start` and open http://localhost:3000. You should see "Learn from every mistake."

2. **Check the GitHub CLI.** Run `gh auth status`.
   - If it mentions a `GH_TOKEN` or `GITHUB_TOKEN` environment variable, that variable is overriding the login. Tell the user, and unset it for this shell (`unset GH_TOKEN GITHUB_TOKEN`, or the PowerShell equivalent).
   - If the user is not logged in, ask them to run `gh auth login --hostname github.com --git-protocol https --web` themselves and finish the browser step.

3. **Create the repo and push.** The account is `ocfagb`.
   - If `ocfagb/mathbridge-ai` does not exist yet:
     ```
     gh repo create ocfagb/mathbridge-ai --public --source=. --remote=origin --push --description "Practice one-step equations with hints tailored to your exact mistake (grades 6-8)"
     ```
   - If it already exists and is empty:
     ```
     git remote add origin https://github.com/ocfagb/mathbridge-ai.git
     git push -u origin main
     ```
   - If it already exists and has commits, stop and ask the user. Do not force-push.

4. **Deploy on Replit.** Open https://replit.com/github.com/ocfagb/mathbridge-ai in the browser.
   - The `.replit` file already sets the run command (`npm start`), the port (3000 → 80) and Autoscale deployment.
   - The user clicks **Run**, then **Publish → Autoscale → Publish**. Let the user approve any sign-in or payment prompt themselves.
   - Free plan: one published app, which goes offline after 30 days. Republish shortly before the demo.

5. **Do not turn on AI hints** (`AI_HINTS`, `GEMINI_API_KEY`). Google's Gemini API terms appear to forbid apps likely to be used by people under 18; see `docs/RESEARCH.md`. The app works fully without AI.

6. **Report back** with the GitHub URL and the published Replit URL.

## For a human doing it by hand

1. Create an empty repo at https://github.com/new named `mathbridge-ai`. Don't add a README.
2. In this folder, run:
   ```
   git remote add origin https://github.com/ocfagb/mathbridge-ai.git
   git push -u origin main
   ```
3. Open https://replit.com/github.com/ocfagb/mathbridge-ai, click **Run**, then **Publish → Autoscale**.
