from __future__ import annotations
from dataclasses import dataclass,field
from enum import Enum
from pathlib import Path
class CheckLevel(str,Enum): CRITICAL='critical'; WARNING='warning'
class CheckStatus(str,Enum): PASS='pass'; FAIL='fail'
@dataclass
class PreflightCheck:
    name:str; level:CheckLevel; status:CheckStatus; detail:str=''
@dataclass
class PreflightResult:
    checks:list[PreflightCheck]=field(default_factory=list)
    @property
    def is_ready_for_launch(self): return not any(c.level is CheckLevel.CRITICAL and c.status is CheckStatus.FAIL for c in self.checks)
def _check(name,path,level=CheckLevel.CRITICAL):
    ok=Path(path).exists(); return PreflightCheck(name,level,CheckStatus.PASS if ok else CheckStatus.FAIL,str(path))
def check_runbook_exists(): return _check('runbook','docs/RUNBOOK.md')
def check_backup_script_exists(): return _check('backup','scripts/backup.sh')
def check_monitoring_active():
    a=Path('monitoring/alerts.yml').exists() and Path('monitoring/prometheus.yml').exists(); return PreflightCheck('monitoring',CheckLevel.CRITICAL,CheckStatus.PASS if a else CheckStatus.FAIL)
