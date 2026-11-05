mod adapter_lifecycle;
mod capture;
mod source_inventory;
mod integration_execution;
mod integration_files;
mod integrations;

use serde::Serialize;
use std::env;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const CORE_VERSION_TIMEOUT: Duration = Duration::from_secs(10);
const CORE_OPERATION_TIMEOUT: Duration = Duration::from_secs(60);
const CORE_POLL_INTERVAL: Duration = Duration::from_millis(25);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MissionSourceResolution {
    selected_path: String,
    mission_dir: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResolvedCoreExecutable {
    configured_executable: String,
    resolved_executable: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CoreInvocationResult {
    operation: String,
    executable: String,
    args: Vec<String>,
    exit_code: Option<i32>,
    process_completed: bool,
    timed_out: bool,
    stdout: String,
    stderr: String,
    report_path: Option<String>,
    report_text: Option<String>,
}

/// Resolve the user's directory selection to the candidate Mission Model directory.
///
/// This command deliberately performs no OrbitFabric semantic inspection. It recognizes
/// only the conventional `<workspace>/mission` directory shape; Core remains the authority
/// on whether the resulting directory is a loadable Mission Model.
#[tauri::command]
fn resolve_mission_source(path: String) -> Result<MissionSourceResolution, String> {
    let selected = canonicalize_existing_dir(&path)?;

    let mission = if selected
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value == "mission")
    {
        selected.clone()
    } else {
        let child = selected.join("mission");
        if child.is_dir() {
            child
                .canonicalize()
                .map_err(|error| format!("Unable to resolve mission directory: {error}"))?
        } else {
            selected.clone()
        }
    };

    Ok(MissionSourceResolution {
        selected_path: display_path(&selected),
        mission_dir: display_path(&mission),
    })
}
#[tauri::command]
fn resolve_core_executable(
    configured_executable: String,
) -> Result<ResolvedCoreExecutable, String> {
    let configured = configured_executable.trim();
    if configured.is_empty() {
        return Err("OrbitFabric executable configuration is empty.".to_string());
    }

    let resolved = resolve_core_executable_path(configured)?;
    Ok(ResolvedCoreExecutable {
        configured_executable: configured.to_string(),
        resolved_executable: display_path(&resolved),
    })
}

#[tauri::command]
fn run_core_version(executable: String) -> Result<CoreInvocationResult, String> {
    run_core_command(executable, "version", &["--version"], None)
}
#[tauri::command]
fn run_core_interface_manifest(
    executable: String,
    request_id: String,
) -> Result<CoreInvocationResult, String> {
    let report_path = request_report_path(&request_id, "core_interface.json", true)?;
    let report_display = display_path(&report_path);

    run_core_command(
        executable,
        "core-interface",
        &["export", "core-interface", "--json", report_display.as_str()],
        Some(report_path),
    )
}

#[tauri::command]
fn run_core_export_mission_snapshot(
    executable: String,
    mission_dir: String,
    request_id: String,
) -> Result<CoreInvocationResult, String> {
    let mission = canonicalize_existing_dir(&mission_dir)?;
    let report_path = request_report_path(&request_id, "mission_snapshot.json", true)?;
    let mission_display = display_path(&mission);
    let report_display = display_path(&report_path);

    run_core_command(
        executable,
        "mission-snapshot",
        &[
            "export",
            "mission-snapshot",
            mission_display.as_str(),
            "--json",
            report_display.as_str(),
        ],
        Some(report_path),
    )
}

#[tauri::command]
fn run_core_export_entity_index(
    executable: String,
    mission_dir: String,
    request_id: String,
) -> Result<CoreInvocationResult, String> {
    let mission = canonicalize_existing_dir(&mission_dir)?;
    let report_path = request_report_path(&request_id, "entity_index.json", false)?;
    let mission_display = display_path(&mission);
    let report_display = display_path(&report_path);

    run_core_command(
        executable,
        "entity-index",
        &[
            "export",
            "entity-index",
            mission_display.as_str(),
            "--json",
            report_display.as_str(),
        ],
        Some(report_path),
    )
}

#[tauri::command]
fn run_core_export_relationship_manifest(
    executable: String,
    mission_dir: String,
    request_id: String,
) -> Result<CoreInvocationResult, String> {
    let mission = canonicalize_existing_dir(&mission_dir)?;
    let report_path = request_report_path(&request_id, "relationship_manifest.json", false)?;
    let mission_display = display_path(&mission);
    let report_display = display_path(&report_path);

    run_core_command(
        executable,
        "relationship-manifest",
        &[
            "export",
            "relationship-manifest",
            mission_display.as_str(),
            "--json",
            report_display.as_str(),
        ],
        Some(report_path),
    )
}

#[tauri::command]
fn run_core_lint_mission(
    executable: String,
    mission_dir: String,
    request_id: String,
) -> Result<CoreInvocationResult, String> {
    let mission = canonicalize_existing_dir(&mission_dir)?;
    let report_path = request_report_path(&request_id, "lint_report.json", false)?;
    let mission_display = display_path(&mission);
    let report_display = display_path(&report_path);

    run_core_command(
        executable,
        "lint",
        &[
            "lint",
            mission_display.as_str(),
            "--json",
            report_display.as_str(),
        ],
        Some(report_path),
    )
}

#[tauri::command]
fn run_core_export_scenario_declaration(
    executable: String,
    scenario_path: String,
    request_id: String,
) -> Result<CoreInvocationResult, String> {
    let scenario = canonicalize_existing_file(&scenario_path)?;
    let report_path = request_report_path(&request_id, "scenario_declaration.json", true)?;
    let scenario_display = display_path(&scenario);
    let report_display = display_path(&report_path);

    run_core_command(
        executable,
        "scenario-declaration",
        &[
            "export",
            "scenario-declaration",
            scenario_display.as_str(),
            "--json",
            report_display.as_str(),
        ],
        Some(report_path),
    )
}

#[tauri::command]
fn run_core_export_integration_input_set(
    executable: String,
    mission_dir: String,
    request_id: String,
) -> Result<CoreInvocationResult, String> {
    let mission = canonicalize_existing_dir(&mission_dir)?;
    let request_dir = core_request_temp_dir(&request_id);
    if request_dir.exists() {
        fs::remove_dir_all(&request_dir)
            .map_err(|error| format!("Unable to reset Studio integration input request: {error}"))?;
    }
    let output_dir = request_dir.join("integration_input");
    fs::create_dir_all(&output_dir)
        .map_err(|error| format!("Unable to create Studio integration input directory: {error}"))?;

    let report_path = output_dir.join("integration_input_manifest.json");
    let mission_display = display_path(&mission);
    let output_display = display_path(&output_dir);

    run_core_command(
        executable,
        "integration-input-set",
        &[
            "export",
            "integration-input-set",
            mission_display.as_str(),
            "--output-dir",
            output_display.as_str(),
        ],
        Some(report_path),
    )
}

#[tauri::command]
fn clear_core_request_temp(request_id: String) -> Result<(), String> {
    let request_dir = core_request_temp_dir(&request_id);

    if request_dir.exists() {
        fs::remove_dir_all(&request_dir)
            .map_err(|error| format!("Unable to clear Studio Core request directory: {error}"))?;
    }

    Ok(())
}

fn resolve_core_executable_path(configured: &str) -> Result<PathBuf, String> {
    let configured_path = Path::new(configured);
    if configured_path.is_absolute() || configured.contains('/') || configured.contains('\\') {
        return canonicalize_executable(configured_path);
    }

    let path_value = env::var_os("PATH")
        .ok_or_else(|| "PATH is unavailable while resolving OrbitFabric Core.".to_string())?;
    for directory in env::split_paths(&path_value) {
        for candidate in executable_candidates(&directory, configured) {
            if candidate.is_file() {
                return canonicalize_executable(&candidate);
            }
        }
    }

    Err(format!(
        "OrbitFabric executable '{configured}' was not found on PATH."
    ))
}

fn canonicalize_executable(path: &Path) -> Result<PathBuf, String> {
    if !path.is_file() {
        return Err(format!(
            "OrbitFabric executable is not an existing file: {}",
            display_path(path)
        ));
    }

    path.canonicalize().map_err(|error| {
        format!(
            "Unable to resolve OrbitFabric executable {}: {error}",
            display_path(path)
        )
    })
}

fn executable_candidates(directory: &Path, configured: &str) -> Vec<PathBuf> {
    let direct = directory.join(configured);
    #[cfg(not(windows))]
    {
        vec![direct]
    }
    #[cfg(windows)]
    {
        if Path::new(configured).extension().is_some() {
            return vec![direct];
        }
        let extensions = env::var_os("PATHEXT")
            .and_then(|value| value.into_string().ok())
            .unwrap_or_else(|| ".COM;.EXE;.BAT;.CMD".to_string());
        let mut candidates = vec![direct];
        candidates.extend(
            extensions
                .split(';')
                .filter(|extension| !extension.is_empty())
                .map(|extension| directory.join(format!("{configured}{extension}"))),
        );
        candidates
    }
}
fn run_core_command(
    executable: String,
    operation: &str,
    args: &[&str],
    report_path: Option<PathBuf>,
) -> Result<CoreInvocationResult, String> {
    run_core_command_with_timeout(
        executable,
        operation,
        args,
        report_path,
        core_timeout_for_operation(operation),
    )
}

fn run_core_command_with_timeout(
    executable: String,
    operation: &str,
    args: &[&str],
    report_path: Option<PathBuf>,
    timeout: Duration,
) -> Result<CoreInvocationResult, String> {
    let command = executable.trim();

    if command.is_empty() {
        return Err("OrbitFabric executable path is empty.".to_string());
    }

    let mut child = Command::new(command)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to execute OrbitFabric Core command: {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Unable to capture OrbitFabric Core stdout.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Unable to capture OrbitFabric Core stderr.".to_string())?;

    let stdout_reader = thread::spawn(move || read_stream(stdout));
    let stderr_reader = thread::spawn(move || read_stream(stderr));

    let started = Instant::now();
    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() >= timeout => {
                timed_out = true;
                let _ = child.kill();
                break child
                    .wait()
                    .map_err(|error| format!("Unable to reap timed-out OrbitFabric Core process: {error}"))?;
            }
            Ok(None) => thread::sleep(CORE_POLL_INTERVAL),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = stdout_reader.join();
                let _ = stderr_reader.join();
                return Err(format!("Unable to poll OrbitFabric Core process: {error}"));
            }
        }
    };

    let stdout_bytes = stdout_reader
        .join()
        .map_err(|_| "OrbitFabric Core stdout reader thread failed.".to_string())??;
    let stderr_bytes = stderr_reader
        .join()
        .map_err(|_| "OrbitFabric Core stderr reader thread failed.".to_string())??;

    let report_text = match &report_path {
        Some(path) if path.is_file() => fs::read_to_string(path).ok(),
        _ => None,
    };

    Ok(CoreInvocationResult {
        operation: operation.to_string(),
        executable: command.to_string(),
        args: args.iter().map(|arg| (*arg).to_string()).collect(),
        exit_code: status.code(),
        process_completed: !timed_out,
        timed_out,
        stdout: String::from_utf8_lossy(&stdout_bytes).to_string(),
        stderr: String::from_utf8_lossy(&stderr_bytes).to_string(),
        report_path: report_path.as_ref().map(|path| display_path(path)),
        report_text,
    })
}

