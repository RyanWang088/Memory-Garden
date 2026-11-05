# 🌱 Sproutly: A Study Garden That Grows With You

Welcome to Sproutly! Every subject you study becomes a plant in your garden. Plant a seed of flashcards, review it with flashcards, a multiple-choice quiz or AI-marked short structured questions, and watch the plant grow. Skip your revision and it starts to wilt.

The project is a full-stack web application with two parts, and **both must be running**:

| Folder | What it is | Runs on |
| :-- | :-- | :-- |
| `client/` | Vue 3 + Vite front end (Pinia, Vue Router, Bootstrap) | `http://localhost:5173` |
| `server/` | Node.js + Express API (AI flashcard generation and marking) | `http://localhost:3000` |

The database will be hosted on Supabase.

---

## ⚙️ 1. Installation & Setup

To run this application locally, please follow these steps:

1. **Check the requirements:**
    - **Node.js 22 or newer** (check with `node -v`)
    - **pnpm** (install it with `npm install -g pnpm`)

2. **Unzip the project folder** and open a terminal in the root directory.

3. **Install dependencies** from the root folder, once for each folder:

    ```bash
    cd server
    pnpm install
    

    cd client
    pnpm install
    ```

4. **Environment variables:** the keys the app needs are already included in the `.env` files of this zip package:

    - `server/.env`: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and the AI keys (`OPENROUTER_API_KEY`, `GROQ_API_KEY`)
    - `client/.env.local`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`

    

5. **Start the server** (Terminal 1, leave it running):

    ```bash
    cd server
    pnpm start
    ```

6. **Start the client** (Terminal 2):

    ```bash
    cd client
    pnpm dev
    ```

7. **Access the application:** open your browser and go to `http://localhost:5173`

---

## 🔐 2. Credentials

All pages except the landing page require the user to log in.

To make grading easier, you may use the following pre-configured account. It already has seeds planted, and the E2E tests use it too.

_Note: you may also create a new account with **Sign up** to experience the onboarding process._

| Role | Email | Password |
| :-- | :-- | :-- |
| **Demo account** | `demo@smu.edu.sg` | `demo@smu.edu.sg` |

---

## 🧪 3. End-to-End Testing (Playwright)

The tests are in `client/tests/e2e/`. They log in as the demo account and click through the app in a real browser.

1. **Install the test browser** (once only):

    ```bash
    cd client
    pnpm exec playwright install chromium
    ```

2. **Start the server** (Terminal 1 from step 5 above) and leave it running.

    Ensure that "localhost:5173" is running before continuing onto the below steps.

3. **Run the tests** from the `client` folder.

    **Option A: run all the test files at once**

    ```bash
    pnpm exec playwright test --workers=1
    ```

    **Option B: run one test file at a time**

    ```bash
    pnpm exec playwright test tests/e2e/add-a-seed.spec.js
    pnpm exec playwright test tests/e2e/garden.spec.js
    pnpm exec playwright test tests/e2e/opening.spec.js
    pnpm exec playwright test tests/e2e/planner.spec.js
    pnpm exec playwright test tests/e2e/pomodoro.spec.js
    pnpm exec playwright test tests/e2e/review.spec.js
    ```


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
- **Ryan:** Used AI to:
    - Help build and restyle the review modes (Flashcard, Multiple Choice and Short Structured) based on my requirements. (I made the feature and design decisions, tested them in the app, and reviewed the code.)
    - Created custom made icon for the Flashcard Mode, Multiple choice and short structured in review features.
    - Style the Short Structured answer box (brown outline on the notebook lines), using the colours from theme.css.
    - Write out the AI marking prompt for Short Structured answers.
    - create the structure for the Planner book and the grids for the calendar view, and the background for the to-do list like a notebook/foolscap paper
- **Claudine:** Used AI to:
    - Write Pomodoro feature code based on my requirements. (logic and feature decisions, as well as testing are done personally)
    - Create the garden radio feature (lo-fi songs were selected from an open source on github and matched to weather personally)
    - Add the Plant and Review animations in the Onboarding feature.

---

_Created by Team Sproutly:  Xiao Jing, Yu Jia, Jit Wei, Ryan, Claudine._
