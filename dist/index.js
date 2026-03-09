import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
// ─── Config ───────────────────────────────────────────────────────────────────
const PROMPTS_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), // Get file path in the ES module way
    "../prompts");

// Ensure the prompts directory exists at startup
if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
}
// ─── Server Setup ─────────────────────────────────────────────────────────────
const server = new McpServer({
    name: "mcp-prompt-server",
    version: "0.0.1",
});
// ─── Tool: list_prompts ───────────────────────────────────────────────────────
//
// Returns a list of all .txt and .md files in the prompts folder.
// No input required — Claude calls this to discover what prompt files exist.
server.tool("list_prompts", "List all prompt files (.txt and .md) in the prompts folder", {}, async () => {
    const files = fs
        .readdirSync(PROMPTS_DIR)
        .filter((f) => f.endsWith(".txt") || f.endsWith(".md"));
    if (files.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: "No prompt files found in the prompts folder.",
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `Found ${files.length} prompt file(s):\n${files.join("\n")}`,
            },
        ],
    };
});
// ─── Tool: read_prompt ────────────────────────────────────────────────────────
//
// Reads and returns the contents of a specific prompt file.
// Claude passes the filename it wants to read.
server.tool("read_prompt", "Read the contents of a specific prompt file by filename", {
    filename: z.string().describe("The name of the prompt file to read (e.g. test.txt)"),
}, async ({ filename }) => {
    // Guard: prevent directory traversal attacks (e.g. filename = "../../etc/passwd")
    const safeName = path.basename(filename);
    const filePath = path.join(PROMPTS_DIR, safeName);
    if (!fs.existsSync(filePath)) {
        return {
            content: [
                {
                    type: "text",
                    text: `File not found: ${safeName}`,
                },
            ],
        };
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return {
        content: [
            {
                type: "text",
                text: `Contents of ${safeName}:\n\n${content}`,
            },
        ],
    };
});
// ─── Tool: save_prompt ────────────────────────────────────────────────────────
//
// Saves new text as a timestamped .txt file in the prompts folder.
// Write-on-success pattern: file is only written after all validation passes.
server.tool("save_prompt", "Save text as a new timestamped prompt file in the prompts folder", {
    text: z.string().describe("The text content to save as a prompt file"),
}, async ({ text }) => {
    // Guard: reject empty content
    if (!text.trim()) {
        return {
            content: [
                {
                    type: "text",
                    text: "Cannot save an empty prompt.",
                },
            ],
        };
    }
    // Generate ISO 8601 timestamp, made safe for filenames
    // e.g. 2026-03-09T14-35-22-456Z.txt
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `prompt-${timestamp}.txt`;
    const filePath = path.join(PROMPTS_DIR, filename);
    // Write-on-success: only write after all guards pass
    fs.writeFileSync(filePath, text, "utf-8");
    return {
        content: [
            {
                type: "text",
                text: `Prompt saved as: ${filename}`,
            },
        ],
    };
});
// ─── Transport ────────────────────────────────────────────────────────────────
//
// StdioServerTransport means Claude Desktop communicates with this server
// via stdin/stdout — the standard MCP communication channel.
const transport = new StdioServerTransport();
await server.connect(transport);
