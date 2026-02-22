/// OS keychain integration via the `keyring` crate.
/// Stores secrets (API keys, tokens) in macOS Keychain / Linux Secret Service / Windows Credential Manager.

const SERVICE: &str = "sh.hatch.desktop";

/// Store a value in the OS keychain.
#[tauri::command]
pub fn keychain_set(key: String, value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

/// Retrieve a value from the OS keychain. Returns None if the key doesn't exist.
#[tauri::command]
pub fn keychain_get(key: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Delete a value from the OS keychain. Silently succeeds if the key doesn't exist.
#[tauri::command]
pub fn keychain_delete(key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Check if a key exists in the OS keychain with a non-empty value.
#[tauri::command]
pub fn keychain_has(key: String) -> Result<bool, String> {
    let entry = keyring::Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(password) => Ok(!password.is_empty()),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}
