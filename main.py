import os
import asyncio
from pathlib import Path
from mcp.server.fastmcp import FastMCP

# ─── Config ───────────────────────────────────────────────────────────────────
#
# Path(__file__) is the Python equivalent of import.meta.url in TypeScript.
# .parent gives us the directory the file lives in.
# / "prompts" adds "prompts" to that path — Python's pathlib uses / as a
# path joining operator, which is more readable than os.path.join().

PROMPTS_DIR = Path(__file__).parent / "prompts"

# Ensure the prompts directory exists at startup
PROMPTS_DIR.mkdir(exist_ok=True)

# ─── Server Setup ─────────────────────────────────────────────────────────────
#
# FastMCP is the high-level Python MCP server class.
# It's the equivalent of new McpServer() in TypeScript.

mcp = FastMCP("mcp-prompt-server")

# ─── Tool: list_prompts ───────────────────────────────────────────────────────
#
# The @mcp.tool() decorator registers this function as an MCP tool.
# This replaces server.registerTool() from the TypeScript version.
#
# -> str is the return type annotation — Python's equivalent of TypeScript's
# return type. It's optional but good practice.

@mcp.tool()
async def list_prompts() -> str:
    """List all prompt files (.txt and .md) in the prompts folder."""

    # os.listdir() is Python's equivalent of fs.readdirSync()
    files = [
        f for f in os.listdir(PROMPTS_DIR)
        if f.endswith(".txt") or f.endswith(".md")
    ]

    if not files:
        return "No prompt files found in the prompts folder."

    return f"Found {len(files)} prompt file(s):\n" + "\n".join(files)


# ─── Tool: read_prompt ────────────────────────────────────────────────────────
#
# filename: str is how Python declares a typed parameter.
# The TypeScript equivalent was: filename: string

@mcp.tool()
async def read_prompt(filename: str) -> str:
    """Read the contents of a specific prompt file by filename."""

    # Guard: prevent directory traversal attacks
    # Path(filename).name is Python's equivalent of path.basename()
    safe_name = Path(filename).name
    file_path = PROMPTS_DIR / safe_name

    # file_path.exists() is Python's equivalent of fs.existsSync()
    if not file_path.exists():
        return f"File not found: {safe_name}"

    # file_path.read_text() is Python's equivalent of fs.readFileSync(path, "utf-8")
    content = file_path.read_text(encoding="utf-8")

    return f"Contents of {safe_name}:\n\n{content}"


# ─── Tool: save_prompt ────────────────────────────────────────────────────────
#
# Write-on-success pattern: file is only written after all validation passes.

@mcp.tool()
async def save_prompt(text: str) -> str:
    """Save text as a new timestamped prompt file in the prompts folder."""

    # Guard: reject empty content
    # .strip() removes whitespace — same as .trim() in TypeScript
    if not text.strip():
        return "Cannot save an empty prompt."

    # Generate ISO 8601 timestamp, made safe for filenames
    # datetime is Python's built-in date/time library
    from datetime import datetime, timezone
    timestamp = datetime.now(timezone.utc).isoformat().replace(":", "-").replace(".", "-")
    filename = f"prompt-{timestamp}.txt"
    file_path = PROMPTS_DIR / filename

    # file_path.write_text() is Python's equivalent of fs.writeFileSync()
    file_path.write_text(text, encoding="utf-8")

    return f"Prompt saved as: {filename}"


# ─── Entry Point ──────────────────────────────────────────────────────────────
#
# mcp.run() starts the server using stdio transport — same as StdioServerTransport
# in the TypeScript version.
#
# if __name__ == "__main__": is Python's equivalent of the entry point check.
# It means: "only run this code if this file is executed directly, not imported."
# TypeScript doesn't need this because it uses separate entry point files.

if __name__ == "__main__":
    mcp.run()