#!/usr/bin/env bash
# Runs once after the dev container is created.
# Sets up Godot export templates symlink, Python venv for Phase 0 scripts,
# and prints next-step instructions for the user.

set -euo pipefail

GODOT_VERSION="${GODOT_VERSION:-4.5-stable}"

echo "==> Linking Godot export templates..."
TEMPLATE_DIR="$HOME/.local/share/godot/export_templates/${GODOT_VERSION}"
mkdir -p "$(dirname "$TEMPLATE_DIR")"
if [ ! -d "$TEMPLATE_DIR" ]; then
    ln -sf /opt/godot-templates/templates "$TEMPLATE_DIR"
fi

echo "==> Setting up Python venv for Phase 0 corpus analysis..."
if [ ! -d /workspaces/shabd/.venv ]; then
    python3 -m venv /workspaces/shabd/.venv
    /workspaces/shabd/.venv/bin/pip install --quiet --upgrade pip
    /workspaces/shabd/.venv/bin/pip install --quiet regex
fi

echo "==> Verifying installs..."
echo "  Godot: $(godot --version 2>&1 | head -1)"
echo "  Java: $(java --version 2>&1 | head -1)"
echo "  Android SDK: $ANDROID_HOME"
echo "  Python: $(python3 --version)"
echo "  regex: $(/workspaces/shabd/.venv/bin/python3 -c 'import regex; print(regex.__version__)' 2>/dev/null || echo 'not installed')"

cat <<'EOF'

==============================================================
  Shabd dev container ready.

  Open the Godot Editor (GUI) in your browser:
    Click the "Godot Editor (noVNC)" port in the Codespaces
    Ports panel, OR navigate to http://localhost:6080/vnc.html

  Open a terminal in the container and run:
    cd /workspaces/shabd
    godot --editor --path .         # opens Godot Editor in noVNC

  Build an Android AAB (headless, no GUI needed):
    godot --headless --export-release "Android" build/shabd.aab

  Run Phase 0 corpus analysis:
    .venv/bin/python3 scripts/phase0_corpus_analysis.py --help

  See docs/cloud-dev-setup.md for full workflow.
==============================================================
EOF
