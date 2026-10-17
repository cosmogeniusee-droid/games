# Copilot Workspace Instructions

## Do not show thinking process

Show only the final result. Do not show reasoning, considering, or planning steps.

## File Encoding

Files in this workspace are **UTF-8 with BOM**.

- Editor tools (`create_file`, `replace_string_in_file`, `multi_replace_string_in_file`) handle encoding transparently — no special action needed.
- Only when writing files via **PowerShell terminal commands**, preserve the BOM:
  - `Set-Content` / `Out-File` / `Add-Content`: use `-Encoding UTF8` (PowerShell 5.1 `UTF8` means with-BOM).
  - `[System.IO.File]::WriteAllText()` / `WriteAllLines()`: use `[System.Text.UTF8Encoding]::new($true)` (BOM = `$true`).
  - Never use the no-BOM encoding (`$false`), the default .NET encoding, or `WriteAllBytes()` with raw byte arrays (unless byte-patching a binary).
