import asyncio
from backend.db.connection import get_pool

async def main():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='organizations' AND column_name='allow_auto_approve_jds') THEN
                ALTER TABLE organizations ADD COLUMN allow_auto_approve_jds BOOLEAN DEFAULT TRUE;
            END IF;
        END $$;
        """)
    print("Migration done")

asyncio.run(main())
