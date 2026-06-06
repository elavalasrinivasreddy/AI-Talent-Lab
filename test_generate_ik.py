import asyncio
from backend.utils.security import create_access_token
import httpx

async def main():
    token = create_access_token(36, 21, "hr")
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post("http://localhost:8000/api/v1/positions/12/interview-kit/generate", headers=headers)
        print("Status Code:", res.status_code)
        print("Response Text:", res.text)

asyncio.run(main())
