@tool
extends EditorScript

# Dumps the actual validation errors EditorExportPlatformAndroid.has_valid_*()
# pushes onto its error arrays. The editor's own _fs_changed swallows them
# (editor_node.cpp:1259) and --verbose does not surface them; this is the
# only known way to see what's actually wrong with the preset in CI.
#
# Run with: godot --headless --editor --quit-after 2 \
#               --path . --script res://tools/dump_export_errors.gd

func _run() -> void:
	var preset_name := "Android"
	if not Engine.has_singleton("EditorExport"):
		push_error("EditorExport singleton missing - script must run with --editor flag.")
		return
	var ee := Engine.get_singleton("EditorExport")
	var preset: EditorExportPreset = null
	for i in ee.get_export_preset_count():
		var p := ee.get_export_preset(i)
		if p.get_name() == preset_name:
			preset = p
			break
	if preset == null:
		push_error("DIAG: preset not found: " + preset_name)
		return

	var platform := preset.get_platform()
	print("DIAG: preset=", preset_name, " platform=", platform.get_class())

	var cfg_errors: Array[String] = []
	var proj_errors: Array[String] = []
	var ok_cfg := platform.has_valid_export_configuration(preset, cfg_errors)
	var ok_proj := platform.has_valid_project_configuration(preset, proj_errors)

	print("DIAG: has_valid_export_configuration=", ok_cfg, " errors=", cfg_errors.size())
	for e in cfg_errors:
		print("DIAG_EXPORT_ERR: ", e)
	print("DIAG: has_valid_project_configuration=", ok_proj, " errors=", proj_errors.size())
	for e in proj_errors:
		print("DIAG_PROJECT_ERR: ", e)

	print("DIAG_ENV: KEYSTORE_PATH=", OS.get_environment("GODOT_ANDROID_KEYSTORE_RELEASE_PATH"))
	print("DIAG_ENV: USER_set=", OS.has_environment("GODOT_ANDROID_KEYSTORE_RELEASE_USER"))
	print("DIAG_ENV: PASSWORD_set=", OS.has_environment("GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD"))
	print("DIAG_PRESET: keystore_release=", preset.get("keystore/release"),
		" signed=", preset.get("package/signed"),
		" use_gradle_build=", preset.get("gradle_build/use_gradle_build"))
