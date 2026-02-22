# Releasing Hatch Desktop

## Prerequisites

- Push access to `serrrfirat/hatch-sh` (for tags/releases)
- Push access to `serrrfirat/homebrew-tap` (for Cask updates)
- `gh` CLI authenticated (optional, for verifying releases)

## Release Process

### 1. Bump version

```bash
node scripts/bump-version.mjs 0.2.0
```

This updates all three version sources:
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/Cargo.toml`

### 2. Commit and tag

```bash
git add -A
git commit -m "chore: bump version to 0.2.0"
git tag v0.2.0
git push && git push --tags
```

### 3. Wait for CI

The `release-desktop.yml` workflow triggers on the `v*` tag push. It builds:
- **macOS**: Universal binary `.dmg` (Intel + Apple Silicon)
- **Linux**: `.deb` and `.AppImage`

Artifacts are uploaded to a **draft** GitHub Release.

### 4. Review and publish

1. Go to [GitHub Releases](https://github.com/serrrfirat/hatch-sh/releases)
2. Find the draft release for your tag
3. Verify the artifacts are present and the release notes look correct
4. Click **Publish release**

### 5. Update Homebrew tap

After publishing, download the macOS `.dmg` and compute its SHA256:

```bash
# Download the DMG (adjust filename if needed)
gh release download v0.2.0 --pattern '*.dmg' --dir /tmp

# Compute SHA256
shasum -a 256 /tmp/Hatch_0.2.0_universal.dmg
```

Then update the tap:

```bash
./scripts/update-homebrew-tap.sh 0.2.0 <sha256-from-above>
```

Users can now install with:

```bash
brew tap serrrfirat/tap
brew install --cask hatch
```

## Notes

- The app is **not code-signed** yet. macOS users need to right-click > Open on first launch.
- The DMG filename pattern is `Hatch_<version>_universal.dmg` -- verify after first build and update the Cask if different.
- Windows builds are not currently supported.
