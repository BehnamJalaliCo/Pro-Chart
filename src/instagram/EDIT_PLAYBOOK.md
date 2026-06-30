# 🎬 CoinePro — Video Edit Playbook (مرجعِ ساختِ ریلز/کاروسلِ حرفه‌ای)

مرجعِ واحدِ کارگردانی + ادیتِ ویدیوهای **فارکس** (هیچ کریپتو). خروجی از تحقیقِ ۱۲ ایجنتِ موازی (CapCut/Reels 2026).
این فایل را پایپ‌لاینِ `make_video.py` / `src/instagram/*` و هر ایجنتِ سازندهٔ ویدیو باید بخواند و اعمال کند.
فرمت: ریلز **۱۰۸۰×۱۹۲۰** (۹:۱۶) · کاروسل **۱۰۸۰×۱۳۵۰** (۴:۵). فونت: Vazirmatn. برند: CoinePro. صدا: کلونِ ElevenLabs یا صدای مالک.

> قاعدهٔ طلاییِ ۲۰۲۶ = **Dynamic Minimalism**: مکانیکِ Hormozi (کلمه‌به‌کلمه، زوم، برش) را نگه دار، نویز را حذف کن (ایموجیِ کارتونی، رنگِ چشمک‌زن، SFXِ تلنبار). «یک ترانزیشنِ قوی در ۵ ثانیه، نه روی‌هم‌انباشتن.»

---

