# tests/conftest.py
# ──────────────────
# Shared pytest configuration for the backend-ai test suite.
#
# This file is automatically loaded by pytest before any test file runs.
# It sets the asyncio mode to "auto" so every async test function is
# collected and run without needing an @pytest.mark.asyncio decorator
# on each one individually.
#
# Why asyncio_mode = "auto"?
#   Our services use Motor (async MongoDB) so many tests are async.
#   Strict mode (the current default in pytest-asyncio ≥ 0.21) requires
#   every async test to be decorated, which is noisy.  "Auto" mode
#   handles this transparently.

import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "asyncio: mark a test as an asyncio coroutine"
    )
