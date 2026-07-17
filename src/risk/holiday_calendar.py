from __future__ import annotations
from dataclasses import dataclass
from datetime import date,datetime
from enum import Enum
class HolidayImpact(str,Enum): FULL_CLOSURE='full_closure'; PARTIAL='partial'
@dataclass
class Holiday: name:str; impact:HolidayImpact; affected_markets:list[str]
def get_holiday(d):
    known={(1,1):Holiday('New Year',HolidayImpact.FULL_CLOSURE,['FX']), (12,25):Holiday('Christmas',HolidayImpact.FULL_CLOSURE,['FX']), (7,4):Holiday('US Independence',HolidayImpact.PARTIAL,['US']), (11,26):Holiday('US Thanksgiving',HolidayImpact.PARTIAL,['US']), (4,3):Holiday('Good Friday',HolidayImpact.FULL_CLOSURE,['FX'])}
    return known.get((d.month,d.day))
def is_holiday_blackout(now):
    h=get_holiday(now.date()); return (h is not None and h.impact is HolidayImpact.FULL_CLOSURE, h.name if h else None)
