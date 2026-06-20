#!/usr/bin/env bash
#
# Build a .deb package for Fokus.
#
# Usage:
#   ./build/linux/package-deb.sh [version]
#
# Builds the Wails binary (with the webkit2_41 tag required on Ubuntu 24.04+),
# assembles a Debian package tree, and produces build/bin/fokus_<version>_amd64.deb
# using dpkg-deb (no extra tooling required).

set -euo pipefail

# resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

# metadata
PKG_NAME="fokus"
VERSION="${1:-1.1.0}"
ARCH="$(dpkg --print-architecture)"   # amd64 here
MAINTAINER="David <davidrichardson1945@gmail.com>"
DESC_SHORT="Minimalist, distraction-free fullscreen text editor"

# Runtime libraries the webkit2_41 build links against.
DEPENDS="libwebkit2gtk-4.1-0, libgtk-3-0"

STAGE="build/linux/pkg-root"
DEB_OUT="build/bin/${PKG_NAME}_${VERSION}_${ARCH}.deb"

# 1. build the binary
echo ">> Building Fokus binary…"
wails build -tags webkit2_41

# 2. assemble the package tree
echo ">> Assembling package tree…"
rm -rf "$STAGE"
install -d "$STAGE/DEBIAN"
install -d "$STAGE/usr/bin"
install -d "$STAGE/usr/share/applications"
install -d "$STAGE/usr/share/icons/hicolor/512x512/apps"

# binary
install -m 0755 build/bin/Fokus "$STAGE/usr/bin/fokus"

# icon (scale the 1024px source down to 512 if ImageMagick is present;
# otherwise just ship the source PNG as-is).
ICON_DEST="$STAGE/usr/share/icons/hicolor/512x512/apps/fokus.png"
if command -v convert >/dev/null 2>&1; then
  convert build/appicon.png -resize 512x512 "$ICON_DEST"
else
  install -m 0644 build/appicon.png "$ICON_DEST"
fi

# desktop entry
cat > "$STAGE/usr/share/applications/fokus.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Fokus
Comment=Minimalist, distraction-free fullscreen text editor
Exec=fokus %F
Icon=fokus
Terminal=false
Categories=Office;TextEditor;Utility;
MimeType=text/html;text/plain;
StartupNotify=true
EOF

# control file
INSTALLED_SIZE=$(du -ks "$STAGE/usr" | cut -f1)
cat > "$STAGE/DEBIAN/control" <<EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: editors
Priority: optional
Architecture: ${ARCH}
Depends: ${DEPENDS}
Maintainer: ${MAINTAINER}
Installed-Size: ${INSTALLED_SIZE}
Description: ${DESC_SHORT}
 Fokus is a lightweight, distraction-free fullscreen text editor.
 It launches into a frameless, black, centered writing canvas with a
 customizable serif editor, inspired by FocusWriter.
EOF

# 3. build the .deb
echo ">> Building ${DEB_OUT}…"
dpkg-deb --build --root-owner-group "$STAGE" "$DEB_OUT"

echo
echo ">> Done: ${DEB_OUT}"
echo "   Install with:  sudo apt install ./${DEB_OUT}"
echo "   Inspect with:  dpkg-deb --info ${DEB_OUT} && dpkg-deb --contents ${DEB_OUT}"
