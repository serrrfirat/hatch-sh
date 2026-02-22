cask "hatch" do
  version "0.1.0"
  sha256 "PLACEHOLDER_SHA256"

  url "https://github.com/serrrfirat/hatch-sh/releases/download/v#{version}/Hatch_#{version}_universal.dmg",
      verified: "github.com/serrrfirat/hatch-sh/"

  name "Hatch"
  desc "Ship your side project from idea to production"
  homepage "https://hatch.sh"

  depends_on macos: ">= :high_sierra"

  app "Hatch.app"

  zap trash: [
    "~/Library/Application Support/sh.hatch.desktop",
    "~/Library/Caches/sh.hatch.desktop",
    "~/Library/Preferences/sh.hatch.desktop.plist",
    "~/Library/Saved Application State/sh.hatch.desktop.savedState",
  ]
end
