# Agent 37 Client

Thin client for Agent 37 Cloud: persistent isolated sandboxes with messaging, files, and shell. Hides HTTP details.

TypeScript package `agent37`.

## Install

```sh
npm install github:theAliCanAcar/agent37#main
```

## How to use

```ts
import { createAgent37 } from 'agent37';

// Provide the API key from your environment — never hardcode secrets.
const client = createAgent37({ apiKey: process.env.AGENT37_API_KEY });
const instance = await client.create({ prompt: 'Summarize /workspace/notes.md' });
console.log(await instance.message('List files'));
await client.destroy(instance.id);
```

## Use cases

### 1. Create an isolated cloud sandbox

- **Scenario:** You need a persistent instance with files and shell.
- **Outcome:** create() returns an instance handle with message/files/shell helpers.

### 2. Clean up after a job

- **Scenario:** A temporary analysis instance is finished.
- **Outcome:** Call destroy(id) so unused sandboxes do not linger.

## Dependencies

No package dependencies.

## Scripts

```sh
npm install
npm run build
```

## Notes

- Keep API keys in environment variables or a gitignored `.env`. Never commit secrets.
- Side-effecting tools should go through approval when used with `agent-approval`.
- Related packages live in separate repositories under [theAliCanAcar](https://github.com/theAliCanAcar).

## License

MIT
