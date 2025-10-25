# WebGAL CLAUDE.md - Quick Start Guide for Future AI Instances

This file provides a quick index to the comprehensive CLAUDE.md documentation.

## What is CLAUDE.md?

A 543-line, comprehensive guide to the WebGAL codebase architecture covering:
- Project structure and monorepo organization
- Build pipeline and command sequences
- Architecture patterns and data flow
- Development workflows and common tasks
- CI/CD configuration
- Important gotchas and best practices

## Quick Navigation

### If you need to understand...

**The overall project:**
- Start with: "Project Overview" section
- Then read: "Monorepo Structure" for package breakdown

**How to build/run the project:**
- Start with: "Build Pipeline & Command Sequence"
- Key commands: `yarn dev`, `yarn build`, `yarn parser:test`

**How the code is organized:**
- Look at: "Monorepo Structure" > "packages/webgal" for full directory tree
- Understand: "Architecture Patterns" for design decisions

**How to add a new feature:**
- See: "Common Development Tasks" section
- Specific guides for: new commands, effects, UI components

**Why something isn't working:**
- Check: "Important Notes & Gotchas" for known issues
- Review: "Build Pipeline" for dependency order
- See: "CI/CD Configuration" for automated checks

**Where files are located:**
- Check: "Quick Reference" section with file paths
- Or: Directory tree in "Monorepo Structure"

## Key Files to Know About

```
/Users/fankex/Developer/WebGAL/
├── CLAUDE.md                              <- YOU ARE HERE (main docs)
├── packages/
│   ├── parser/                            <- Script parser (Rollup)
│   │   └── src/config/scriptConfig.ts    <- All game commands listed
│   ├── webgal/                            <- Main engine (Vite + React)
│   │   ├── src/Core/                      <- Game logic
│   │   ├── src/UI/                        <- React components
│   │   ├── src/store/                     <- Redux state
│   │   └── vite.config.ts                 <- Build config
│   └── server/                            <- Dev server
├── package.json                           <- Root build scripts
├── CONTRIBUTING.md                        <- Points to online docs
└── .github/workflows/                     <- CI/CD workflows
```

## Essential Commands

```bash
# Start development
yarn dev                    # Builds parser, starts dev server on port 3000

# Build for production
yarn build                  # Full build pipeline

# Run tests
yarn parser:test           # Unit tests for parser
yarn parser:test-coverage  # With coverage report
```

## 5-Minute Overview

1. **WebGAL is**: A web-based Visual Novel engine
2. **Built with**: TypeScript, React, Redux, Vite, Pixi.js
3. **Organized as**: Yarn monorepo with 3 main packages
4. **Build process**: Parser (Rollup) → Engine (Vite)
5. **Architecture**: Script → Parser → Redux → React → WebGL

## Common Tasks Quick Links

- **Add new game command**: See "Common Development Tasks" > "Add a New Game Command"
- **Add visual effect**: See "Common Development Tasks" > "Add a New Pixi Effect"
- **Modify UI**: See "Common Development Tasks" > "Modify UI Components"
- **Debug issue**: See "Important Notes & Gotchas" (critical gotchas listed)
- **Deploy**: See "Common Development Tasks" > "Deploy to Production"

## For Troubleshooting

1. **Build fails**: Check "Build Pipeline" - parser must build first
2. **Something auto-generated**: Check "Architecture Patterns" > "Effect Registration Pattern"
3. **State not updating**: Check "State Management" section
4. **Asset loading fails**: Check "Important Notes & Gotchas" about asset paths
5. **Parser related**: See "Parser Details" section with command reference

## Important Gotchas (Check These First!)

1. Yarn workspaces - must run from root or cd to package
2. Parser must build before webgal - there's a dependency
3. pixi effects are auto-generated - don't manually edit initRegister.ts
4. Asset paths are relative to /game/ folder, not repo root
5. iOS only works in landscape orientation

(See full list in "Important Notes & Gotchas" section of CLAUDE.md)

## External Resources

- Full online docs: https://docs.openwebgal.com/
- Developer guide: https://docs.openwebgal.com/developers/
- Live demo: https://demo.openwebgal.com/
- Community: https://discord.gg/kPrQkJttJy

---

**Note**: This quick start file was generated alongside CLAUDE.md for convenience.
For in-depth information, refer to the main CLAUDE.md documentation.
