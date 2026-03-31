# Copilot Workspace Instructions

## File Encoding

**Always use UTF-8 with BOM** when reading or writing files via PowerShell terminal commands.

### PowerShell rules

- Use `-Encoding UTF8` with `Set-Content`, `Out-File`, and `Add-Content` — PowerShell 5.1 `UTF8` means UTF-8 with BOM, which is correct for this workspace.
- Use `[System.Text.UTF8Encoding]::new($true)` (BOM = `$true`) with `[System.IO.File]::WriteAllText()` or `[System.IO.File]::WriteAllLines()`.
- Use `[System.Text.UTF8Encoding]::new($true)` with `[System.IO.File]::ReadAllText()` when reading and re-writing files.
- **Never** use `[System.Text.UTF8Encoding]::new($false)` (no-BOM) in terminal commands.
- **Never** use `[System.IO.File]::WriteAllBytes()` with raw byte arrays unless explicitly byte-patching a binary.

### Examples

```powershell
# ✅ Correct — write with BOM
Set-Content $file $content -Encoding UTF8

# ✅ Correct — write with BOM via .NET
[System.IO.File]::WriteAllText($file, $content, [System.Text.UTF8Encoding]::new($true))

# ❌ Wrong — no BOM
[System.IO.File]::WriteAllText($file, $content, [System.Text.UTF8Encoding]::new($false))

# ❌ Wrong — default .NET encoding (ASCII/system default)
[System.IO.File]::WriteAllText($file, $content)
```

### Tool use (create_file / replace_string_in_file)

When using editor tools (`create_file`, `replace_string_in_file`, `multi_replace_string_in_file`) to write HTML, CSS, JS, or JSON files, the tools handle encoding transparently — no special action needed. Only apply the PowerShell rules above when running terminal commands.
