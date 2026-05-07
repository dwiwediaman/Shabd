extends Node
## AppMeta — surfaces the Android build code at runtime so testers can
## report "I'm on build N" without digging into Play Store about-app.
##
## Keep BUILD_CODE in sync with `version/code` in export_presets.cfg.
## Bumped each release; never re-uses a value (Play Console rule).

const BUILD_CODE: int = 8
