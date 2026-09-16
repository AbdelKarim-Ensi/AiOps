import asyncio
import time
from app.loki_client import fetch_recent_logs

async def main():
    since_ns = time.time_ns() - (10 * 60 * 1_000_000_000)  # 10 minutes avant maintenant

    logs = await fetch_recent_logs(since_ns)
    print(f"{len(logs)} logs récupérés")
    for log in logs[:3]:
        print(log)

asyncio.run(main())
