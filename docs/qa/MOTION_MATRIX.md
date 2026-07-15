# ماتریس Motion و Gesture

وضعیت کلی: `PARTIAL`

| شناسه | تعامل | انتظار | Requirement | Evidence | وضعیت |
|---|---|---|---|---|---|
| MOT-001 | Pan افقی چارت | حرکت زمان، حفظ crosshair، بدون scroll conflict | PC-028، PC-029 | video + event trace + frame times | NOT_CAPTURED |
| MOT-002 | Wheel/Trackpad zoom | anchor زیر pointer پایدار | PC-029، PC-040 | `qa/tests/motion-chart.spec.mjs`؛ wheel event، scroll/url و canvas geometry ثابت ثبت شد؛ zoom-anchor کامل pending | PARTIAL |
| MOT-003 | Pinch | zoom دو محوره و بدون browser navigation conflict | PC-029 | touch trace + video | NOT_CAPTURED |
| MOT-004 | Long press | Crosshair موبایل و cancel قابل پیش‌بینی | PC-029 | touch trace + a11y announcement | NOT_CAPTURED |
| MOT-005 | Drawing handle drag | snap اختیاری، hit area لمسی و undo | PC-025، PC-030، PC-061 | event trace + geometry | NOT_CAPTURED |
| MOT-006 | Undo/Redo | حداقل ۵۰ command بدون corruption | PC-030 | Property: `qa/tests/drawing-history.test.mjs` با 60 command، 50 undo+50 redo، deep-copy، redo invalidation و cap=100؛ E2E: `qa/tests/drawing-history-e2e.spec.mjs` با 50 create، 50 toolbar undo، 50 toolbar redo، تطبیق دقیق state، reload و post-reload create/undo؛ هر دو بدون retry پاس | PASS |
| MOT-007 | Dialog/Sheet | ۲۰۰–۲۸۰ms، focus transfer/restore درست | PC-032، PC-148 | onboarding live: animation=`240ms`، focus/inert/Escape/restore پاس؛ سایر Dialog/Sheetها pending | PARTIAL |
| MOT-008 | Reduced motion | حذف حرکت غیرضروری و حفظ کارکرد | PC-033 | onboarding `2 passed`؛ `qa/tests/motion-chart.spec.mjs` روی desktop/mobile ثابت کرد animation/transition حداکثر `0.01ms`، iteration≤1 و scroll=`auto`؛ سایر gestureها pending | PARTIAL |
| MOT-009 | Multi-pane resize | بدون drift و dropped-frame غیرمجاز | PC-041، PC-141 | frame trace + serialization | NOT_CAPTURED |
| MOT-010 | Order submit | feedback <100ms و double-submit صفر | PC-028، PC-094 | network fault trace | NOT_CAPTURED |

Motion حیاتی با انحراف بیش از ۱۶ms یا یک frame نیازمند Review است. Retry برای پنهان‌کردن Flake مجاز نیست.
