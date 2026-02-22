#!/usr/bin/env bash
set -euo pipefail

# Update the Homebrew Cask formula in serrrfirat/homebrew-tap.
# Usage: ./scripts/update-homebrew-tap.sh <version> <sha256>
# Example: ./scripts/update-homebrew-tap.sh 0.2.0 abc123def456...

VERSION="${1:-}"
SHA256="${2:-}"

if [[ -z "$VERSION" || -z "$SHA256" ]]; then
  echo "Usage: $0 <version> <sha256>"
  echo "Example: $0 0.2.0 abc123def456..."
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Invalid semver format: $VERSION"
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "Cloning serrrfirat/homebrew-tap..."
git clone --depth 1 git@github.com:serrrfirat/homebrew-tap.git "$TMPDIR/homebrew-tap"

CASK="$TMPDIR/homebrew-tap/Casks/hatch.rb"

if [[ ! -f "$CASK" ]]; then
  echo "Error: Cask file not found at $CASK"
  echo "Make sure the Casks/hatch.rb file exists in the tap repo."
  exit 1
fi

echo "Updating version to $VERSION and sha256..."
sed -i.bak "s/version \".*\"/version \"$VERSION\"/" "$CASK"
sed -i.bak "s/sha256 \".*\"/sha256 \"$SHA256\"/" "$CASK"
rm -f "$CASK.bak"

cd "$TMPDIR/homebrew-tap"
git add Casks/hatch.rb
git commit -m "hatch: update to $VERSION"
git push

echo ""
echo "Done! Tap updated to version $VERSION."
echo "Users can install with: brew tap serrrfirat/tap && brew install --cask hatch"
