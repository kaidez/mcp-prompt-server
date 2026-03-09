---
name: prompt-manager
description: Manage prompt files using the mcp-prompt-server tools. Use this skill when the user wants to list, read, save, or work with prompt files stored locally.
---

# Prompt Manager Skill

## Overview
This skill uses three tools from mcp-prompt-server to manage prompt files stored in a local prompts folder.

## Tools Available
- `list_prompts` — discover what prompt files exist
- `read_prompt` — read a specific file by name
- `save_prompt` — save new text as a timestamped file

## Workflow

### When user asks to see their prompts:
1. Call `list_prompts` first
2. Offer to read any file by name

### When user asks to read a prompt:
1. If filename is known, call `read_prompt` directly
2. If filename is unknown, call `list_prompts` first then `read_prompt`

### When user wants to save something:
1. Call `save_prompt` with the text
2. Confirm the filename that was created

## Conventions
- Always confirm filenames after saving
- Prompt files use ISO 8601 timestamps in their names
- Only `.txt` and `.md` files are valid prompt files