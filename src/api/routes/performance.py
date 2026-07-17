from sqlalchemy import func
async def daily_performance():
    return {'group_by': 'date_trunc("day", created_at)'}
