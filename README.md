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
3. Build the CLI.
   ```bash
   npm run build
   ```
4. Run the CLI.
   ```
   npm run start -- --repo /path/to/git/repo
   ```

## Tooling

If you're working in VS Code, it's very helpful to have the following extensions installed:

1. Prettier: for automatically formatting code on save.
2. ESLint: for linting the code.

If you don't have them installed, you'd need to format the code and resolve lint errors manually since these will be validated on CI anyway.
You can run `npm run lint` to check for linting and formatting errors manually.
