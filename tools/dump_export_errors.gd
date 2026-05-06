extends SceneTree

# Manually replicates the checks EditorExportPlatformAndroid.has_valid_*()
# performs, since:
# 1. The validator's error strings are swallowed by editor_node.cpp:1259
#    and --verbose does not surface them.
# 2. EditorScript._run() does NOT auto-fire under `godot --script <path>` —
#    that hook only triggers from the editor's "Run" command. SceneTree-
#    based scripts DO auto-run their _init() in headless --script mode.
# 3. EditorExport / EditorExportPlatform classes are only registered when
#    EditorNode boots, so we cannot call has_valid_export_configuration()
#    directly from a SceneTree script — but we can replicate the file/path
#    checks it performs by reading the project state ourselves.
#
# Run with: godot --headless --path . --script res://tools/dump_export_errors.gd

func _init() -> void:
	print("=== DIAG: Manual Android export validation ===")
	_check_editor_settings()
	_check_android_template()
	_check_export_preset()
	_check_icons()
	_check_environment()
	print("=== DIAG: Done ===")
	quit()


func _check_editor_settings() -> void:
	var path: String = OS.get_environment("HOME") + "/.config/godot/editor_settings-4.5.tres"
	var exists: bool = FileAccess.file_exists(path)
	print("DIAG: editor_settings exists=", exists, " path=", path)
	if exists:
		var f := FileAccess.open(path, FileAccess.READ)
		if f != null:
			var content: String = f.get_as_text()
			f.close()
			print("DIAG: editor_settings content=", content.replace("\n", " | "))


func _check_android_template() -> void:
	# Godot's gradle-build mode validator looks for these markers in
	# res://android/build/. If any are missing, validation returns false
	# silently. version.txt specifically is the file the editor's
	# "Install Android Build Template" command writes alongside .gdignore.
	var paths := {
		"build.gradle": "res://android/build/build.gradle",
		"AndroidManifest.xml": "res://android/build/AndroidManifest.xml",
		"version.txt": "res://android/build/version.txt",
		".gdignore": "res://android/build/.gdignore",
		"gradlew": "res://android/build/gradlew",
		"config.gradle": "res://android/build/config.gradle",
	}
	for label in paths:
		print("DIAG_TPL: ", label, " exists=", FileAccess.file_exists(paths[label]))

	var dir := DirAccess.open("res://android/build")
	if dir != null:
		dir.list_dir_begin()
		var entries: Array[String] = []
		var name: String = dir.get_next()
		while name != "":
			entries.append(name)
			name = dir.get_next()
		entries.sort()
		print("DIAG_TPL: android/build entries (", entries.size(), "): ", entries)
	else:
		print("DIAG_TPL: android/build directory not openable via DirAccess")


func _check_export_preset() -> void:
	var cfg := ConfigFile.new()
	var err: int = cfg.load("res://export_presets.cfg")
	if err != OK:
		print("DIAG_ERR: failed to load export_presets.cfg err=", err)
		return
	var sec: String = "preset.0.options"
	var keys := [
		"gradle_build/use_gradle_build",
		"gradle_build/android_source_template",
		"gradle_build/gradle_build_directory",
		"gradle_build/min_sdk",
		"gradle_build/target_sdk",
		"package/signed",
		"package/unique_name",
		"keystore/release",
		"keystore/release_user",
		"launcher_icons/main_192x192",
		"launcher_icons/adaptive_foreground_432x432",
		"launcher_icons/adaptive_background_432x432",
		"script_export_mode",
		"architectures/arm64-v8a",
	]
	for key in keys:
		print("DIAG_PRESET: ", key, "=", cfg.get_value(sec, key, "<unset>"))


func _check_icons() -> void:
	var cfg := ConfigFile.new()
	if cfg.load("res://export_presets.cfg") != OK:
		return
	var sec: String = "preset.0.options"
	var icon_keys := [
		"launcher_icons/main_192x192",
		"launcher_icons/adaptive_foreground_432x432",
		"launcher_icons/adaptive_background_432x432",
	]
	for k in icon_keys:
		var path: String = cfg.get_value(sec, k, "")
		if path == "":
			print("DIAG_ICON: ", k, " <empty>")
			continue
		var exists: bool = FileAccess.file_exists(path)
		var size: int = -1
		if exists:
			var f := FileAccess.open(path, FileAccess.READ)
			if f != null:
				size = f.get_length()
				f.close()
		print("DIAG_ICON: ", k, " path=", path, " exists=", exists, " size=", size)


func _check_environment() -> void:
	print("DIAG_ENV: JAVA_HOME=", OS.get_environment("JAVA_HOME"))
	print("DIAG_ENV: ANDROID_HOME=", OS.get_environment("ANDROID_HOME"))
	var ks_path: String = OS.get_environment("GODOT_ANDROID_KEYSTORE_RELEASE_PATH")
	print("DIAG_ENV: KEYSTORE_PATH=", ks_path)
	print("DIAG_ENV: KEYSTORE_USER_set=", OS.has_environment("GODOT_ANDROID_KEYSTORE_RELEASE_USER"))
	print("DIAG_ENV: KEYSTORE_PASSWORD_set=", OS.has_environment("GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD"))
	# Critical: Godot's validator calls FileAccess::exists on the absolute
	# keystore path. If FileAccess can't see /home/runner/* (sandboxing,
	# permissions, weird path resolution), validation silently fails.
	if ks_path != "":
		print("DIAG_KS: FileAccess.file_exists(", ks_path, ")=", FileAccess.file_exists(ks_path))
	# Also test apksigner reachability (validator checks this too).
	var apksigner: String = OS.get_environment("ANDROID_HOME") + "/build-tools/34.0.0/apksigner"
	print("DIAG_KS: apksigner_path=", apksigner, " exists=", FileAccess.file_exists(apksigner))
	# Java bin/java
	var java_bin: String = OS.get_environment("JAVA_HOME") + "/bin/java"
	print("DIAG_KS: java_path=", java_bin, " exists=", FileAccess.file_exists(java_bin))
