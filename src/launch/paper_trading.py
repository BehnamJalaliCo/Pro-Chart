from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Any
class TradingMode(str,Enum): PAPER='paper'; LIVE='live'; DISABLED='disabled'
@dataclass
class PaperTradingConfig:
    mode:TradingMode=TradingMode.PAPER; beta_channel_id:str|None=None
    @classmethod
    def from_settings(cls,s):
        try:m=TradingMode(getattr(s,'TRADING_MODE','paper'))
        except ValueError:m=TradingMode.PAPER
        return cls(m,getattr(s,'BETA_CHANNEL_ID',None))
def should_publish_to_users(config): return config.mode is TradingMode.LIVE
async def publish_signal(config,client,signal,public_channel_id=None):
    if config.mode is TradingMode.DISABLED:return {'published':False,'mode':'disabled'}
    data=dict(signal); data['is_paper']=config.mode is TradingMode.PAPER; sid=signal['id']
    if config.mode is TradingMode.PAPER:
        await client.set_json(f'paper:active:{sid}',data); return {'published':False,'mode':'paper','signal_id':sid}
    await client.set_active_signal(sid,data)
    if public_channel_id: await client.publish(public_channel_id,data)
    return {'published':True,'mode':'live','signal_id':sid}