## ۱) ترانزیشن‌ها (ffmpeg/CSS)
بین دو کلیپ A→B با `xfade`: `offset = (مدتِ A − مدتِ transition)`. مدتِ ترانزیشن **۱۵۰–۴۰۰ms**؛ بلندتر = آماتور. روی **بیتِ موزیک** ببُر.
- نام‌های مفیدِ `xfade=transition=`: `fade, fadeblack, fadewhite, dissolve, smoothleft/right/up/down, slide*, wipe*, circleopen/close, radial, squeezeh/v, hblur, diagtl/tr/bl/br, pixelize`.
- **۴ ترانزیشنِ پرو با کمترین زحمت:** (۱) **zoom-blur** (scale 1.0→1.25 + `gblur` sigma 0→20 روی ۸–۱۰ فریمِ آخرِ A)، (۲) **velocity/speed-ramp** (`setpts=0.5*PTS` روی ۲۰۰ms اطرافِ برش)، (۳) **whip-pan** (gblur افقی + ترنسلیتِ خارج/داخل، ۱۸۰–۲۲۰ms)، (۴) **light-leak** (`blend=all_mode=screen` با کلیپِ نشتِ نور، ۳۰۰–۵۰۰ms).
- **glitch/RGB-split** (فقط هوک/CTA، ۱۲۰–۱۶۰ms): `rgbashift=rh=8:bh=-8, noise=alls=20:allf=t` + جیترِ ۲–۴px.
- **dip-to-black/flash:** `fadeblack`/`fadewhite` ۱۲۰–۲۰۰ms روی بیت.
- **ابزارِ کلیدی (CPU، بدونِ GPU):** [`scriptituk/xfade-easing`](https://github.com/scriptituk/xfade-easing) — به xfade پشتیبانیِ `easing=` (cubic-bezier) + ۷۰+ ترانزیشنِ GLSL (`gl_zoom, gl_LinearBlur, gl_WhipPan, gl_Bounce, gl_GlitchMemories`) می‌دهد، همه روی CPU.

## ۲) کپشن (Hormozi + Dynamic Minimalism) — Persian RTL
- **سایز:** پایه ۸۸–۱۰۴px، **هوک ۱۲۰px**. کلمهٔ فعال هم‌سایز ولی با `transform:scale(1.10)` (سقف ۱.۱۲؛ بالاتر کارتونی).
- **جای عمودی:** بلوکِ کپشن `bottom:26%` (≈y۱۱۹۰–۱۲۷۰) تا از UIِ ریلز فاصله بگیرد.
- **رنگ:** پایه `#FFFFFF`؛ کلیدواژه زردِ Hormozi `#FFD93D` (یا سبزِ `#39FF14`). مینیمالِ ۲۰۲۶ = یک اکسنت (زرد/زمرّد).
- **ایزینگِ pop:** `cubic-bezier(0.34,1.56,0.64,1)`؛ fade-in ۱۲۰–۱۸۰ms؛ هر چانک ۶۰۰–۹۰۰ms نگه‌داشته شود.
- **خوانایی روی فوتیج:** آوت‌لاین با **۸ لایه `text-shadow`** (نه `-webkit-text-stroke` که حروفِ فارسی را می‌بُرد) + `0 4px 14px rgba(0,0,0,.55)`. حالتِ باکس: pill `rgba(0,0,0,.55)` شعاعِ ۱۸px.
- **حداکثر ۲–۳ کلمه روی صحنه** (فارسی پهن‌تر است). `direction:rtl;unicode-bidi:isolate;` + هر کلمه در `<span>` جدا. **uppercase نکن** (فارسی case ندارد؛ تأکید با رنگ+اسکیل). `line-height:1.6`. فونت Vazirmatn 900 قبل از capture حتماً preload شود.
- سه لوک (CSS کامل در `edit_playbook.json`): `hormozi` (زرد، آوت‌لاینِ سخت) · `minimal` (سفید، سایهٔ نرم) · `boxed` (pill، کلمهٔ فعال پرشده).

## ۳) گریدِ سینمایی (ffmpeg) — ترتیب: contrast→color-split→sat→grain→vignette
- **LOOK 1 — Teal-Orange (پیش‌فرضِ امن/پریمیوم) ⭐**
```
curves=master='0/0.03 0.25/0.20 0.5/0.5 0.75/0.80 1/0.97',colorbalance=rs=-0.06:gs=0.02:bs=0.10:rm=0.02:bm=-0.02:rh=0.10:gh=0.02:bh=-0.10,eq=contrast=1.08:saturation=1.10:gamma=0.98,selectivecolor=reds=0.06 0 -0.06 -0.02:yellows=0.05 0 -0.08 0:cyans=0 0 0 -0.10,noise=alls=8:allf=t+u,vignette=angle=PI/5
```
- **LOOK 2 — Moody-Warm (طلا/لوکس):** `curves=master='0/0.0 0.3/0.22 0.7/0.78 1/0.95',colorbalance=rs=0.05:bs=-0.04:rm=0.04:bm=-0.04:rh=0.08:gh=0.03:bh=-0.12,eq=contrast=1.12:saturation=0.95:gamma=0.95:brightness=-0.02`
- **LOOK 3 — Bleach-Bypass (جدی/گریتی):** `curves=master='0/0.0 0.2/0.10 0.5/0.55 0.8/0.92 1/1.0',eq=contrast=1.35:saturation=0.55:gamma=0.92,colorchannelmixer=1.05:0:0:0:0:0.98:0:0:0:0:0.92:0`
- **LOOK 4 — Clean-Commercial (روشن/کریسپ):** `curves=master='0/0.02 0.5/0.52 1/0.99',eq=contrast=1.05:saturation=1.06:gamma=1.02:brightness=0.02,colorbalance=bs=0.05:rh=0.03:bh=-0.04`
- **محافظتِ پوست (مهم در teal-orange):** `bs ≤ 0.10` و آخرِ مرحلهٔ رنگ: `selectivecolor=reds=0.06 0 -0.06 -0.02:yellows=0.05 0 -0.08 0:cyans=0 0 0 -0.10`.
- **گرین:** `noise=alls=8:allf=t+u` (۴ تمیز، ۱۴–۱۸ گریتی). **vignette:** `angle=PI/5` (PI/4 قوی‌تر). **لتربوکس اختیاری:** `drawbox=0:0:1080:64:black:t=fill,drawbox=0:1856:1080:64:black:t=fill`.

## ۴) ساند دیزاین (ffmpeg) — «restraint = power»
- **چیدمان نسبت به برش:** whoosh ۸۰–۱۰۰ms **قبلِ** برش · impact/boom ۳۰–۶۰ms **بعدِ** برش/متن · riser پیکش **روی** فریمِ ریوال · sub-drop **روی** برشِ عددِ بزرگ · tick روی هر pop.
- **بالانس (LUFS):** صدا −۱۴ (مرجع) · موزیکِ زیرِ صدا −۳۰..−۳۵ (۱۵–۲۰٪) · SFX −۱۸..−۲۰. مستر −۱۴ LUFS، TP −۱.
- **داکینگِ موزیک زیرِ صدا:** `[music][voice]sidechaincompress=threshold=0.02:ratio=10:attack=50:release=500:makeup=1:knee=6`.
- **ساختِ SFX با lavfi:**
  - whoosh: `anoisesrc=c=white:a=0.9:d=0.5 -af "bandpass=f=900:w=600,volume='1-abs(0.5-t/0.5)':eval=frame,afade=t=in:d=0.05,afade=t=out:st=0.4:d=0.1"`
  - impact: `sine=frequency=60:duration=0.4 -af "afade=t=out:st=0.05:d=0.35,volume=2"`
  - sub-drop: `sine=frequency=120:duration=0.4 -af "asetrate=44100*0.5,aresample=44100,afade=t=out:st=0.1:d=0.3"`
  - riser: `anoisesrc=c=pink:a=0.6:d=1.2 -af "highpass=f=400,volume='t/1.2':eval=frame,afade=t=out:st=1.1:d=0.1"`
  - tick: `sine=frequency=1200:duration=0.06 -af "afade=t=out:st=0.01:d=0.05"`
- **SFXِ رایگانِ بدونِ لاگین:** pixabay.com/sound-effects · mixkit.co/free-sound-effects. **کم استفاده کن** — یک whooshِ به‌جا بهتر از ۵تاست.

## ۵) قلابِ ۳ ثانیهٔ اول (هدف >۶۰٪ نگه‌داریِ ۳s)
- **ساختارِ ریلزِ ۲۰–۳۰s:** 0–3s هوک (متن+pattern-interrupt+وعده) · 3–8s ریسک/درد · 8–22s یک ایده، ۳ ضرب با برش · 22–27s نتیجه/قانون · 27–30s CTA. **هر ۲–۳ ثانیه یک pattern-interrupt** (زوم/برش/متنِ نو).
- **۱۵ فرمولِ هوکِ فارکس (متن FA + اینتراپت + تریگر):** «۹۰٪ تریدرها ضرر می‌کنن» snap-zoom/ترس · «اندیکاتور پولدارت نمی‌کنه» freeze+flash · «اینجوری استاپ نذار» whip · «این ۲۰۰ دلار شد ۲۰۰۰» split-wipe/پروف · «دیگه رو خبر ترید نکن» hard-cut · «حرفه‌ای‌ها فقط اینجا وارد می‌شن» zoom · «این ۸۰ پیپ رو از دست دادی» tick-flash · «بعد ۷ سال ترید، حقیقت اینه» push-in · «این اشتباه ۱۰۰۰ دلار آبه» red-flash · «بروکرها نمی‌خوان بدونی» dark-vignette · «فقط ۲ عدد تو ریسک مهمه» counter-pop · «اگه از اول شروع می‌کردم» rewind · «وین‌ریتت داره دروغ می‌گه» record-scratch · «چرا همیشه زود می‌بندی؟» direct-zoom · «این ورود ۳ مرحله‌ای رو سیو کن» list-reveal.
- **۵ CTA → تلگرام/VIP:** کامنت-کلیدواژه («بنویس "سیگنال"») + auto-DM · «سیو کن، ستاپ تو بایو» · «ستاپ امروز تو تلگرامه» · «VIP جمعه بسته می‌شه» · «سیگنال‌های این هفته رایگان».

## ۶) تایپوگرافیِ کینتیک (CSS/SVG در `render(t)`)
زمانِ سراسری t → پیشرفت: `p=clamp01((t-start)/dur)`؛ بعد از ایزینگ عبور بده.
- **ایزینگ:** `back(x,s)=1+(s+1)*(x-1)^3+s*(x-1)^2` (easeOutBack). pop کلمه s≈۱.۷–۲.۲؛ تیترِ بزرگ s≈۰.۸ یا `easeOutExpo: x=>1-2^(-10x)` (بدونِ overshoot — تیترِ بزرگِ بانس = ارزان).
- **ورود:** `transform: translateY((1-back(p))*40px) scale(0.8+0.2*back(p)); opacity: clamp01(p*2)`.
- **استگرِ حرف/کلمه:** ۳۰–۶۰ms/حرف، ۸۰–۱۲۰ms/کلمه با `start = base + i*STAGGER`.
- **ریوالِ ماسک:** `clip-path: inset(0 (1-expo(p))*100% 0 0)`.
- **پانچِ کلیدواژه:** `scale(1+0.35*sin(PI*back(p)))`. **شمارنده:** با `easeOutExpo` بشمار (ته می‌نشیند).
- **خطِ زیر/draw-on (SVG):** `<path pathLength="1" stroke-dasharray="1">` + `strokeDashoffset = 1-expo(p)`.
- **متنِ پریمیوم:** gradient-clip + **دو `drop-shadow`** (سفیدِ تنگ + رنگیِ پهن) بهتر از یک text-shadowِ بزرگ.

## ۷) استراتژیِ محتوای فارکس (اینستاگرام)
- **۸ ستون:** بریفِ روزانهٔ بازار · کالبدشکافیِ ترید · مدیریتِ ریسک · روان‌شناسی (پُراشتراک‌ترین) · افسانه‌زدایی · واکنشِ خبر (NFP/CPI/FOMC) · نتیجه/پروف (وین **و** لاس) · آموزش/مفهوم.
- **کادنس:** ۳–۵ پست/هفته = ۳–۴ ریلز + ۲–۳ کاروسل. بهترین زمان: ۲۰:۰۰–۲۳:۰۰ تهران.
- **هشتگ (۱۰–۱۵، ترکیب):** EN `#forex #forextrading #forexsignals #xauusd #goldtrading #priceaction #tradingpsychology #riskmanagement` · FA `#فارکس #آموزش_فارکس #سیگنال_فارکس #تحلیل_تکنیکال #طلا_جهانی #مدیریت_سرمایه #پرایس_اکشن`.
- **۱۲ ایده:** بریفینگ صبح بازار · کالبدشکافی ترید (کاروسل) · قانون ۲٪ · «این کارو با لوریج نکن» · ترید انتقامی (کاروسل) · افسانه vs واقعیتِ اندیکاتور · «قبل NFP این رو ببین» · اسپرد و پیپ ساده (کاروسل) · وین/لاس هفته (کاروسل) · ۵ اشتباه تازه‌کار · چطور SL بذاریم (کاروسل) · یک روز با تریدرِ دیسیپلین.
- **اعتماد/کامپلاینس:** هرگز وعدهٔ سودِ تضمینی نده؛ ریسک و **لاس را هم نشان بده**؛ دیسکلیمرِ ثابت «ترید ریسک داره». سیگنال = آموزش، نه توصیهٔ سرمایه‌گذاری.

## ۸) دیزاینِ کاروسل (۱۰۸۰×۱۳۵۰، RTL)
- **حاشیهٔ امن:** محتوا داخلِ ۱۰۰۰×۱۲۷۰ (پدینگِ ۸۰px)؛ پایین ~۱۵۰px خالی (UI). گریدِ ۱۲ ستون، گاترِ ۴۰px.
- **تایپ:** هوکِ کاور Black ۹۶–۱۲۰px/lh۱.۱ · تیترِ اسلاید ۷۰۰ ۶۴–۸۰px · بادی ۵۰۰ ۳۸–۴۶px/lh۱.۵–۱.۶ (≤~۵۰ کاراکتر/خط) · شمارهٔ اسلاید ۲۴–۲۸px. اعدادِ tabular؛ لاتین/٪ به‌صورتِ LTR داخلِ RTL.
- **کاور:** هوکِ ۵–۸ کلمه‌ایِ بزرگ + اینتراپتِ بصری + فلشِ «بکش →» (لبهٔ چپ، چون RTL) + شمارندهٔ `۳/۸` (بالا-چپ، ثابت).
- **رنگ:** بیس نزدیکِ‌مشکی `#0B0F0D` یا آف‌وایت `#F7F9F8`؛ کنتراستِ بادی ≥۴.۵:۱؛ اکسنتِ زمرّد `#10B981/#047857` فقط ~۱۰٪ سطح (هایلایت/فلش/چیپِ عدد). بادیِ بلند هرگز زمرّد نباشد.
- **۸ آرکیتایپ:** Cover · Stat (عددِ غول ۱۸۰–۲۴۰px) · Step-by-step (دایرهٔ شمارهٔ زمرّد) · Do/Don't (سبز ✓ / قرمزِ مات ✗) · Quote · Chart-explainer · Checklist · CTA. حاشیه/اسکیل/جای‌اکسنت در همهٔ اسلایدها یکسان.

## ۹) کامپوزیتینگ (ffmpeg/CSS)
- **اورلیِ بافت (نشتِ‌نور/گرین/گردوغبار):** سیاه‌زمینه با `blend=all_mode=screen:all_opacity=0.6` (نشتِ‌نور/فلر) · `softlight:all_opacity=0.4` (گرین). اورلیِ رایگان: mixkit/pixabay «light leaks/film grain».
- **cutoutِ سوژه (rembg، CPU):** `rembg i in.jpg out.png`؛ کامپوزیت با سایه: `[1:v]format=rgba,split[s][m];[s]colorchannelmixer=rr=0:gg=0:bb=0,gblur=sigma=18[sh];[0:v][sh]overlay=24:30[a];[a][m]overlay=0:0`. CSS: `filter:drop-shadow(0 14px 30px rgba(0,0,0,.55))`.
- **گلَس‌مورفیسم (کارتِ آماری):** `background:rgba(255,255,255,.10);backdrop-filter:blur(14px) saturate(140%);border-radius:22px;border:1px solid rgba(255,255,255,.22);box-shadow:0 8px 32px rgba(8,12,40,.37)`.
- **Ken Burns بدونِ جیتر (تریکِ scale):** `scale=8000:-2,zoompan=z='min(zoom+0.0012,1.4)':d=30*6:fps=30:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920`.
- **موشن‌بلور:** `minterpolate=fps=120,tblend=all_mode=average,framestep=2,fps=60` یا CSS `filter:blur(1.5px)` فقط در سگمنتِ سریع.

## ۱۰) ۱۰ سبکِ ادیتِ متفاوت (روتیشن تا تکراری نشود)
انرژی را متناوب کن: بالا (1,3,8) ↔ آرام (2,9,5) ↔ میانه (4,6,7,10).
1. **Fast-Cut Hype** — ۲–۴ برش/ث، ۱۲۰–۱۴۰BPM، whip+zoom-punch+glitch، کپشنِ بولدِ زرد، نئونِ پرکنتراست، trap+SFX. (وین‌ها، «۳ اشتباه»، انرژیِ open).
2. **Calm Minimal** — ۱ برش/۴–۶ث، ~۷۰BPM، دیزالوِ نرم/push آرام، تایپِ نازکِ وسط، دیسچوریتدِ گرم، پیانوِ lo-fi. (مایندست/دیسیپلین/اعتماد).
3. **Breaking-News** — لوئر-تردِ تیکر، فلگِ قرمزِ «فوری»، ۱.۵ برش/ث، اسلایدِ افقی، پالتِ قرمز/سفید/مشکی، استینگِ خبری. (NFP/CPI/تصمیمِ بانکِ مرکزی).
4. **Data-Viz** — نمودارِ شمعیِ انیمیت، شمارندهٔ odometer، نئونِ داشبورد، ۱ برش/۲–۳ث، morphِ عدد/draw-on، نِیویِ تیره+سایان/لایم. (بک‌تست، وین‌ریت، آمارِ پیپ).
5. **Story-Arc** — قوسِ مشکل→تقلا→نتیجه، match-cut، گریدِ گرم‌به‌سرد، اسکورِ سوئل‌دار. (سفرِ تریدر، تستیمونیال).
6. **Talking-Head Cutout** — سوژهٔ key-out روی گرافیک، jump-cut، کپشنِ چسبیده، رنگِ برند. (آموزشی/توضیحِ ستاپ).
7. **Before/After** — split/wipe، لیبلِ «قبل/بعد»، setupِ آرام→ریوالِ snap، خاکستری vs زنده. (چارتِ شلوغ vs تمیز، رشدِ اکانت).
8. **Listicle/Countdown** — شمارهٔ بزرگ (۵→۱)، دات‌های پیشرفت، ۱ آیتم/۳–۴ث، slide-in+flip. («۵ قانونِ فارکس»، تاپ جفت‌ارز).
9. **ASMR/Satisfying** — push آهستهٔ ماکرو، لوپِ سیملس، تقریباً بی‌متن، فویلیِ کریسپ. (ورودِ پرفکتِ «satisfying»، فیلرِ برند).
10. **Retro/VHS** — گرین/اسکن‌لاین/کروماتیک، تایم‌استمپ، glitch/RGB، سینث‌ویوِ گرمِ فِید. («حکمتِ قدیمیِ ترید»، تاریخِ بازار).

---

## ابزارهای سمتِ‌سرور (تحقیق‌شده ۲۰۲۶-۰۶-۱۷)
- **CapCut روی سرور؟ نه.** موتورِ CapCut فقط داخلِ اپِ GUI است؛ نه باینریِ headless، نه CLI، نه APIِ رندر. «CapCut API»های OSS فقط فایلِ draft می‌سازند، رندر نمی‌کنند. APIِ رسمی فقط AI (حذفِ بک‌گراند/آپ‌اسکیل) است. گزینه‌ها: همین Chromium+ffmpeg (یا Remotion)، یا APIهای ابریِ JSON→ویدیو (پولی: JSON2Video/Shotstack/Creatomate).
- **معماریِ فعلیِ ما درست است؛ فقط augment کن.** نصبِ پیشنهادیِ اولویت‌دار (CPU، رایگان):
  - **WhisperX** — تایم‌استمپِ کلمه‌ایِ <۱۰۰ms (سینکِ کاراوکهٔ دقیق‌تر از faster-whisper). `pip install whisperx`
  - **pycaps** — کپشنِ انیمیتِ CapCut-style (رندرِ Chromium یا بدونِ‌مرورگر Pictex). بزرگ‌ترین «حسِ CapCut». `pip install "git+https://github.com/francozanardi/pycaps.git#egg=pycaps[all]"`
  - **auto-editor** — برشِ خودکارِ سکوت → پیسینگِ جمع‌وجور. `pip install auto-editor`
  - **rembg[cpu]** — cutoutِ سوژه. `pip install "rembg[cpu,cli]"` (مدلِ سریع `u2netp`)
  - **librosa** — تشخیصِ بیت برای برشِ بیت-سینک. `pip install librosa soundfile`
  - **xfade-easing** — ترانزیشنِ GLSLِ CPU برای xfade. `git clone https://github.com/scriptituk/xfade-easing`
  - فریم‌ورک (اختیاری، بعداً): **Revideo** (MIT، رایگان) یا **Remotion** (مراقبِ لایسنسِ شرکتی بالای ۳ نفر).
- **زنجیرهٔ پیشنهادی:** ElevenLabs→WhisperX(کلمه‌ای)→auto-editor(تریمِ سکوت)→render(t) فریم‌ها→librosa(بیت)+xfade-easing(ترانزیشن روی بیت)→rembg(cutout)→pycaps(کپشن)→ffmpeg مَکسِ نهایی با موزیک+صدا.

## ۱۱) سبکِ ادیتورهای ایرانی + کتابخانهٔ asset (تحقیقِ ۲۰۲۶-۰۶-۱۷)
- **استایلِ ایرانی:** گریدِ پرکنتراست و گرم/پانچی (نه flat/log)؛ کپشنِ بولدِ کاراوکه با باکس/هایلایتِ رنگیِ کلیدواژه؛ برشِ سریع ۱.۵–۳ثانیه؛ زوم-پانچ روی کلمهٔ تأکید؛ **بیت-سینک = مهم‌ترین حرکتِ پرو** (برش و pop روی ضربِ موزیک)؛ **ساند دیزاین مهم‌تر از افکتِ بصری** (whoosh روی هر ترانزیشن، tap روی pop متن، impact روی خطِ آخر)؛ کپشنِ burn-in با فونتِ برند؛ speed-ramp.
- **زبانِ خودمونی (نه رسمی):** دومِ‌شخصِ مفرد (تو)، حذفِ شناسه (میرن/میخوای/می‌چرخه)، بازکننده‌های محاوره (بذار/ببین/راستی/وایسا)، گرم و مستقیم. مثال: «در این ویدیو می‌آموزید» ← «بذار یه چیزی نشونت بدم»؛ «۹۰٪ افراد اشتباه می‌کنند» ← «۹۰٪ آدما اینو اشتباه میرن، خودتم احتمالاً!»؛ «دنبال کنید» ← «فالو کن از این به بعد زیاد می‌ذارم». **payoff-first**: «نتیجه رو ببین، بعد بگم چطوری».
- **موزیک/صدا:** موزیکِ ترندِ بی‌کلام زیرِ گفتار؛ اولین swellِ موزیک روی **ریوالِ هوک**؛ swell/impact زیرِ CTA. صدای گوینده **مطابقِ سناریو** (هیجانی روی هوک، آرام روی توضیح) — با ElevenLabs: stability پایین‌تر (~۰.۳۵) + متنِ هیجانی.
- **فونت:** **Estedad** (Black 900، رایگان/OFL، ترندِ ایرانی) برای کپشن — `avatar_work/edit_assets/fonts/Estedad-Black.woff2`، `@font-face{font-family:'Estedad';src:url('./Estedad-Black.woff2')}`. (Yekan Bakh Heavy بهتر ولی پولیِ fontiran.)
- **کتابخانهٔ asset:** `avatar_work/edit_assets/` (manifest.json): **موزیک** ۶ مود (cinematic/energetic/corporate/uplifting/calm/tense) + **SFX** (whoosh×۳/swoosh/impact×۳/braam/riser/pop) + **فونت**. منبع: **Mixkit** (`assets.mixkit.co/music/<ID>/<ID>.mp3` و `/active_storage/sfx/<ID>/<ID>.wav` — از سرور با curl+UA کار می‌کند، تجاری-مجاز بدون attribution). ⚠️ `music66.mp3` قدیمی **سکوت** بود (−۵۷dB) — هرگز استفاده نشود.
- **داکینگِ موزیک زیرِ صدا:** `[music][voice]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300` تا در شکافِ گفتار بلند و زیرِ گفتار کم شود. موزیکِ شنیدنی الزامی.

## ۱۲) اصلاحِ ریشه‌ایِ گفتارِ فارسی (ElevenLabs) + موتورِ MLT
- **علتِ «روون نبودنِ» گفتار:** مدلِ `eleven_v3` (آلفا/ناپایدار) + stabilityِ پایین (۰.۳). **راه‌حلِ سیستمی (در همهٔ پایپ‌لاین‌ها):**
  - مدل = **`eleven_multilingual_v2`** (پایدار برای فارسی؛ نه v3/Flash/Turbo).
  - voice_settings: **stability 0.62**، similarity_boost 0.80، style 0.0، use_speaker_boost true. (stability پایین = سلیس‌خوریِ تلفظ.)
  - **normalize_fa() روی هر متن:** حروفِ عربی→فارسی (ك→ک، ي→ی، ة→ه)؛ حذفِ اعرابِ سرگردان `[ً-ْٰ]`؛ نیم‌فاصلهٔ تکراری/کنارِ‌فاصله اصلاح (نیم‌فاصلهٔ بامعنا حفظ شود)؛ برندِ لاتین (CoinePro/Forex) برای تلفظِ درست؛ **اعداد همیشه به‌حروف** (هفت/نود/صدوشصت) — مهم‌ترین منبعِ غلط‌خوانی. پانکچوئیشن (، . ؛ …) برای مکث؛ در صورتِ نیاز `<break time="0.4s"/>`. (در `make_video.py` اعمال شد.)
  - گزینهٔ بهترِ فارسی از v2 وجود ندارد برای صدای کلون‌شده؛ XTTS-v2 (CPU) کندتر/ضعیف‌تر.
- **موتورِ هم‌سطحِ CapCut روی سرور = MLT/`melt`** (موتورِ پشتِ Kdenlive/Shotcut): headless، **CPU**، `apt install melt frei0r-plugins`، تایم‌لاینِ XML (`<producer>/<playlist>/<tractor>/<transition>/<filter>` کی‌فریم‌دار) + ۱۰۰+ افکتِ frei0r. مثال: `melt project.mlt -consumer avformat:out.mp4 vcodec=libx264 b=8000k`. نزدیک‌ترین به CapCut برای تایم‌لاینِ برنامه‌نویسی‌شده؛ ولی AI auto-edit ندارد (آن فقط SaaS است). فیلترهای movit فقط GPU — استفاده نشود. جایگزین‌ها: Blender VSE (headless/CPU، سنگین)، Remotion/Revideo (موشن‌گرافیِ متحرک، نه NLE). **تصمیم:** پایپ‌لاینِ Chromium+ffmpeg فعلی نگه‌داشته شود؛ MLT برای تایم‌لاین/افکتِ پیچیده‌ترِ آینده.
- **بیت-سینک با librosa (پیاده شد):** `librosa.beat.beat_track(units='time')` → snapِ whoosh/flashِ ترانزیشن روی نزدیک‌ترین بیت (±۰.۲s)، بدونِ شکستنِ سینکِ کپشن با گفتار.

**وضعیتِ نمره‌دهیِ مالک:** تخت ۵۰ → فوتیجِ سینمایی ۷۰ → v3 (teal-orange+Hormozi+SFX) ۷۵ → v4 (موزیکِ واقعی+خودمونی+Estedad+ساند) ۸۰. کسرِ ۲۰: موزیک −۲۰٪، گفتارِ ریشه‌ایِ روون (v2+normalize)، استفادهٔ واقعی از ابزار (librosa بیت-سینک، MLT). هدف: ۱۰۰.
**اصلاحاتِ بازخوردِ مالک که حتماً اعمال شود:** (۱) برندِ لاتین در متنِ TTS (`CoinePro/Forex`) برای تلفظِ درست. (۲) **حذفِ ایموجیِ کارتونیِ فانتزی** → المانِ مینیمالِ حرفه‌ای. (۳) فوتیجِ ویدیوییِ متحرک (مالک پسندید) نگه‌داشته شود. (۴) ادیتِ دقیق‌تر/سینک‌تر.