fn read_stream<R: Read>(mut stream: R) -> Result<Vec<u8>, String> {
    let mut buffer = Vec::new();
    stream
        .read_to_end(&mut buffer)
        .map_err(|error| format!("Unable to read OrbitFabric Core process output: {error}"))?;
    Ok(buffer)
}

fn core_timeout_for_operation(operation: &str) -> Duration {
    if matches!(operation, "version" | "core-interface") {
        CORE_VERSION_TIMEOUT
    } else {
        CORE_OPERATION_TIMEOUT
    }
}

fn request_report_path(
    request_id: &str,
    file_name: &str,
    reset_request_dir: bool,
) -> Result<PathBuf, String> {
    let request_dir = core_request_temp_dir(request_id);

    if reset_request_dir && request_dir.exists() {
        fs::remove_dir_all(&request_dir)
            .map_err(|error| format!("Unable to reset Studio Core request directory: {error}"))?;
    }

    fs::create_dir_all(&request_dir)
        .map_err(|error| format!("Unable to create Studio Core request directory: {error}"))?;

    Ok(request_dir.join(file_name))
}

fn core_request_temp_dir(request_id: &str) -> PathBuf {
    env::temp_dir()
        .join("orbitfabric-studio")
        .join("core")
        .join(std::process::id().to_string())
        .join(sanitize_request_id(request_id))
}

