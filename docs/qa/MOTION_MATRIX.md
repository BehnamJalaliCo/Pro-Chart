# ماتریس Motion و Gesture

وضعیت کلی: `PARTIAL`

| شناسه | تعامل | انتظار | Requirement | Evidence | وضعیت |
|---|---|---|---|---|---|
| MOT-001 | Pan افقی چارت | حرکت زمان، حفظ crosshair، بدون scroll conflict | PC-028، PC-029 | video + event trace + frame times | NOT_CAPTURED |
| MOT-002 | Wheel/Trackpad zoom | anchor زیر pointer پایدار | PC-029، PC-040 | frame trace + geometry assertion | NOT_CAPTURED |
| MOT-003 | Pinch | zoom دو محوره و بدون browser navigation conflict | PC-029 | touch trace + video | NOT_CAPTURED |
| MOT-004 | Long press | Crosshair موبایل و cancel قابل پیش‌بینی | PC-029 | touch trace + a11y announcement | NOT_CAPTURED |
| MOT-005 | Drawing handle drag | snap اختیاری، hit area لمسی و undo | PC-025، PC-030، PC-061 | event trace + geometry | NOT_CAPTURED |
| MOT-006 | Undo/Redo | حداقل ۵۰ command بدون corruption | PC-030 | property test + E2E | NOT_CAPTURED |
| MOT-007 | Dialog/Sheet | ۲۰۰–۲۸۰ms، focus transfer/restore درست | PC-032، PC-148 | `artifacts/qa/playwright/.../onboarding-focus`؛ focus/inert/restore ثبت شد، timing کامل pending | PARTIAL |
| MOT-008 | Reduced motion | حذف حرکت غیرضروری و حفظ کارکرد | PC-033 | `PROCHART_REDUCED_MOTION=reduce`؛ onboarding `2 passed`، سایر gestureها pending | PARTIAL |
| MOT-009 | Multi-pane resize | بدون drift و dropped-frame غیرمجاز | PC-041، PC-141 | frame trace + serialization | NOT_CAPTURED |
| MOT-010 | Order submit | feedback <100ms و double-submit صفر | PC-028، PC-094 | network fault trace | NOT_CAPTURED |

Motion حیاتی با انحراف بیش از ۱۶ms یا یک frame نیازمند Review است. Retry برای پنهان‌کردن Flake مجاز نیست.
