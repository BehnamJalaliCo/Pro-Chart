def is_weekend_blackout(now):
    # UTC: Friday after 21:00 through Sunday before 22:00
    wd,h=now.weekday(),now.hour
    blocked=(wd==4 and h>=21) or wd==5 or (wd==6 and h<22)
    return blocked, ('گپ آخر هفته' if blocked else None)
