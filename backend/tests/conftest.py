import os
import asyncio
import pytest
import pytest_asyncio
import asyncpg
from unittest.mock import patch, AsyncMock
from testcontainers.postgres import PostgresContainer
from fastapi.testclient import TestClient

# Set required environment variables for tests before importing config
os.environ["JWT_SECRET"] = "test-secret-key-do-not-use-in-prod"
os.environ["GEMINI_API_KEY"] = "mock-api-key"

from backend.main import app
from backend.db.connection import get_pool, _pool
from backend.db.migrations import run_migrations
from backend.config import settings

# Global container reference to keep it alive for the test session
_postgres_container = None
_test_db_url = None

def pytest_configure(config):
    """Start TestContainers Postgres before tests begin."""
    global _postgres_container, _test_db_url
    _postgres_container = PostgresContainer("postgres:16-alpine")
    _postgres_container.start()
    
    # testcontainers returns asyncpg-incompatible URL (e.g. postgresql+psycopg2), we need standard postgresql
    host = _postgres_container.get_container_host_ip()
    port = _postgres_container.get_exposed_port(5432)
    user = _postgres_container.username
    password = _postgres_container.password
    dbname = _postgres_container.dbname
    
    _test_db_url = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
    
    # Override settings so code that uses settings.DATABASE_URL gets the test DB
    settings.DATABASE_URL = _test_db_url
    os.environ["DATABASE_URL"] = _test_db_url

def pytest_unconfigure(config):
    """Stop the container when tests are done."""
    global _postgres_container
    if _postgres_container:
        _postgres_container.stop()

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="session", autouse=True)
async def db_schema():
    """Run migrations on the test database once per session."""
    conn = await asyncpg.connect(_test_db_url)
    try:
        await run_migrations(conn)
    finally:
        await conn.close()

@pytest_asyncio.fixture(autouse=True)
async def db_pool():
    """Provide an isolated database pool per test and prevent lifespan interference."""
    pool = await asyncpg.create_pool(_test_db_url, min_size=1, max_size=5)
    
    # Patch the global pool in backend.db.connection to use this test pool
    import backend.db.connection as db_conn
    db_conn._pool = pool

    # Prevent lifespan from re-running migrations or closing our test pool
    with patch("backend.main.init_db", new=AsyncMock()), patch("backend.main.close_pool", new=AsyncMock()):
        yield pool

    # Only close after the test is completely done
    await pool.close()
    db_conn._pool = None

@pytest_asyncio.fixture
async def db_conn(db_pool):
    """Provide a single database connection from the pool."""
    async with db_pool.acquire() as conn:
        yield conn

from httpx import AsyncClient, ASGITransport

@pytest_asyncio.fixture
async def client(db_pool):
    """Provide an async httpx TestClient with the mocked database pool."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as test_client:
        yield test_client
