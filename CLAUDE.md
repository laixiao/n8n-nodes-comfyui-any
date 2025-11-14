# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an n8n community node package that integrates with [ComfyUI](https://github.com/comfyanonymous/ComfyUI), enabling n8n workflows to execute ComfyUI workflows and retrieve any type of output (not just images or videos).

**Main difference from other ComfyUI n8n nodes:** This package supports any workflow output, while others are limited to specific output types (images, videos, etc.).

## Available Commands

### Development
```bash
pnpm install              # Install dependencies (pnpm is enforced via preinstall hook)
pnpm dev                  # Run TypeScript compiler in watch mode
pnpm build                # Compile TypeScript and copy icons to dist/
pnpm format               # Format code with Prettier
pnpm lint                 # Lint TypeScript files
pnpm lintfix              # Lint and auto-fix issues
```

### Publishing
```bash
pnpm prepublishOnly       # Build and lint before publishing (runs automatically before npm publish)
```

**Note:** This project enforces pnpm as the package manager via the `preinstall` hook.

## Code Architecture

### Source Structure
- **TypeScript source:** `nodes/` and `credentials/` directories
- **Compiled output:** `dist/` directory (git-ignored)
- **Icon files:** `nodes/ComfyUI/comfyui.svg` (copied to dist during build)

### Core Components

**1. ComfyuiAny Node** (`nodes/ComfyUI/ComfyuiAny.node.ts`)
- Implements the main workflow execution logic
- **Process flow:**
  1. Retrieves API URL and key from parameters or credentials (lines 70-88)
  2. Validates API URL is provided
  3. Constructs authorization headers with Bearer token if API key present (lines 94-101)
  4. Pings `/system_stats` to verify ComfyUI connection (lines 105-111)
  5. Queues workflow via `/prompt` endpoint (lines 114-123)
  6. Polls `/history/{promptId}` every second until completion or timeout (lines 132-174)
  7. Returns `promptResult.outputs` as the node output (line 172)

- **Key features:**
  - Configurable timeout (default: 30 minutes, line 90, 134)
  - Optional credential-based authentication
  - Comprehensive error handling with `NodeApiError`
  - Console logging for workflow execution steps

**2. ComfyUIApi Credential** (`credentials/ComfyUIApi.credentials.ts`)
- Manages API authentication configuration
- Properties:
  - `apiUrl`: ComfyUI instance URL (default: http://127.0.0.1:8188)
  - `apiKey`: Optional authentication token
- Includes credential test that hits `/system_stats` endpoint

### Configuration Files

**TypeScript Config** (`tsconfig.json`)
- Strict mode enabled with comprehensive type checking
- CommonJS modules targeting ES2019+
- Declaration files generated for IntelliSense
- Output directory: `./dist/`

**ESLint Config** (`.eslintrc.js`)
- Uses `@typescript-eslint/parser` for TypeScript support
- Extends `plugin:n8n-nodes-base` for n8n-specific rules
- Separate configs for `package.json`, credentials, and nodes
- Ignores compiled JS files and dependencies

**Prettier Config** (`.prettierrc.js`)
- Semicolons enabled, trailing commas on all
- Single quotes, tab width 2, useTabs enabled
- Print width 100, LF line endings

**Build Process** (`gulpfile.js`)
- Gulp task `build:icons` copies icon files from source to dist
- Handles both node and credential icons
- Automatically runs as part of `pnpm build`

## Integration with ComfyUI API

The node interacts with these ComfyUI endpoints:

1. **`GET /system_stats`** - Health check (lines 106-111)
2. **`POST /prompt`** - Queue workflow execution (lines 115-123)
3. **`GET /history/{promptId}`** - Poll for execution status (lines 141-146)

**Workflow format:** The node accepts ComfyUI workflow JSON as a parameter, parses it, and submits it to the prompt endpoint.

**Output format:** Returns `promptResult.outputs` as an array, allowing any output type that ComfyUI generates.

## Development Notes

- **Node version requirement:** >= 18.10
- **Package manager:** pnpm >= 9.1 (enforced)
- **Credential integration:** Credentials are optional; API URL/key can be provided via node parameters or n8n credentials
- **Error handling:** All errors are wrapped with `NodeApiError` for proper n8n error propagation
- **Timeout handling:** Polling occurs at 1-second intervals with total timeout based on user configuration
