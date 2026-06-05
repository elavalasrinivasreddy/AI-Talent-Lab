import asyncio
from backend.db.connection import get_connection

async def main():
    async with get_connection() as conn:
        val = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name='organizations' AND column_name='settings'")
        print("Settings column:", val)

asyncio.run(main())
