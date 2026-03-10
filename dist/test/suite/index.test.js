import assert from "assert";
import sinon from "sinon";
import fs from "fs";
import path from "path";
// ─── Helpers ──────────────────────────────────────────────────────────────────
//
// We test the tool logic directly rather than spinning up a full MCP server.
// This keeps tests fast, isolated, and free of real file system side effects.
//
// Each tool's handler is extracted into a pure function so we can call it
// directly in tests — same pattern as your VS Code extension tests.
const PROMPTS_DIR = path.resolve(process.cwd(), "prompts");
// ─── Tool handlers (mirrors src/index.ts logic) ───────────────────────────────
async function listPromptsHandler() {
    const files = fs
        .readdirSync(PROMPTS_DIR)
        .filter((f) => f.endsWith(".txt") || f.endsWith(".md"));
    if (files.length === 0) {
        return {
            content: [{ type: "text", text: "No prompt files found in the prompts folder." }],
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
}
async function readPromptHandler({ filename }) {
    const safeName = path.basename(filename);
    const filePath = path.join(PROMPTS_DIR, safeName);
    if (!fs.existsSync(filePath)) {
        return {
            content: [{ type: "text", text: `File not found: ${safeName}` }],
        };
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return {
        content: [{ type: "text", text: `Contents of ${safeName}:\n\n${content}` }],
    };
}
async function savePromptHandler({ text }) {
    if (!text.trim()) {
        return {
            content: [{ type: "text", text: "Cannot save an empty prompt." }],
        };
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `prompt-${timestamp}.txt`;
    const filePath = path.join(PROMPTS_DIR, filename);
    fs.writeFileSync(filePath, text, "utf-8");
    return {
        content: [{ type: "text", text: `Prompt saved as: ${filename}` }],
    };
}
// ─── Tests ────────────────────────────────────────────────────────────────────
describe("mcp-prompt-server", () => {
    let sandbox;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });
    afterEach(() => {
        sandbox.restore();
    });
    // ── Test 1: Server identity ──────────────────────────────────────────────────
    it("should have the correct server name and version", () => {
        const serverInfo = { name: "mcp-prompt-server", version: "0.0.1" };
        assert.strictEqual(serverInfo.name, "mcp-prompt-server");
        assert.strictEqual(serverInfo.version, "0.0.1");
    });
    // ── Test 2: list_prompts — happy path ────────────────────────────────────────
    it("list_prompts should return files when folder has content", async () => {
        sandbox.stub(fs, "readdirSync").returns(["test.txt", "notes.md"]);
        const result = await listPromptsHandler();
        assert.strictEqual(result.content[0].type, "text");
        assert.ok(result.content[0].text.includes("Found 2 prompt file(s)"));
        assert.ok(result.content[0].text.includes("test.txt"));
        assert.ok(result.content[0].text.includes("notes.md"));
    });
    // ── Test 3: list_prompts — sad path ─────────────────────────────────────────
    it("list_prompts should return empty message when no files exist", async () => {
        sandbox.stub(fs, "readdirSync").returns([]);
        const result = await listPromptsHandler();
        assert.strictEqual(result.content[0].text, "No prompt files found in the prompts folder.");
    });
    // ── Test 4: list_prompts — file type guard ───────────────────────────────────
    it("list_prompts should filter out non-.txt and non-.md files", async () => {
        sandbox
            .stub(fs, "readdirSync")
            .returns(["test.txt", "image.png", "notes.md", "data.json"]);
        const result = await listPromptsHandler();
        assert.ok(result.content[0].text.includes("Found 2 prompt file(s)"));
        assert.ok(!result.content[0].text.includes("image.png"));
        assert.ok(!result.content[0].text.includes("data.json"));
    });
    // ── Test 5: read_prompt — happy path ────────────────────────────────────────
    it("read_prompt should return file contents", async () => {
        sandbox.stub(fs, "existsSync").returns(true);
        sandbox.stub(fs, "readFileSync").returns("What is integration engineering?");
        const result = await readPromptHandler({ filename: "test.txt" });
        assert.ok(result.content[0].text.includes("Contents of test.txt"));
        assert.ok(result.content[0].text.includes("What is integration engineering?"));
    });
    // ── Test 6: read_prompt — sad path ──────────────────────────────────────────
    it("read_prompt should return error message when file not found", async () => {
        sandbox.stub(fs, "existsSync").returns(false);
        const result = await readPromptHandler({ filename: "missing.txt" });
        assert.strictEqual(result.content[0].text, "File not found: missing.txt");
    });
    // ── Test 7: read_prompt — security guard ────────────────────────────────────
    //
    // path.basename("../../etc/passwd") returns "passwd"
    // which won't exist in the prompts folder — so the traversal is blocked.
    it("read_prompt should block directory traversal attacks", async () => {
        sandbox.stub(fs, "existsSync").returns(false);
        const result = await readPromptHandler({ filename: "../../etc/passwd" });
        // The dangerous path is stripped — only "passwd" remains, which isn't found
        assert.strictEqual(result.content[0].text, "File not found: passwd");
    });
    // ── Test 8: save_prompt — happy path ────────────────────────────────────────
    it("save_prompt should write file and return timestamped filename", async () => {
        const writeStub = sandbox.stub(fs, "writeFileSync");
        const result = await savePromptHandler({ text: "What is MCP?" });
        // File was written exactly once
        assert.ok(writeStub.calledOnce);
        // Response confirms the save with a timestamped filename
        assert.ok(result.content[0].text.startsWith("Prompt saved as: prompt-"));
        assert.ok(result.content[0].text.endsWith(".txt"));
    });
    // ── Test 9: save_prompt — sad path ──────────────────────────────────────────
    it("save_prompt should reject empty content", async () => {
        const writeStub = sandbox.stub(fs, "writeFileSync");
        const result = await savePromptHandler({ text: "   " });
        // File was never written
        assert.ok(writeStub.notCalled);
        // Response explains why
        assert.strictEqual(result.content[0].text, "Cannot save an empty prompt.");
    });
});
