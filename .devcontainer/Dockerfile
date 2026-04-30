# Shabd Godot Dev Container — cloud-first development environment
#
# Provides:
# - Godot 4.5 (headless + GUI via noVNC at http://localhost:6080)
# - JDK 17 (required by Godot 4 Android export)
# - Android SDK command-line tools + platform-tools (adb)
# - Python 3.11 with the `regex` package (for Phase 0 corpus analysis)
# - GDScript Language Server (port 6005, used by VS Code godot-tools extension)
#
# Use case: GitHub Codespaces / VS Code Remote-Containers / local Docker.
# Open the forwarded port 6080 in a browser to interact with the Godot Editor.

FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

ARG GODOT_VERSION=4.5-stable
ARG ANDROID_CMDLINE_TOOLS_VERSION=11076708
ARG ANDROID_PLATFORM=android-34
ARG ANDROID_BUILD_TOOLS=34.0.0

ENV DEBIAN_FRONTEND=noninteractive \
    LC_ALL=C.UTF-8 \
    LANG=C.UTF-8

# System deps: X server, VNC, noVNC, JDK, build tools, fonts (incl. Devanagari)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk-headless \
    xvfb x11vnc novnc websockify supervisor \
    xfce4 xfce4-terminal dbus-x11 \
    fonts-noto-core fonts-noto-color-emoji fonts-indic \
    libfontconfig1 libxcursor1 libxinerama1 libxrandr2 libxi6 libgl1 libxss1 \
    unzip wget curl ca-certificates \
    python3-pip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Godot 4.5 (Linux x86_64 standard build with editor)
RUN GODOT_ZIP="Godot_v${GODOT_VERSION}_linux.x86_64.zip" \
    && wget -q "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/${GODOT_ZIP}" -O /tmp/godot.zip \
    && unzip -q /tmp/godot.zip -d /tmp \
    && mv /tmp/Godot_v${GODOT_VERSION}_linux.x86_64 /usr/local/bin/godot \
    && chmod +x /usr/local/bin/godot \
    && rm /tmp/godot.zip

# Godot Android export templates (downloaded once, cached in volume)
RUN mkdir -p /opt/godot-templates \
    && wget -q "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/Godot_v${GODOT_VERSION}_export_templates.tpz" -O /tmp/templates.tpz \
    && unzip -q /tmp/templates.tpz -d /opt/godot-templates \
    && rm /tmp/templates.tpz

# Android SDK
ENV ANDROID_HOME=/opt/android-sdk \
    PATH=$PATH:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools

RUN mkdir -p $ANDROID_HOME/cmdline-tools \
    && wget -q "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip" -O /tmp/cmdline-tools.zip \
    && unzip -q /tmp/cmdline-tools.zip -d /tmp \
    && mv /tmp/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
    && rm /tmp/cmdline-tools.zip \
    && yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses > /dev/null \
    && $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager \
        "platform-tools" \
        "platforms;${ANDROID_PLATFORM}" \
        "build-tools;${ANDROID_BUILD_TOOLS}" \
        > /dev/null \
    && chown -R vscode:vscode $ANDROID_HOME

# noVNC at /usr/share/novnc with index.html shortcut
RUN ln -s /usr/share/novnc/vnc.html /usr/share/novnc/index.html

# Python deps for Phase 0 corpus analysis
RUN pip3 install --no-cache-dir regex==2026.4.4

# Supervisor config: runs Xvfb + x11vnc + xfce4 + websockify (noVNC bridge)
COPY supervisord.conf /etc/supervisor/conf.d/godot-dev.conf

USER vscode
WORKDIR /workspaces

# Default command: start supervisor (X + VNC + noVNC + xfce). The Godot
# editor is launched on demand by the user inside the xfce session.
CMD ["sudo", "/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/godot-dev.conf", "-n"]
