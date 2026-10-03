import pytest

from app import llm


@pytest.fixture(autouse=True)
def template_agents(monkeypatch):
    """Run the templated agents by default so tests never call the Claude API.

    Tests of the Claude code path override this with a fake client
    (see test_claude_agents.py).
    """
    monkeypatch.setenv("STEM_AGENTS", "template")
    # Sign-in is covered by test_auth.py; elsewhere it's off.
    monkeypatch.setenv("STEM_AUTH", "off")
    llm._client.cache_clear()
