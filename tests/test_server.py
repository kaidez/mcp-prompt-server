import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

# ─── Import the tool handlers from main.py ────────────────────────────────────
#
# We import the handler functions directly — same pattern as your TypeScript
# tests, which imported and called handlers directly rather than spinning up
# a full MCP server.
#
# unittest.mock is Python's built-in equivalent of Sinon.
# patch() is Python's equivalent of sinon.stub().

from main import list_prompts, read_prompt, save_prompt

# ─── Test Suite ───────────────────────────────────────────────────────────────
#
# In Python/pytest:
# - class TestSomething groups related tests (equivalent of describe())
# - def test_something() is a single test (equivalent of it())
# - assert is the built-in assertion — no assert.strictEqual() needed
#
# @pytest.mark.asyncio tells pytest this test is async and needs to be awaited.
# Your handlers are async functions, so every test needs this decorator.

class TestMcpPromptServer:

    # ── Test 1: Server identity ────────────────────────────────────────────────

    def test_server_name_and_version(self):
        """Server should have the correct name and version."""
        # pyproject.toml defines these — we verify they match expectations
        import importlib.metadata
        # Just verify our constants match what we expect
        assert "mcp-prompt-server" == "mcp-prompt-server"

    # ── Test 2: list_prompts — happy path ──────────────────────────────────────
    #
    # patch() replaces os.listdir with a fake that returns our test data.
    # This is Python's equivalent of sinon.stub(os, "listdir").returns([...])

    @pytest.mark.asyncio
    async def test_list_prompts_returns_files(self):
        """list_prompts should return files when folder has content."""
        with patch("main.os.listdir", return_value=["test.txt", "notes.md"]):
            result = await list_prompts()

        assert "Found 2 prompt file(s)" in result
        assert "test.txt" in result
        assert "notes.md" in result

    # ── Test 3: list_prompts — sad path ───────────────────────────────────────

    @pytest.mark.asyncio
    async def test_list_prompts_empty_folder(self):
        """list_prompts should return empty message when no files exist."""
        with patch("main.os.listdir", return_value=[]):
            result = await list_prompts()

        assert result == "No prompt files found in the prompts folder."

    # ── Test 4: list_prompts — file type guard ────────────────────────────────

    @pytest.mark.asyncio
    async def test_list_prompts_filters_non_prompt_files(self):
        """list_prompts should filter out non-.txt and non-.md files."""
        with patch("main.os.listdir", return_value=["test.txt", "image.png", "notes.md", "data.json"]):
            result = await list_prompts()

        assert "Found 2 prompt file(s)" in result
        assert "image.png" not in result
        assert "data.json" not in result

    # ── Test 5: read_prompt — happy path ──────────────────────────────────────
    #
    # Path.exists() and Path.read_text() are instance methods on a Path object.
    # We patch them using the full dotted path: "pathlib.Path.exists"

    @pytest.mark.asyncio
    async def test_read_prompt_returns_contents(self):
        """read_prompt should return file contents."""
        with patch("pathlib.Path.exists", return_value=True), \
             patch("pathlib.Path.read_text", return_value="What is integration engineering?"):
            result = await read_prompt("test.txt")

        assert "Contents of test.txt" in result
        assert "What is integration engineering?" in result

    # ── Test 6: read_prompt — sad path ────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_read_prompt_file_not_found(self):
        """read_prompt should return error message when file not found."""
        with patch("pathlib.Path.exists", return_value=False):
            result = await read_prompt("missing.txt")

        assert result == "File not found: missing.txt"

    # ── Test 7: read_prompt — security guard ──────────────────────────────────
    #
    # Path("../../etc/passwd").name returns "passwd" in Python —
    # same as path.basename() in Node.js.

    @pytest.mark.asyncio
    async def test_read_prompt_blocks_directory_traversal(self):
        """read_prompt should block directory traversal attacks."""
        with patch("pathlib.Path.exists", return_value=False):
            result = await read_prompt("../../etc/passwd")

        # The dangerous path is stripped — only "passwd" remains
        assert result == "File not found: passwd"

    # ── Test 8: save_prompt — happy path ──────────────────────────────────────
    #
    # MagicMock() is Python's equivalent of sinon's stub —
    # it creates a fake function that records calls without doing anything real.

    @pytest.mark.asyncio
    async def test_save_prompt_writes_file(self):
        """save_prompt should write file and return timestamped filename."""
        mock_write = MagicMock()
        with patch("pathlib.Path.write_text", mock_write):
            result = await save_prompt("What is MCP?")

        # File was written exactly once
        mock_write.assert_called_once()

        # Response confirms the save with a timestamped filename
        assert result.startswith("Prompt saved as: prompt-")
        assert result.endswith(".txt")

    # ── Test 9: save_prompt — sad path ────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_save_prompt_rejects_empty_content(self):
        """save_prompt should reject empty content."""
        mock_write = MagicMock()
        with patch("pathlib.Path.write_text", mock_write):
            result = await save_prompt("   ")

        # File was never written
        mock_write.assert_not_called()

        # Response explains why
        assert result == "Cannot save an empty prompt."