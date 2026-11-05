# 🌱 Sproutly: A Study Garden That Grows With You

Welcome to Sproutly! Every subject you study becomes a plant in your garden. Plant a seed of flashcards, review it with flashcards, a multiple-choice quiz or AI-marked short structured questions, and watch the plant grow. Skip your revision and it starts to wilt.

The project is a full-stack web application with two parts, and client and server must be running:

| Folder | What it is | Runs on |

| `client/` | Vue 3 + Vite front end (Pinia, Vue Router, Bootstrap) | `http://localhost:5173` |
| `server/` | Node.js + Express API (AI flashcard generation and marking) | `http://localhost:3000` |

The database is hosted on Supabase, so no database setup is needed.

Landing page for live application: https://memory-garden-gold.vercel.app
Our GitHub repo: https://github.com/RyanWang088/Memory-Garden

---

## ⚙️ 1. Installation & Setup

To run this application locally, please follow these steps:

1. **Check the requirements:**

    - **Node.js 22.9 or newer** (check with `node -v`)
    - **pnpm** (install it with `npm install -g pnpm`)

2. **Unzip the project folder** and open a terminal inside the "Sproutly source code" folder (the one that contains the `client` and `server` folders). From here on, this folder is called the root folder.
3. **Install dependencies** from the root folder, once for each folder:

    ```bash
    cd server
    pnpm install

    cd ../client
    pnpm install
    ```

4.  **Create the .env files**
    Create the two new files below, using these exact names. On Windows, check that the name does not end in .txt (in Notepad, choose "Save as type: All files").


Create client/.env.local (inside the client folder) with these 2 lines:
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=


Create server/.env (inside the server folder) with these 6 lines:
PORT=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
GROQ_API_KEY=

If the server stops with the error "supabaseUrl is required", server/.env is missing or misnamed.



5. **Start the server** (Terminal 1, opened in the root folder, leave it running):

    ```bash
    cd server
    pnpm start
    ```

6. **Start the client** (Terminal 2, opened in the root folder, leave it running):

    ```bash
    cd client
    pnpm dev
    ```

7. **Access the application:** open your browser and go to `http://localhost:5173`

---

## 🔐 2. Credentials

All pages except the landing page require the user to log in.

To make grading easier, you may use the following pre-configured account. It already has seeds planted, and the E2E tests use it too, so please don't delete any seeds in the demo account!

Note: you may also create a new account with **Sign up** to experience the onboarding process.

| Role | Email | Password |

| **Demo account** | `demo@smu.edu.sg` | `demo@smu.edu.sg` |



---

## 🧪 3. End-to-End Testing (Playwright)

The tests are in `client/tests/e2e/`. They log in as the demo account and click through the app in a real browser, so running them changes that account's coins and mastery.

1. **Install the test browser** (once only, in a new terminal opened in the root folder):

    ```bash
    cd client
    pnpm exec playwright install chromium
    ```

2. If server and client are not started, Start the server and the client (steps 5 and 6 above) and leave both running.

3. Then from a new terminal, run the tests from the `client` folder.

    Paste each command line one at a time:

    pnpm exec playwright test tests/e2e/add-a-seed.spec.js
    pnpm exec playwright test tests/e2e/garden.spec.js
    pnpm exec playwright test tests/e2e/opening.spec.js
    pnpm exec playwright test tests/e2e/planner.spec.js
    pnpm exec playwright test tests/e2e/pomodoro.spec.js
    pnpm exec playwright test tests/e2e/review.spec.js


    If a test fails at the login step, wait a few minutes and run it again.


You can also run the tests from VS Code with the **Playwright Test for VS Code** extension: open the Testing panel (the flask icon) and click ▶ next to a test file or a single test. The server must still be running.

---

## 🌷 4. Features at a Glance

- **Landing page (opening page):** the public homepage, seen before logging in. The top links scroll to About, Features, Focus and How it works. A feature showcase walks through the planner, to-do list, focus timer, memory seeds, Garden Radio, and streaks & coins. "Start growing" leads to sign up, and "Log in" to the login page.
- **Garden:** your home page. Each seed is a plant that grows when you review it and wilts when you don't. Shows a countdown to your next exam.
- **Plant a seed:** type flashcards yourself, or upload a document and let the AI write up to 50 cards, each with 3 trap answers for the quiz. Preview, edit or delete cards before planting.
- **Review a seed** has 3 modes:
    - **Flashcards:** flip and rate each card Forgot / Hard / Easy.
    - **Multiple choice:** up to 10 questions. 60%+ earns 10 coins, 75%+ earns 20, 90%+ earns 30.
    - **Short structured:** type your answer and the AI marks it. 60%+ earns 15 coins, 75%+ earns 30 coins, 90%+ earns 45 coins.
- **Planner:** a to-do list and calendar showing exams and reviews that are due.
- **Focus timer:** Pomodoro-style focus rounds that earn coins for finished minutes.
- **Profile & flower house:** stats and streaks. After an exam, a subject's flower can move to the flower house shelf.

---


## 🤖 5. Appendix: AI Usage Declaration

**Individual member breakdown:**

- **Xiao Jing:** Used AI to:
    - AI was used to implement opening-page animations and transitions, as well as character reactions to user input on the login page.
- **Yu Jia:** Used AI to:
    - HTML canvas rendering achieved with AI assistance
- **Jit Wei:** Used AI to:
    - the parsing of documents to generate the question answer pair
    - Figuring out a function's syntax, then manually cross checked with documentation for open source items
- **Ryan:** Used AI to:
    - Help build and restyle the review modes (Flashcard, Multiple Choice and Short Structured) based on my requirements.
    - Created custom made icon for the Flashcard Mode, Multiple choice and short structured in review features.
    - Style the Short Structured answer box (brown outline on the notebook lines), using the colours from theme.css.
    - Write out the AI marking prompt for Short Structured answers.
    - Created the structure for the Planner book and the grids for the calendar view, and the background for the to-do list
- **Claudine:** Used AI to:
    - Write Pomodoro feature code based on my requirements. (logic and feature decisions, as well as testing of feature were done personally)
    - Create the garden radio feature (lo-fi tracks were sourced from github and matched to weather personally after AI helped to filter away noisy ones)
    - Convert tracks to 96kbps at the same loudness.
    - Add the Plant and Review animations in the Onboarding feature.

---

Created by Team Sproutly:  Xiao Jing, Yu Jia, Jit Wei, Ryan, Claudine.