fn sanitize_request_id(request_id: &str) -> String {
    let sanitized: String = request_id
        .chars()
        .filter_map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                Some(character)
            } else {
                None
            }
        })
        .take(96)
        .collect();

    if sanitized.is_empty() {
        "request".to_string()
    } else {
        sanitized
    }
}

fn canonicalize_existing_dir(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);

    if !candidate.is_dir() {
        return Err("Selected path is not an existing directory.".to_string());
    }

    candidate
        .canonicalize()
        .map_err(|error| format!("Unable to resolve selected directory: {error}"))
}

fn canonicalize_existing_file(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);

    if !candidate.is_file() {
        return Err("Selected path is not an existing file.".to_string());
    }

    candidate
        .canonicalize()
        .map_err(|error| format!("Unable to resolve selected file: {error}"))
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explicit_core_executable_resolves_to_canonical_file() {
        let current = env::current_exe().expect("current test executable");
        let resolved = resolve_core_executable(display_path(&current))
            .expect("explicit executable should resolve");
        assert_eq!(
            PathBuf::from(resolved.resolved_executable),
            current.canonicalize().unwrap()
        );
    }

    #[test]
    fn nonexistent_core_executable_fails_resolution() {
        let error = resolve_core_executable(
            "orbitfabric-studio-h4-nonexistent-executable".to_string(),
        )
        .expect_err("missing bare command must fail");
        assert!(error.contains("was not found on PATH"));
    }

    #[test]
    #[ignore = "requires exact historical/current Core; explicitly run by H4 CI"]
    fn h4_core_interface_acceptance() {
        let historical_configured = env::var("ORBITFABRIC_STUDIO_H4_HISTORICAL_CORE")
            .expect("historical Core executable required");
        let current_configured = env::var("ORBITFABRIC_STUDIO_H4_CURRENT_CORE")
            .expect("current Core executable required");
        let output = PathBuf::from(
            env::var("ORBITFABRIC_STUDIO_H4_OUTPUT").expect("H4 output directory required"),
        );
        fs::create_dir_all(&output).expect("H4 output directory");

        let historical = resolve_core_executable(historical_configured)
            .expect("historical executable resolution");
        let current = resolve_core_executable(current_configured)
            .expect("current executable resolution");
        let bare = resolve_core_executable("orbitfabric".to_string())
            .expect("bare PATH command resolution");
        assert_eq!(bare.resolved_executable, current.resolved_executable);

        let historical_version = run_core_version(historical.resolved_executable.clone())
            .expect("historical version invocation");
        let current_version = run_core_version(current.resolved_executable.clone())
            .expect("current version invocation");
        assert_eq!(historical_version.stdout.trim(), "orbitfabric 1.3.0");
        assert_eq!(current_version.stdout.trim(), "orbitfabric 1.3.0");

        let historical_interface = run_core_interface_manifest(
            historical.resolved_executable.clone(),
            "h4-historical".to_string(),
        )
        .expect("historical interface invocation transport");
        assert_ne!(historical_interface.exit_code, Some(0));
        assert!(historical_interface.report_text.is_none());

        let current_interface = run_core_interface_manifest(
            current.resolved_executable.clone(),
            "h4-current".to_string(),
        )
        .expect("current interface invocation");
        assert_eq!(current_interface.exit_code, Some(0));
        let manifest: serde_json::Value = serde_json::from_str(
            current_interface.report_text.as_ref().expect("current manifest"),
        )
        .expect("valid current manifest JSON");
        assert_eq!(manifest["kind"], "orbitfabric.core_interface");
        assert_eq!(manifest["interface_version"], "0.1-candidate");
        assert_eq!(manifest["orbitfabric_version"], "1.3.0");
        assert!(manifest["capabilities"].as_array().unwrap().iter().any(|item| {
            item["id"] == "scenario_declaration"
                && item["contract_kind"] == "orbitfabric.scenario_declaration"
                && item["contract_version"] == "0.1-candidate"
        }));

        let evidence = serde_json::json!({
            "historical": {
                "resolution": historical,
                "version": historical_version,
                "interface": historical_interface,
            },
            "current": {
                "resolution": current,
                "bareResolution": bare,
                "version": current_version,
                "interface": current_interface,
            },
        });
        fs::write(
            output.join("core-compatibility.json"),
            serde_json::to_vec_pretty(&evidence).unwrap(),
        )
        .expect("write H4 evidence");
        clear_core_request_temp("h4-historical".to_string()).unwrap();
        clear_core_request_temp("h4-current".to_string()).unwrap();
    }
    #[test]
    #[ignore = "requires pinned Core and Reference Mission; explicitly run by SP2 CI"]
    fn scenario_r1_acceptance_through_native_command() {
        let executable = env::var("ORBITFABRIC_STUDIO_R1_CORE").expect("R1 Core executable required");
        let source = env::var("ORBITFABRIC_STUDIO_R1_SCENARIO").expect("R1 Scenario path required");
        let output = PathBuf::from(env::var("ORBITFABRIC_STUDIO_R1_OUTPUT").expect("R1 output required"));
        fs::create_dir_all(&output).expect("acceptance output directory");
        let request_id = format!("sp2-r1-{}", std::process::id());
        let invocation = run_core_export_scenario_declaration(executable.clone(), source.clone(), request_id.clone())
            .expect("native Scenario command");
        assert!(invocation.process_completed);
        assert!(!invocation.timed_out);
        assert_eq!(invocation.exit_code, Some(0));
        let report: serde_json::Value = serde_json::from_str(invocation.report_text.as_ref().expect("report text")).unwrap();
        assert_eq!(report["result"], "loaded");
        assert_eq!(report["atom_count"], 8);
        assert_eq!(report["source"]["scenario_sha256"], "b19ff6e1cf3c45cdb81e239d30aad97e8b6f037703c06f27102b762e69a1146a");
        assert_eq!(report["atoms"][3]["references"][0]["entity"]["domain"], "commands");
        assert_eq!(report["atoms"][5]["references"][0]["entity"]["domain"], "telemetry");
        fs::write(output.join("native-loaded.json"), serde_json::to_vec_pretty(&invocation).unwrap()).unwrap();

        // A real Core-declared failure must still cross the native command boundary
        // as a structured report. This fixture mutation belongs only to the test.
        let scenario = PathBuf::from(source);
        let mission = scenario.parent().unwrap().parent().unwrap().join("mission").canonicalize().unwrap();
        let invalid_source = fs::read_to_string(&scenario).unwrap()
            .replace("path: ../mission", &format!("path: {}", serde_json::to_string(&display_path(&mission)).unwrap()))
            .replace("command: payload.stop_acquisition", "command: payload.nonexistent_sp2_fixture");
        let invalid_path = output.join("invalid-scenario.yaml");
        fs::write(&invalid_path, invalid_source).unwrap();
        let failed = run_core_export_scenario_declaration(executable, display_path(&invalid_path), request_id.clone()).unwrap();
        assert!(failed.process_completed);
        assert_ne!(failed.exit_code, Some(0));
        let failed_report: serde_json::Value = serde_json::from_str(failed.report_text.as_ref().expect("structured failure")).unwrap();
        assert_eq!(failed_report["result"], "failed");
        assert!(failed_report["atoms"].is_null());
        assert!(failed_report["scenario"].is_null());
        assert!(!failed_report["diagnostics"].as_array().unwrap().is_empty());
        fs::write(output.join("native-failed.json"), serde_json::to_vec_pretty(&failed).unwrap()).unwrap();
        clear_core_request_temp(request_id).unwrap();
    }

    #[test]
    fn sanitize_request_id_keeps_only_safe_characters() {
        assert_eq!(sanitize_request_id("abc DEF/../123_-"), "abcDEF123_-");
        assert_eq!(sanitize_request_id("///"), "request");
    }

    #[test]
    fn clear_request_temp_removes_the_whole_request_directory() {
        let request_id = "rust-cleanup-test";
        let report = request_report_path(request_id, "report.json", true)
            .expect("request temp directory should be created");
        fs::write(&report, b"{}")
            .expect("test report should be writable");

        let request_dir = core_request_temp_dir(request_id);
        assert!(request_dir.is_dir());
        assert!(report.is_file());

        clear_core_request_temp(request_id.to_string())
            .expect("request temp directory should be removable");

        assert!(!request_dir.exists());
    }

    #[cfg(unix)]
    #[test]
    fn core_command_completes_before_timeout() {
        let result = run_core_command_with_timeout(
            "/bin/sh".to_string(),
            "test",
            &["-c", "printf 'ok'"],
            None,
            Duration::from_secs(1),
        )
        .expect("test command should run");

        assert!(result.process_completed);
        assert!(!result.timed_out);
        assert_eq!(result.exit_code, Some(0));
        assert_eq!(result.stdout, "ok");
    }

    #[cfg(unix)]
    #[test]
    fn core_command_is_killed_after_timeout() {
        let result = run_core_command_with_timeout(
            "/bin/sh".to_string(),
            "test",
            &["-c", "sleep 2"],
            None,
            Duration::from_millis(75),
        )
        .expect("timed-out command should return a transport result");

        assert!(!result.process_completed);
        assert!(result.timed_out);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            resolve_mission_source,
            resolve_core_executable,
            run_core_version,
            run_core_interface_manifest,
            run_core_export_mission_snapshot,
            run_core_export_entity_index,
            run_core_export_relationship_manifest,
            run_core_lint_mission,
            run_core_export_scenario_declaration,
            run_core_export_integration_input_set,
            adapter_lifecycle::run_core_adapter_list,
            adapter_lifecycle::run_core_adapter_verify,
            adapter_lifecycle::run_core_adapter_lock_check,
            adapter_lifecycle::run_core_adapter_catalog_select,
            clear_core_request_temp,
            integrations::read_integration_package_manifest,
            integrations::read_integration_result_bundle,
            integration_files::read_integration_text_file,
            source_inventory::scenario_source_root,
            source_inventory::list_source_files,
            source_inventory::resolve_source_file,
            integration_files::read_retained_reference,
            integration_execution::run_integration_adapter,
            capture::save_surface_capture_png,
        ])
        .run(tauri::generate_context!())
        .expect("error while running OrbitFabric Studio");
}
