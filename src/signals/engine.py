import asyncio
async def run_in_thread(fn,*args,**kwargs): return await asyncio.to_thread(fn,*args,**kwargs)
async def analyze_all(items): return await asyncio.gather(*(run_in_thread(x) for x in items))
