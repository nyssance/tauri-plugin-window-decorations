# Development guide

This document is for contributors and maintainers working in the repository.
Application developers normally need only the [integration guide](integration.md).

## Toolchain

Install Rust 1.95 or later, Node.js 24, pnpm 11.18.0, and the platform
prerequisites required by Tauri.

Install the private workspace tooling without changing the lockfile:

```sh
pnpm install --frozen-lockfile
```

## Repository layout

| Path | Contents |
| --- | --- |
| `src/` | Rust lifecycle, native platform bridges, and embedded frontend assets |
| `permissions/` | Tauri plugin permissions and generated schemas |
| `tests/frontend/` | Fast behavioral tests for the embedded frontend |
| `docs/` | Consumer integration, platform, migration, and development guides |
| `.github/workflows/` | Cross-platform validation, packaging, and release automation |

The repository contains the plugin and its consumer documentation. It does not
ship a demo application; copy the configuration from the integration guide into
your Tauri application.

## Fast validation

```sh
cargo fmt --all -- --check
cargo clippy --locked --all-targets --all-features -- -D warnings -D rust-2024-compatibility
cargo test --locked --all-features
pnpm test:frontend
```

The lockfiles are part of the validation contract. Keep `--locked` or
`--frozen-lockfile` in reproducible checks.
