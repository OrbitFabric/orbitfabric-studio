//! Bounded, read-only directory inventory. File presence is never semantic acceptance.
use serde::Serialize;
use std::{fs, path::{Path, PathBuf}};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceFile { name: String, path: String, status: String, reason: Option<String> }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceInventory { root: String, entries: Vec<SourceFile> }

fn root_path(root: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(root).canonicalize().map_err(|e| e.to_string())?;
    if !p.is_dir() { return Err("Source root is not a directory.".into()); }
    Ok(p)
}
fn contained_file(root: &Path, name: &str) -> Result<PathBuf, String> {
    if name.is_empty() || name.contains(['/', '\\', ':']) || name == "." || name == ".." {
        return Err("A direct child filename is required.".into());
    }
    let p = root.join(name);
    let meta = fs::symlink_metadata(&p).map_err(|e| e.to_string())?;
    if meta.file_type().is_symlink() || !meta.is_file() { return Err("Symlinks and non-regular files are excluded.".into()); }
    let resolved = p.canonicalize().map_err(|e| e.to_string())?;
    if resolved.parent() != Some(root) { return Err("File is outside the associated root.".into()); }
    Ok(resolved)
}
#[tauri::command]
pub fn scenario_source_root(selected_path: String, mission_dir: String) -> Result<Option<String>, String> {
    let selected = root_path(&selected_path)?;
    let mission = root_path(&mission_dir)?;
    // Only the workspace actually selected by the user authorizes this sibling.
    if selected == mission || mission.parent() != Some(selected.as_path()) { return Ok(None); }
    let candidate = selected.join("scenarios");
    if !candidate.exists() { return Ok(None); }
    if fs::symlink_metadata(&candidate).map_err(|e| e.to_string())?.file_type().is_symlink() {
        return Err("Scenario directory is a symlink; associate its intended root explicitly.".into());
    }
    let resolved = root_path(&candidate.to_string_lossy())?;
    if resolved.parent() != Some(selected.as_path()) { return Err("Scenario root escapes the selected workspace.".into()); }
    Ok(Some(resolved.to_string_lossy().into()))
}
#[tauri::command]
pub fn list_source_files(root: String, kind: String) -> Result<SourceInventory, String> {
    if !["scenario", "result", "evidence"].contains(&kind.as_str()) { return Err("Unsupported source lane.".into()); }
    let root = root_path(&root)?;
    let mut entries = Vec::new();
    for item in fs::read_dir(&root).map_err(|e| e.to_string())? {
        let item = item.map_err(|e| e.to_string())?;
        let name = item.file_name().into_string().map_err(|_| "Non-UTF-8 filename in source root.")?;
        let ext = Path::new(&name).extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
        if !(if kind == "scenario" { ext == "yaml" || ext == "yml" } else { ext == "json" }) { continue; }
        if entries.len() >= 500 { return Err("Source root exceeds 500 candidates; associate a narrower directory.".into()); }
        let check = contained_file(&root, &name).and_then(|p| fs::File::open(&p).map(|_| p).map_err(|e| e.to_string()));
        entries.push(SourceFile { path: root.join(&name).to_string_lossy().into(), name,
            status: if check.is_ok() { "available" } else { "unavailable" }.into(), reason: check.err() });
    }
    entries.sort_by(|a,b| a.name.cmp(&b.name));
    Ok(SourceInventory { root: root.to_string_lossy().into(), entries })
}
#[tauri::command]
pub fn resolve_source_file(root: String, name: String) -> Result<String, String> {
    Ok(contained_file(&root_path(&root)?, &name)?.to_string_lossy().into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_roots_and_deleted_candidates_fail_without_content_inference() {
        let root = std::env::temp_dir().join(format!("of-inventory-stale-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let canonical = root.canonicalize().unwrap();
        fs::write(root.join("bad.json"), "not a result or evidence manifest").unwrap();
        let found = list_source_files(root.to_string_lossy().into(), "result".into()).unwrap();
        assert_eq!(found.entries.len(), 1);
        assert_eq!(found.entries[0].status, "available"); // Presence only, not validated.
        fs::remove_file(root.join("bad.json")).unwrap();
        assert!(contained_file(&canonical, "bad.json").is_err());
        assert!(list_source_files(root.to_string_lossy().into(), "execution".into()).is_err());
        fs::remove_dir_all(&root).unwrap();
        assert!(list_source_files(root.to_string_lossy().into(), "result".into()).is_err());
    }
    #[test]
    fn scenario_sibling_requires_explicit_workspace_ancestry() {
        let root = std::env::temp_dir().join(format!("of-inventory-scope-{}", std::process::id()));
        fs::create_dir_all(root.join("mission")).unwrap();
        fs::create_dir_all(root.join("scenarios")).unwrap();
        let workspace = root.to_string_lossy().to_string();
        let mission = root.join("mission").to_string_lossy().to_string();
        assert!(scenario_source_root(mission.clone(), mission.clone()).unwrap().is_none());
        assert!(scenario_source_root(workspace, mission).unwrap().is_some());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn rejects_traversal_and_preserves_unreadable_candidates() {
        let root = std::env::temp_dir().join(format!("of-inventory-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("candidate.yaml"), "not validated").unwrap();
        fs::create_dir_all(root.join("directory.yaml")).unwrap();
        for name in ["../outside", "a/b", "a\\b", "", ".", "..", "C:foo"] {
            assert!(contained_file(&root, name).is_err());
        }
        let found = list_source_files(root.to_string_lossy().into(), "scenario".into()).unwrap();
        assert_eq!(found.entries.len(), 2);
        assert_eq!(found.entries[0].status, "available");
        assert_eq!(found.entries[1].status, "unavailable");
        #[cfg(unix)] {
            std::os::unix::fs::symlink(root.join("candidate.yaml"), root.join("link.yaml")).unwrap();
            assert!(contained_file(&root, "link.yaml").is_err());
        }
        fs::remove_dir_all(root).unwrap();
    }
}
