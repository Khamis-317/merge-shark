# Merge Shark

AI-powered Git conflict resolver.

---

## Setup

1. Install NPM packages.

   ```bash
   npm install
   ```
2. Setup your `GOOGLE_API_KEY` in the `.env` file.

   ```
   GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
   ```
3. Setup the `TAVILY_API_KEY` in the `.env` file.

   ```
   TAVILY_API_KEY=SOME_API_KEY
   ```
4. Build and run the CLI.

   ```bash
   npm run dev -- -- -r {PATH_TO_REPO} -m {LLM_MODEL} -e {EMBEDDING_MODEL} \
   -j {PATH_TO_JDTLS} \ # Must be parsed only when working with java.
   -d {JDTLS_DATA_PATH} # Optional ->>> defaults to creating a tmp directory within Merge-Shark's project root directory
   ```

## Tooling

If you're working in VS Code, it's very helpful to have the following extensions installed:

1. Prettier: for automatically formatting code on save.
2. ESLint: for linting the code.

If you don't have them installed, you'd need to format the code and resolve lint errors manually since these will be validated on CI anyway.
You can run `npm run lint` to check for linting and formatting errors manually.
