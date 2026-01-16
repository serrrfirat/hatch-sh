use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

/// Result from skill installation
#[derive(Serialize, Deserialize)]
pub struct SkillInstallResult {
    pub success: bool,
    pub message: String,
    pub path: Option<String>,
}

/// Skill file to be written
#[derive(Serialize, Deserialize, Clone)]
pub struct SkillFile {
    pub name: String,
    pub content: String,
}

/// Get the skills directory path
fn get_skills_dir(is_global: bool, working_directory: Option<String>) -> Result<PathBuf, String> {
    if is_global {
        // Global: ~/.claude/skills/
        let home = dirs::home_dir().ok_or("Could not determine home directory")?;
        Ok(home.join(".claude").join("skills"))
    } else {
        // Local: .claude/skills/ relative to working directory or current dir
        let base = if let Some(dir) = working_directory {
            PathBuf::from(dir)
        } else {
            std::env::current_dir().map_err(|e| format!("Failed to get current directory: {}", e))?
        };
        Ok(base.join(".claude").join("skills"))
    }
}

/// Install a skill by writing files to the skills directory
#[tauri::command]
pub async fn install_skill(
    skill_name: String,
    files: Vec<SkillFile>,
    is_global: bool,
    working_directory: Option<String>,
) -> SkillInstallResult {
    // Get the target directory
    let base_dir = match get_skills_dir(is_global, working_directory) {
        Ok(dir) => dir,
        Err(e) => {
            return SkillInstallResult {
                success: false,
                message: format!("Failed to determine skills directory: {}", e),
                path: None,
            };
        }
    };

    let skill_dir = base_dir.join(&skill_name);

    // Create the directory structure
    if let Err(e) = std::fs::create_dir_all(&skill_dir) {
        return SkillInstallResult {
            success: false,
            message: format!("Failed to create skill directory: {}", e),
            path: None,
        };
    }

    // Write all files
    for file in files {
        let file_path = skill_dir.join(&file.name);

        // Create parent directories if needed (for nested files)
        if let Some(parent) = file_path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                return SkillInstallResult {
                    success: false,
                    message: format!("Failed to create directory for {}: {}", file.name, e),
                    path: None,
                };
            }
        }

        if let Err(e) = std::fs::write(&file_path, &file.content) {
            return SkillInstallResult {
                success: false,
                message: format!("Failed to write {}: {}", file.name, e),
                path: None,
            };
        }
    }

    let installed_path = skill_dir.to_string_lossy().to_string();

    SkillInstallResult {
        success: true,
        message: format!("Successfully installed {} skill", skill_name),
        path: Some(installed_path),
    }
}

/// Uninstall a skill by removing its directory
#[tauri::command]
pub async fn uninstall_skill(
    skill_name: String,
    is_global: bool,
    working_directory: Option<String>,
) -> SkillInstallResult {
    let base_dir = match get_skills_dir(is_global, working_directory) {
        Ok(dir) => dir,
        Err(e) => {
            return SkillInstallResult {
                success: false,
                message: format!("Failed to determine skills directory: {}", e),
                path: None,
            };
        }
    };

    let skill_dir = base_dir.join(&skill_name);

    if !skill_dir.exists() {
        return SkillInstallResult {
            success: false,
            message: format!("Skill {} is not installed", skill_name),
            path: None,
        };
    }

    if let Err(e) = std::fs::remove_dir_all(&skill_dir) {
        return SkillInstallResult {
            success: false,
            message: format!("Failed to remove skill directory: {}", e),
            path: None,
        };
    }

    SkillInstallResult {
        success: true,
        message: format!("Successfully uninstalled {} skill", skill_name),
        path: Some(skill_dir.to_string_lossy().to_string()),
    }
}

/// List installed skills
#[tauri::command]
pub async fn list_installed_skills(
    is_global: bool,
    working_directory: Option<String>,
) -> Result<Vec<String>, String> {
    let base_dir = get_skills_dir(is_global, working_directory)?;

    if !base_dir.exists() {
        return Ok(vec![]);
    }

    let entries = std::fs::read_dir(&base_dir)
        .map_err(|e| format!("Failed to read skills directory: {}", e))?;

    let mut skills = vec![];
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name() {
                    skills.push(name.to_string_lossy().to_string());
                }
            }
        }
    }

    Ok(skills)
}

/// Check if a skill is installed
#[tauri::command]
pub async fn is_skill_installed(
    skill_name: String,
    is_global: bool,
    working_directory: Option<String>,
) -> bool {
    let base_dir = match get_skills_dir(is_global, working_directory) {
        Ok(dir) => dir,
        Err(_) => return false,
    };

    let skill_dir = base_dir.join(&skill_name);
    skill_dir.exists() && skill_dir.is_dir()
}

/// Get the path where a skill would be installed
#[tauri::command]
pub async fn get_skill_install_path(
    skill_name: String,
    is_global: bool,
    working_directory: Option<String>,
) -> Result<String, String> {
    let base_dir = get_skills_dir(is_global, working_directory)?;
    let skill_dir = base_dir.join(&skill_name);
    Ok(skill_dir.to_string_lossy().to_string())
}

/// Run a shell command (used for npx claude-code-templates install)
#[tauri::command]
pub async fn run_shell_command(
    command: String,
    working_directory: Option<String>,
) -> SkillInstallResult {
    // Get the working directory
    let cwd = if let Some(dir) = working_directory {
        PathBuf::from(dir)
    } else {
        match std::env::current_dir() {
            Ok(dir) => dir,
            Err(e) => {
                return SkillInstallResult {
                    success: false,
                    message: format!("Failed to get current directory: {}", e),
                    path: None,
                };
            }
        }
    };

    // Run the command
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &command])
            .current_dir(&cwd)
            .output()
    } else {
        Command::new("sh")
            .args(["-c", &command])
            .current_dir(&cwd)
            .output()
    };

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);

            if output.status.success() {
                // Try to extract the installation path from output
                let path = stdout
                    .lines()
                    .find(|line| line.contains(".claude/") || line.contains("installed"))
                    .map(|s| s.to_string());

                SkillInstallResult {
                    success: true,
                    message: if stdout.is_empty() {
                        "Command completed successfully".to_string()
                    } else {
                        stdout.to_string()
                    },
                    path,
                }
            } else {
                SkillInstallResult {
                    success: false,
                    message: if stderr.is_empty() {
                        format!("Command failed with exit code: {:?}", output.status.code())
                    } else {
                        stderr.to_string()
                    },
                    path: None,
                }
            }
        }
        Err(e) => SkillInstallResult {
            success: false,
            message: format!("Failed to execute command: {}", e),
            path: None,
        },
    }
}
