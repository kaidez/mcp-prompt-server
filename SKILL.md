---
name: prompt-manager
description: Manage local prompt files using the mcp-prompt-server tools. Use this skill when the user wants to list, read, save, or work with prompt files stored in their local prompts folder.
---

# Prompt Manager Skill

## Overview

This skill uses three tools from `mcp-prompt-server` to manage prompt files stored in a local `prompts/` folder. Use this skill to help the user discover, read, and save prompt content without requiring manual file management.

## Tools Available

| Tool | When to use |
|--|--|
| `list_prompts` | User wants to see what prompt files exist |
| `read_prompt` | User wants to read a specific file |
| `save_prompt` | User wants to save text as a new prompt file |

## Workflows

### Discovering prompt files
1. Call `list_prompts` first — always start here if the user hasn't specified a filename
2. Present the file list clearly
3. Offer to read any file by name

### Reading a prompt
1. If the user names a specific file → call `read_prompt` with that filename directly
2. If the user is vague ("read my latest prompt", "show me my prompts") → call `list_prompts` first, then `read_prompt` on the most relevant file
3. After reading, offer to answer the prompt, save a new one, or take another action

### Saving a prompt
1. Call `save_prompt` with the exact text the user wants to save
2. Confirm the timestamped filename that was created
3. Let the user know where the file lives (`prompts/` folder)

### Full workflow (list → read → respond)
When a user says something like "work through my prompts":
1. Call `list_prompts` to discover all files
2. Call `read_prompt` on each file in turn
3. Respond to each prompt's content
4. Offer to save any responses as new prompt files

## Conventions

- Prompt files use ISO 8601 timestamps in their names: `prompt-2026-03-09T14-35-22-456Z.txt`
- Only `.txt` and `.md` files are valid prompt files — other file types are ignored
- Files are always saved to the `prompts/` folder — no subdirectories
- Always confirm the filename after saving so the user knows where their content went
- Never invent filenames — only use filenames returned by `list_prompts`

## Security Notes

- The `read_prompt` tool automatically blocks directory traversal attempts — filenames like `../../etc/passwd` are sanitized before any file operation
- The `save_prompt` tool rejects empty content before writing anything to disk
- Both guards are enforced server-side — this skill does not need to pre-validate inputs

## Example Interactions

**User:** "What prompt files do I have?"
→ Call `list_prompts`, present results

**User:** "Read test.txt"
→ Call `read_prompt` with `filename: "test.txt"`

**User:** "Save this as a prompt: How should I prepare for an integration engineering interview?"
→ Call `save_prompt` with that text, confirm the filename

**User:** "Answer my latest prompt"
→ Call `list_prompts`, identify the most recently timestamped file, call `read_prompt`, then respond to its contents
