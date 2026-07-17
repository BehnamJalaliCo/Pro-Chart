//+------------------------------------------------------------------+
//|                                        CoineProAutoTrader.mq5     |
//|   اتو-تریدرِ سیگنال‌های کوین‌پرو — باز/مدیریتِ خودکار با           |
//|   سربه‌سر در TP1 + تریلینگ‌استاپ (قفلِ سود) + حجمِ ریسک‌محور.       |
//|   سیگنال‌ها از coinepro_signals.csv و تنظیمات از                  |
//|   coinepro_ea_settings.txt (کنترل‌شده از پنلِ ادمین) خوانده می‌شوند.|
//+------------------------------------------------------------------+
#property copyright "CoinePro FX"
#property version   "1.5"
#property strict

#include <Trade/Trade.mqh>

// ورودی‌ها = مقادیرِ پیش‌فرض؛ پنلِ ادمین می‌تواند هنگامِ اجرا اوریرایدشان کند.
input long   MagicNumber            = 20260608;
input string SignalsFile            = "coinepro_signals.csv";
input string SettingsFile           = "coinepro_ea_settings.txt";
input bool   UseCommon              = true;   // مَستر=true (فایلِ مشترک)؛ ترمینالِ کاربر=false (لوکالِ ایزوله)
input int    PollSeconds            = 5;
input double def_RiskPercent        = 1.0;
input double def_FixedLots          = 0.0;
input double def_MaxLot             = 5.0;
input int    def_MaxOpenTrades      = 10;
input string def_SymbolSuffix       = "";
input bool   def_SetTPtoTP3         = true;
input bool   def_BreakevenAtTP1     = true;
input double def_BreakevenBufferFrac= 0.10;
input bool   def_UseTrailing        = true;
input double def_TrailStartFrac     = 1.0;
input double def_TrailDistanceFrac  = 0.5;
input bool   def_CloseOnSignalGone  = true;
input int    def_MaxSpreadPoints    = 0;

// تنظیماتِ فعال (از فایل اوریراید می‌شوند)
bool   g_enabled       = false;
double g_risk          = 1.0;
double g_fixedLots     = 0.0;
double g_maxLot        = 5.0;
int    g_maxTrades     = 10;
string g_suffix        = "";
bool   g_setTP3        = true;
bool   g_beTP1         = true;
double g_beBuf         = 0.10;
bool   g_trail         = true;
double g_trailStart    = 1.0;
double g_trailDist     = 0.5;
bool   g_closeGone     = true;
int    g_maxSpread     = 0;
string g_allowed       = "";
int    g_maxDailyTr    = 0;
double g_maxDailyLoss  = 0.0;
long   g_closeAllId    = 0;

long   g_lastCloseAll  = 0;
bool   g_ccInit        = false;   // باراولِ خواندنِ close_all_id فقط baseline می‌گیرد (نه بستن/سرکوب)
int    g_dayTrades     = 0;
double g_dayStartBal   = 0.0;
long   g_expectedLogin = 0;     // گاردِ حساب: فقط روی این لاگین ترید کن (۰=غیرفعال)
int    g_curDay        = -1;
string StatusFile      = "coinepro_ea_status.txt";
string DealsFile       = "coinepro_ea_deals.txt";   // دیلِ بسته‌شدهٔ واقعی (سود/کمیسیون/سواپ)
datetime g_lastDealTime = 0;            // آخرین زمانِ دیلِ گزارش‌شده (جلوگیری از تکرار)
string SpecsFile       = "coinepro_ea_specs.txt";   // مشخصاتِ واقعیِ نماد (contract/tick/spread)
string SymbolsFile     = "coinepro_ea_symbols.txt"; // کلِ لیستِ نمادهای بروکر (یک‌بار، برای نگاشتِ نام)
bool   g_symbolsDumped = false;
datetime g_lastSpecTime = 0;            // آخرین زمانِ گزارشِ مشخصات
int    g_commonFlag    = FILE_COMMON;   // در OnInit بر اساسِ UseCommon ست می‌شود

CTrade trade;

struct Sig { long id; string symbol; string action; double entry; double sl; double tp1; double tp2; double tp3; double trail_sl; double risk_mult; };
Sig    g_sigs[];

// idهای سرکوب‌شده: پس از «بستنِ همه»، سیگنال‌های فعلی نباید دوباره باز شوند
// (تا وقتی از فید حذف شوند). سیگنال‌های واقعاً جدید سرکوب نمی‌شوند.
long   g_suppressed[];
long   g_opened[];        // idهایی که این EA در این نشست باز کرده (برای anti-reopen)

bool IsSuppressed(long id)
{ for(int i=0;i<ArraySize(g_suppressed);i++) if(g_suppressed[i]==id) return(true); return(false); }

void AddSuppressed(long id)
{ if(IsSuppressed(id)) return; int n=ArraySize(g_suppressed); ArrayResize(g_suppressed,n+1); g_suppressed[n]=id; }

bool IsOpened(long id)
{ for(int i=0;i<ArraySize(g_opened);i++) if(g_opened[i]==id) return(true); return(false); }

void MarkOpened(long id)
{ if(IsOpened(id)) return; int n=ArraySize(g_opened); ArrayResize(g_opened,n+1); g_opened[n]=id; }

// همهٔ پوزیشن‌های موجود (با magicِ ما) را در g_opened ثبت می‌کند — شاملِ پوزیشن‌هایی
// که این نشستِ EA بازشان نکرده (مثلاً بعد از recompile/re-attach ارث رسیده‌اند).
// بدونِ این، بستنِ دستیِ یک پوزیشنِ ارث‌رسیده توسطِ SuppressExternallyClosed پوشش
// داده نمی‌شد و OpenNew دوباره بازش می‌کرد (باگِ بحرانیِ re-open).
void SyncOpenedFromPositions()
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong t=PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetInteger(POSITION_MAGIC)!=MagicNumber) continue;
      long id=IdFromComment(PositionGetString(POSITION_COMMENT));
      if(id>0) MarkOpened(id);
   }
}

// anti-reopen: اگر پوزیشنِ یک idِ بازشده ناپدید شده ولی سیگنال هنوز فعال است،
// یعنی بیرونی بسته شده (دستی توسط کاربر/ادمین یا SL/TP بروکر) → سرکوب کن تا
// OpenNew دوباره بازش نکند. فقط idِ واقعاً تازه (که هرگز باز نشده) باز می‌شود.
void SuppressExternallyClosed()
{
   for(int i=0;i<ArraySize(g_opened);i++)
   {
      long id=g_opened[i];
      if(IsSuppressed(id)) continue;
      if(SignalActive(id) && !HasPosition(id))
      {
         AddSuppressed(id);
         Print("anti-reopen: پوزیشنِ #",id," بیرونی بسته شد و سیگنال هنوز فعال است → سرکوب (دوباره باز نمی‌شود)");
      }
   }
}

// idهای سرکوب‌شده‌ای که دیگر در فیدِ سیگنال نیستند را پاک کن (housekeeping)
void PruneSuppressed()
{
   long keep[]; int kn=0;
   for(int i=0;i<ArraySize(g_suppressed);i++)
   {
      if(SignalActive(g_suppressed[i])) { ArrayResize(keep,kn+1); keep[kn]=g_suppressed[i]; kn++; }
   }
   ArrayFree(g_suppressed);
   if(kn>0){ ArrayResize(g_suppressed,kn); for(int j=0;j<kn;j++) g_suppressed[j]=keep[j]; }
}

//+------------------------------------------------------------------+
int OnInit()
{
   g_risk=def_RiskPercent; g_fixedLots=def_FixedLots; g_maxLot=def_MaxLot;
   g_maxTrades=def_MaxOpenTrades; g_suffix=def_SymbolSuffix; g_setTP3=def_SetTPtoTP3;
   g_beTP1=def_BreakevenAtTP1; g_beBuf=def_BreakevenBufferFrac; g_trail=def_UseTrailing;
   g_trailStart=def_TrailStartFrac; g_trailDist=def_TrailDistanceFrac;
   g_closeGone=def_CloseOnSignalGone; g_maxSpread=def_MaxSpreadPoints;
   g_commonFlag = UseCommon ? FILE_COMMON : 0;
   // ایزولاسیونِ قطعیِ per-user: اگر این ترمینالِ کپیِ کاربر است (مسیرِ portable در
   // mt5_users\<id> یا CoinePro\users\<id>) فایلِ لوکالِ ایزوله استفاده شود.
   // باگِ قبلی: شرطِ عمومیِ "\users\" مسیرِ Wineِ مَستر (C:\users\root\AppData\…) را هم
   // می‌گرفت و مَستر را اشتباهی local می‌کرد → close-all/آپدیتِ config (که bridge روی
   // common می‌نویسد) به مَستر نمی‌رسید. حالا فقط مسیرِ خاصِ کپی را می‌گیریم.
   string l_dataPath = TerminalInfoString(TERMINAL_DATA_PATH);
   StringToLower(l_dataPath);
   if(StringFind(l_dataPath, "\\mt5_users\\") >= 0 || StringFind(l_dataPath, "coinepro\\users\\") >= 0)
      g_commonFlag = 0;
   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(30);
   EventSetTimer(MathMax(1, PollSeconds));
   Print("CoineProAutoTrader v1.5 — Magic=", MagicNumber, " commonFlag=", g_commonFlag);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer()
{
   ReadSettings();
   DailyReset();
   ReadSignals();                // اول سیگنال‌های تازه را بخوان
   PruneSuppressed();            // idهای سرکوب‌شده‌ای که دیگر در فید نیستند را پاک کن
   CheckCloseAll();              // فرمانِ بستنِ همه از پنل (+ سرکوبِ سیگنال‌های فعلی)
   ManageOpen();                 // مدیریتِ موجودها (سربه‌سر/تریل/بستن)
   SyncOpenedFromPositions();    // همهٔ پوزیشن‌های موجود (شاملِ ارث‌رسیده) را ردگیری کن
   SuppressExternallyClosed();   // anti-reopen: پوزیشنِ دستی‌بسته‌شده دوباره باز نشود
   if(g_enabled && DailyGuardOK()) OpenNew();  // معاملهٔ جدید فقط با مجوزِ روشن + گاردِ روزانه
   WriteStatus();                // ارسالِ وضعیتِ حساب به پنل
   ReportClosedDeals();          // گزارشِ دیلِ بسته‌شدهٔ واقعی (سود/کمیسیون/سواپ)
   ReportSymbolSpecs();          // گزارشِ مشخصاتِ واقعیِ نماد (contract/tick/spread)
   if(!g_symbolsDumped && SymbolsTotal(false) > 50) ReportBrokerSymbols();  // یک‌بار: کلِ نمادهای بروکر
}

//+------------------------------------------------------------------+
//| dumpِ کلِ نمادهای موجودِ بروکر (یک‌بار) — برای نگاشتِ نامِ نماد       |
//+------------------------------------------------------------------+
void ReportBrokerSymbols()
{
   int tot = SymbolsTotal(false);   // همهٔ نمادهای بروکر، نه فقط Market Watch
   string out = "";
   for(int i=0;i<tot;i++)
   {
      if(i>0) out += "\n";
      out += SymbolName(i, false);
   }
   int h = FileOpen(SymbolsFile, FILE_WRITE|FILE_TXT|FILE_ANSI|g_commonFlag);
   if(h != INVALID_HANDLE){ FileWriteString(h, out); FileClose(h); g_symbolsDumped = true; }
}

//+------------------------------------------------------------------+
//| خواندنِ تنظیمات (key=value) از فایل                              |
//+------------------------------------------------------------------+
void ReadSettings()
{
   int h = FileOpen(SettingsFile, FILE_READ|FILE_TXT|FILE_ANSI|g_commonFlag);
   if(h == INVALID_HANDLE) return;
   while(!FileIsEnding(h))
   {
      string line = FileReadString(h);
      int eq = StringFind(line, "=");
      if(eq < 1) continue;
      string k = StringSubstr(line, 0, eq);
      string v = StringSubstr(line, eq+1);
      StringTrimLeft(k); StringTrimRight(k);
      StringTrimLeft(v); StringTrimRight(v);
      if(k=="enabled")                    g_enabled    = (v=="1");
      else if(k=="risk_percent")          g_risk       = StringToDouble(v);
      else if(k=="fixed_lots")            g_fixedLots  = StringToDouble(v);
      else if(k=="max_lot")               g_maxLot     = StringToDouble(v);
      else if(k=="max_open_trades")       g_maxTrades  = (int)StringToInteger(v);
      else if(k=="symbol_suffix")         g_suffix     = v;
      else if(k=="set_tp_tp3")            g_setTP3     = (v=="1");
      else if(k=="breakeven_at_tp1")      g_beTP1      = (v=="1");
      else if(k=="breakeven_buffer_frac") g_beBuf      = StringToDouble(v);
      else if(k=="use_trailing")          g_trail      = (v=="1");
      else if(k=="trail_start_frac")      g_trailStart = StringToDouble(v);
      else if(k=="trail_distance_frac")   g_trailDist  = StringToDouble(v);
      else if(k=="close_on_signal_gone")  g_closeGone  = (v=="1");
      else if(k=="max_spread_points")     g_maxSpread  = (int)StringToInteger(v);
      else if(k=="allowed_symbols")       g_allowed    = v;
      else if(k=="max_daily_trades")      g_maxDailyTr = (int)StringToInteger(v);
      else if(k=="max_daily_loss_pct")    g_maxDailyLoss = StringToDouble(v);
      else if(k=="close_all_id")          g_closeAllId = (long)StringToInteger(v);
      else if(k=="expected_login")        g_expectedLogin = (long)StringToInteger(v);
   }
   FileClose(h);
}

//+------------------------------------------------------------------+
//| ریست روزانه + گاردِ ضررِ روزانه                                  |
//+------------------------------------------------------------------+
void DailyReset()
{
   MqlDateTime t; TimeToStruct(TimeCurrent(), t);
   if(t.day != g_curDay)
   {
      g_curDay = t.day;
      g_dayTrades = 0;
      g_dayStartBal = AccountInfoDouble(ACCOUNT_BALANCE);
   }
}

bool DailyGuardOK()
{
   if(g_maxDailyTr > 0 && g_dayTrades >= g_maxDailyTr) return(false);
   if(g_maxDailyLoss > 0 && g_dayStartBal > 0)
   {
      double eq = AccountInfoDouble(ACCOUNT_EQUITY);
      double lossPct = (g_dayStartBal - eq) / g_dayStartBal * 100.0;
      if(lossPct >= g_maxDailyLoss) return(false);
   }
   return(true);
}

//+------------------------------------------------------------------+
//| بستنِ همهٔ معاملاتِ ما (فرمانِ پنل)                                |
//+------------------------------------------------------------------+
void CheckCloseAll()
{
   // باراول پس از استارت/ری‌استارت: فقط مقدارِ فعلی را baseline بگیر تا یک «بستنِ همه»ی
   // قدیمیِ ماندگار، با هر ری‌استارتِ ترمینال سیگنال‌ها را کاذب سرکوب نکند (باگِ حیاتیِ چندکاربره).
   if(!g_ccInit) { g_lastCloseAll = g_closeAllId; g_ccInit = true; return; }
   if(g_closeAllId == g_lastCloseAll) return;
   g_lastCloseAll = g_closeAllId;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetInteger(POSITION_MAGIC) == MagicNumber)
      {
         trade.SetTypeFillingBySymbol(PositionGetString(POSITION_SYMBOL));
         trade.PositionClose(t);
      }
   }
   // مهم: سیگنال‌های فعلی را سرکوب کن تا OpenNew بلافاصله دوباره بازشان نکند.
   // فقط سیگنال‌های واقعاً جدید (idِ تازه) پس از این باز می‌شوند.
   for(int k=0;k<ArraySize(g_sigs);k++) AddSuppressed(g_sigs[k].id);
   Print("بستنِ همه اجرا شد (فرمانِ پنل) — ", ArraySize(g_sigs), " سیگنالِ فعلی سرکوب شد");
}

//+------------------------------------------------------------------+
//| نوشتنِ وضعیتِ حساب + پوزیشن‌ها برای پنل                            |
//+------------------------------------------------------------------+
void WriteStatus()
{
   string pos = "";
   double prof = 0;
   int n = 0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      string sym = PositionGetString(POSITION_SYMBOL);
      string dir = (PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY) ? "BUY" : "SELL";
      double vol = PositionGetDouble(POSITION_VOLUME);
      double p   = PositionGetDouble(POSITION_PROFIT);
      double psl = PositionGetDouble(POSITION_SL);       // SLِ واقعیِ روی بروکر (برای نظارت)
      long   pid = IdFromComment(PositionGetString(POSITION_COMMENT));  // idِ سیگنال
      int    dg  = (int)SymbolInfoInteger(sym,SYMBOL_DIGITS);
      if(n>0) pos += "|";
      // فرمت: symbol;dir;vol;profit;sl;id  (سازگار با عقب — مصرف‌کننده اگر sl/id نبود رد می‌کند)
      pos += sym + ";" + dir + ";" + DoubleToString(vol,2) + ";" + DoubleToString(p,2)
           + ";" + DoubleToString(psl,dg) + ";" + (string)pid;
      prof += p; n++;
   }
   string s =
      "connected="     + (TerminalInfoInteger(TERMINAL_CONNECTED)?"1":"0") + "\n" +
      "trade_allowed=" + ((MQLInfoInteger(MQL_TRADE_ALLOWED) && AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))?"1":"0") + "\n" +
      "term_algo="     + (TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)?"1":"0") + "\n" +
      "ea_algo="       + (MQLInfoInteger(MQL_TRADE_ALLOWED)?"1":"0") + "\n" +
      "acct_trade="    + (AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)?"1":"0") + "\n" +
      "acct_expert="   + (AccountInfoInteger(ACCOUNT_TRADE_EXPERT)?"1":"0") + "\n" +
      // نوعِ حساب: 0=DEMO، 1=CONTEST، 2=REAL — سرور حسابِ غیرواقعی را بلاک می‌کند
      "trade_mode="    + (string)AccountInfoInteger(ACCOUNT_TRADE_MODE) + "\n" +
      "account="       + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\n" +
      "broker="        + AccountInfoString(ACCOUNT_COMPANY) + "\n" +
      "currency="      + AccountInfoString(ACCOUNT_CURRENCY) + "\n" +
      "balance="       + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE),2) + "\n" +
      "equity="        + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY),2) + "\n" +
      "margin="        + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN),2) + "\n" +
      "free_margin="   + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE),2) + "\n" +
      "margin_level="  + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL),2) + "\n" +
      "open="          + (string)n + "\n" +
      "profit="        + DoubleToString(prof,2) + "\n" +
      "positions="     + pos + "\n";
   int h = FileOpen(StatusFile, FILE_WRITE|FILE_TXT|FILE_ANSI|g_commonFlag);
   if(h != INVALID_HANDLE) { FileWriteString(h, s); FileClose(h); }
}

bool AllowedSymbol(string sym)
{
   if(StringLen(g_allowed) == 0) return(true);
   return(StringFind("," + g_allowed + ",", "," + sym + ",") >= 0);
}

//+------------------------------------------------------------------+
//| گزارشِ دیلِ بسته‌شدهٔ واقعی (سود ناخالص/کمیسیون/سواپ) به فایل      |
//| سرور idempotent است (بر deal_id) — تکرار مشکلی ندارد.            |
//+------------------------------------------------------------------+
//+------------------------------------------------------------------+
//| گزارشِ مشخصاتِ واقعیِ هر نماد از بروکر (contract_size/tick/spread) |
//| سرور این‌ها را برای محاسبهٔ دقیقِ SL/TP و ارزشِ دلاری استفاده می‌کند |
//+------------------------------------------------------------------+
void ReportSymbolSpecs()
{
   if(g_lastSpecTime != 0 && TimeCurrent() - g_lastSpecTime < 3600) return; // هر ساعت کافی است
   g_lastSpecTime = TimeCurrent();
   string out = "";
   string done = "";
   int cnt = 0;
   for(int i=0;i<ArraySize(g_sigs);i++)
   {
      string base = g_sigs[i].symbol;
      if(StringFind(done, "|"+base+"|") >= 0) continue;
      done += "|"+base+"|";
      string sym = base + g_suffix;
      if(!SymbolSelect(sym, true)) continue;
      double cs = SymbolInfoDouble(sym, SYMBOL_TRADE_CONTRACT_SIZE);
      double ts = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
      double tv = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
      double pt = SymbolInfoDouble(sym, SYMBOL_POINT);
      long   dg = SymbolInfoInteger(sym, SYMBOL_DIGITS);
      long   st = SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL);
      long   sp = SymbolInfoInteger(sym, SYMBOL_SPREAD);
      if(cs<=0 || pt<=0) continue;
      // فرمت (نمادِ پایه، نه با پسوند): symbol;contract;tick_size;tick_value;point;digits;stops;spread
      if(cnt>0) out += "\n";
      out += base+";"+DoubleToString(cs,2)+";"+DoubleToString(ts,8)+";"+DoubleToString(tv,5)+";"
           + DoubleToString(pt,8)+";"+(string)dg+";"+(string)st+";"+(string)sp;
      cnt++;
   }
   if(cnt>0)
   {
      int h=FileOpen(SpecsFile, FILE_WRITE|FILE_TXT|FILE_ANSI|g_commonFlag);
      if(h!=INVALID_HANDLE){ FileWriteString(h, out); FileClose(h); }
   }
}

void ReportClosedDeals()
{
   if(g_lastDealTime==0) g_lastDealTime = TimeCurrent() - 3*86400; // اولین بار: ۳ روزِ اخیر
   datetime from = g_lastDealTime - 1;
   datetime to   = TimeCurrent() + 60;
   if(!HistorySelect(from, to)) return;
   string out = "";
   int cnt = 0;
   datetime maxt = g_lastDealTime;
   int total = HistoryDealsTotal();
   for(int i=0;i<total;i++)
   {
      ulong dt = HistoryDealGetTicket(i);
      if(dt==0) continue;
      if(HistoryDealGetInteger(dt,DEAL_MAGIC)!=MagicNumber) continue;
      if(HistoryDealGetInteger(dt,DEAL_ENTRY)!=DEAL_ENTRY_OUT) continue; // فقط بسته‌شدن
      datetime dtime = (datetime)HistoryDealGetInteger(dt,DEAL_TIME);
      if(dtime <= g_lastDealTime) continue;
      long   posid = HistoryDealGetInteger(dt,DEAL_POSITION_ID);
      string sym   = HistoryDealGetString(dt,DEAL_SYMBOL);
      double vol   = HistoryDealGetDouble(dt,DEAL_VOLUME);
      double profit= HistoryDealGetDouble(dt,DEAL_PROFIT);
      double exitp = HistoryDealGetDouble(dt,DEAL_PRICE);
      // کمیسیون/سواپِ کاملِ معامله = جمعِ هر دو سرِ پوزیشن (ورود+خروج) — مهم برای
      // حساب‌های Raw/ECN که کمیسیون را روی هر سر جدا می‌گیرند.
      double comm  = HistoryDealGetDouble(dt,DEAL_COMMISSION);
      double swp   = HistoryDealGetDouble(dt,DEAL_SWAP);
      long   sigid = -1;   // idِ سیگنال از کامنتِ دیلِ «ورود» (نه دیلِ بستن که کامنتش sl/tp است)
      if(HistorySelectByPosition(posid))
      {
         double cSum=0, sSum=0; int pdt=HistoryDealsTotal();
         for(int k=0;k<pdt;k++){ ulong pd=HistoryDealGetTicket(k);
            cSum += HistoryDealGetDouble(pd,DEAL_COMMISSION);
            sSum += HistoryDealGetDouble(pd,DEAL_SWAP);
            if(HistoryDealGetInteger(pd,DEAL_ENTRY)==DEAL_ENTRY_IN){
               long sid=IdFromComment(HistoryDealGetString(pd,DEAL_COMMENT));
               if(sid>0) sigid=sid;
            }
         }
         comm = cSum; swp = sSum;
         HistorySelect(from, to);   // بازگرداندنِ انتخابِ بیرونی
      }
      if(sigid<=0) sigid = IdFromComment(HistoryDealGetString(dt,DEAL_COMMENT)); // fallback
      long   dtype = HistoryDealGetInteger(dt,DEAL_TYPE);
      string dir   = (dtype==DEAL_TYPE_SELL) ? "buy" : "sell"; // جهتِ پوزیشن = برعکسِ دیلِ بستن
      long   rsn   = HistoryDealGetInteger(dt,DEAL_REASON);
      string rs    = (rsn==DEAL_REASON_SL)?"sl":(rsn==DEAL_REASON_TP)?"tp":(rsn==DEAL_REASON_SO)?"stopout":"manual";
      double bal   = AccountInfoDouble(ACCOUNT_BALANCE);
      // فرمت: deal;pos;signal;symbol;dir;vol;exit;close_time;profit;commission;swap;reason;balance
      if(cnt>0) out += "\n";
      out += (string)dt+";"+(string)posid+";"+(string)sigid+";"+sym+";"+dir+";"
           + DoubleToString(vol,2)+";"+DoubleToString(exitp,8)+";"+(string)(long)dtime+";"
           + DoubleToString(profit,2)+";"+DoubleToString(comm,2)+";"+DoubleToString(swp,2)+";"
           + rs+";"+DoubleToString(bal,2);
      cnt++;
      if(dtime>maxt) maxt=dtime;
   }
   g_lastDealTime = maxt;
   if(cnt>0)
   {
      int h=FileOpen(DealsFile, FILE_WRITE|FILE_TXT|FILE_ANSI|g_commonFlag);
      if(h!=INVALID_HANDLE){ FileWriteString(h, out); FileClose(h); }
   }
}

//+------------------------------------------------------------------+
//| خواندنِ سیگنال‌ها (id;symbol;action;entry;sl;tp1;tp2;tp3)         |
//+------------------------------------------------------------------+
bool ReadSignals()
{
   ArrayFree(g_sigs);
   int h = FileOpen(SignalsFile, FILE_READ|FILE_TXT|FILE_ANSI|g_commonFlag);
   if(h == INVALID_HANDLE) return(false);
   while(!FileIsEnding(h))
   {
      string line = FileReadString(h);
      if(StringLen(line) < 9) continue;
      string p[];
      if(StringSplit(line, ';', p) < 8) continue;
      Sig s;
      s.id=(long)StringToInteger(p[0]); s.symbol=p[1]; s.action=p[2];
      s.entry=StringToDouble(p[3]); s.sl=StringToDouble(p[4]);
      s.tp1=StringToDouble(p[5]); s.tp2=StringToDouble(p[6]); s.tp3=StringToDouble(p[7]);
      // فیلدِ ۹ (اختیاری، سازگار با عقب): SLِ قفل‌شدهٔ سرور (سربه‌سر/تریلینگ)
      s.trail_sl = (ArraySize(p) >= 9) ? StringToDouble(p[8]) : 0.0;
      // فیلدِ ۱۰ (اختیاری): ضریبِ حجمِ تطبیقی (اطمینان×همبستگی). پیش‌فرض ۱.۰
      s.risk_mult = (ArraySize(p) >= 10) ? StringToDouble(p[9]) : 1.0;
      if(s.risk_mult <= 0.0) s.risk_mult = 1.0;
      if(s.id<=0 || s.entry<=0 || s.sl<=0) continue;
      int sz=ArraySize(g_sigs); ArrayResize(g_sigs, sz+1); g_sigs[sz]=s;
   }
   FileClose(h);
   return(true);
}

bool FindSig(long id, Sig &out)
{ for(int i=0;i<ArraySize(g_sigs);i++) if(g_sigs[i].id==id){ out=g_sigs[i]; return(true);} return(false); }
bool SignalActive(long id)
{ for(int i=0;i<ArraySize(g_sigs);i++) if(g_sigs[i].id==id) return(true); return(false); }

long IdFromComment(string c)
{ int pos=StringFind(c,"CP"); if(pos<0) return(-1); return((long)StringToInteger(StringSubstr(c,pos+2))); }

bool HasPosition(long id)
{
   for(int i=PositionsTotal()-1;i>=0;i--){ ulong t=PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetInteger(POSITION_MAGIC)!=MagicNumber) continue;
      if(IdFromComment(PositionGetString(POSITION_COMMENT))==id) return(true);
   } return(false);
}
int CountOpen()
{ int c=0; for(int i=PositionsTotal()-1;i>=0;i--){ ulong t=PositionGetTicket(i);
      if(PositionSelectByTicket(t) && PositionGetInteger(POSITION_MAGIC)==MagicNumber) c++; } return(c); }

double NormalizeLot(double lots,double minL,double maxL,double step)
{ if(step<=0) step=0.01; lots=MathFloor(lots/step)*step; if(lots<minL)lots=minL;
  if(g_maxLot>0 && lots>g_maxLot) lots=g_maxLot; if(lots>maxL)lots=maxL; return(NormalizeDouble(lots,2)); }

double CalcLots(string sym,double entry,double sl,double riskMult=1.0)
{
   if(riskMult<=0.0) riskMult=1.0;
   double minLot=SymbolInfoDouble(sym,SYMBOL_VOLUME_MIN);
   double maxLot=SymbolInfoDouble(sym,SYMBOL_VOLUME_MAX);
   double step =SymbolInfoDouble(sym,SYMBOL_VOLUME_STEP);
   if(g_fixedLots>0) return(NormalizeLot(g_fixedLots*riskMult,minLot,maxLot,step));
   double bal=AccountInfoDouble(ACCOUNT_BALANCE);
   double riskMoney=bal*g_risk/100.0*riskMult;   // فاز ۴: حجمِ تطبیقی
   double slDist=MathAbs(entry-sl);
   double tickVal=SymbolInfoDouble(sym,SYMBOL_TRADE_TICK_VALUE);
   double tickSize=SymbolInfoDouble(sym,SYMBOL_TRADE_TICK_SIZE);
   if(slDist<=0||tickVal<=0||tickSize<=0) return(minLot);
   double lossPerLot=slDist/tickSize*tickVal;
   if(lossPerLot<=0) return(minLot);
   return(NormalizeLot(riskMoney/lossPerLot,minLot,maxLot,step));
}

void OpenNew()
{
   // گاردِ تطبیقِ حساب: اگر ترمینال روی حسابِ موردِانتظار نیست (مثلِ دموی پیش‌فرضِ
   // MetaQuotes در cold-startِ reprovision، یا شکستِ loginِ بروکر) → هرگز ترید نکن.
   if(g_expectedLogin>0 && (long)AccountInfoInteger(ACCOUNT_LOGIN)!=g_expectedLogin)
   {
      static datetime _lastAcctWarn=0;
      if(TimeCurrent()-_lastAcctWarn>60){
         Print("گاردِ حساب: ACCOUNT_LOGIN=",AccountInfoInteger(ACCOUNT_LOGIN),
               " != expected=",g_expectedLogin," → ترید متوقف تا حسابِ درست");
         _lastAcctWarn=TimeCurrent();
      }
      return;
   }
   for(int i=0;i<ArraySize(g_sigs);i++)
   {
      Sig s=g_sigs[i];
      if(HasPosition(s.id)) continue;
      if(IsSuppressed(s.id)) continue;   // پس از «بستنِ همه» دوباره باز نشود
      if(!AllowedSymbol(s.symbol)) continue;
      if(CountOpen()>=g_maxTrades) break;
      string sym=s.symbol+g_suffix;
      if(!SymbolSelect(sym,true)){ Print("نماد یافت نشد: ",sym); continue; }
      if(g_maxSpread>0 && SymbolInfoInteger(sym,SYMBOL_SPREAD)>g_maxSpread) continue;
      double lots=CalcLots(sym,s.entry,s.sl,s.risk_mult);
      if(lots<=0) continue;
      int dg=(int)SymbolInfoInteger(sym,SYMBOL_DIGITS);
      double sl=NormalizeDouble(s.sl,dg);
      double tp=g_setTP3 ? NormalizeDouble(s.tp3,dg) : 0.0;
      string cmt="CP"+(string)s.id;
      trade.SetTypeFillingBySymbol(sym);   // filling mode سازگار با همین نماد/بروکر (FOK/IOC/Return)
      bool ok = (s.action=="BUY") ? trade.Buy(lots,sym,0.0,sl,tp,cmt)
                                  : trade.Sell(lots,sym,0.0,sl,tp,cmt);
      if(ok) {
         g_dayTrades++; MarkOpened(s.id);
         // لنگرِ TP/SL به قیمتِ واقعیِ پر‌شدن: سفارش روی قیمتِ زنده پر می‌شود (نه entryِ سیگنال)؛
         // اگر TP/SLِ مطلقِ سیگنال بماند، فاصلهٔ واقعیِ R به‌اندازهٔ (fill−entry)+اسپرد جابه‌جا می‌شود
         // و کاربر می‌بیند «TP بالاتر/پایین‌تر ست شده». → فاصله را حفظ کن، نه قیمتِ مطلق را.
         double fill=trade.ResultPrice();
         if(fill>0){
            double slD=MathAbs(s.entry-s.sl);
            double aSL=NormalizeDouble((s.action=="BUY")?fill-slD:fill+slD,dg);
            double aTP=0.0;
            if(g_setTP3){ double tpD=MathAbs(s.tp3-s.entry); aTP=NormalizeDouble((s.action=="BUY")?fill+tpD:fill-tpD,dg); }
            ulong deal=trade.ResultDeal();
            if(deal>0 && HistorySelect(TimeCurrent()-120,TimeCurrent()+1)){
               long posid=(long)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
               if(posid>0 && PositionSelectByTicket(posid)){
                  if(!trade.PositionModify((ulong)posid,aSL,aTP))
                     Print("لنگرِ TP/SL رد شد #",s.id," ret=",trade.ResultRetcode());
               }
            }
         }
         Print("باز شد ",s.action," ",sym," lots=",lots," #",s.id);
      }
      else   Print("خطا باز کردن ",sym," ",trade.ResultRetcodeDescription());
   }
}

bool ImprovesSL(long type,double oldSL,double newSL)
{ if(newSL<=0) return(false);
  if(type==POSITION_TYPE_BUY) return(oldSL<=0||newSL>oldSL);
  return(oldSL<=0||newSL<oldSL); }

void ManageOpen()
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetInteger(POSITION_MAGIC)!=MagicNumber) continue;
      string sym=PositionGetString(POSITION_SYMBOL);
      long id=IdFromComment(PositionGetString(POSITION_COMMENT));
      long type=PositionGetInteger(POSITION_TYPE);
      double entry=PositionGetDouble(POSITION_PRICE_OPEN);
      double curSL=PositionGetDouble(POSITION_SL);
      double curTP=PositionGetDouble(POSITION_TP);
      int dg=(int)SymbolInfoInteger(sym,SYMBOL_DIGITS);

      if(g_closeGone && id>0 && !SignalActive(id)){ trade.SetTypeFillingBySymbol(sym); trade.PositionClose(ticket); continue; }

      Sig s; if(!(id>0 && FindSig(id,s))) continue;
      double tp1dist=MathAbs(s.tp1-entry);
      if(tp1dist<=0) continue;
      double bid=SymbolInfoDouble(sym,SYMBOL_BID), ask=SymbolInfoDouble(sym,SYMBOL_ASK);
      double price=(type==POSITION_TYPE_BUY)?bid:ask;
      double prog =(type==POSITION_TYPE_BUY)?(price-entry):(entry-price);
      double newSL=curSL;

      if(g_beTP1 && prog>=tp1dist){
         double be=(type==POSITION_TYPE_BUY)?entry+tp1dist*g_beBuf:entry-tp1dist*g_beBuf;
         if(ImprovesSL(type,newSL,be)) newSL=be;
      }
      if(g_trail && prog>=tp1dist*g_trailStart){
         double tsl=(type==POSITION_TYPE_BUY)?price-tp1dist*g_trailDist:price+tp1dist*g_trailDist;
         if(ImprovesSL(type,newSL,tsl)) newSL=tsl;
      }
      // SLِ قفل‌شدهٔ سرور (سربه‌سر/تریلینگ پس از TP1): مرجعِ معتبر — حتی اگر منطقِ
      // لحظه‌ایِ بالا تاچِ کوتاهِ TP1 را از دست داده باشد، سرور آن را قفل کرده و
      // اینجا اعمال می‌شود. فقط در جهتِ بهبود (ImprovesSL).
      if(s.trail_sl>0 && ImprovesSL(type,newSL,s.trail_sl)) newSL=s.trail_sl;
      if(newSL!=curSL && newSL>0){
         newSL=NormalizeDouble(newSL,dg);
         // گاردِ stops-level/freeze: اگر SLِ جدید از حدِ مجازِ بروکر به قیمت نزدیک‌تر باشد،
         // PositionModify سایلنت رد می‌شد (خطای 10016) و سربه‌سر/تریلینگ هرگز اعمال نمی‌شد.
         // → SL را تا نزدیک‌ترین فاصلهٔ معتبر هل بده، نه اینکه رد کنی.
         double pt=SymbolInfoDouble(sym,SYMBOL_POINT);
         double minStop=(double)SymbolInfoInteger(sym,SYMBOL_TRADE_STOPS_LEVEL)*pt;
         double frz=(double)SymbolInfoInteger(sym,SYMBOL_TRADE_FREEZE_LEVEL)*pt;
         double guard=MathMax(minStop,frz);
         if(guard>0){
            if(type==POSITION_TYPE_BUY  && price-newSL<guard) newSL=NormalizeDouble(price-guard,dg);
            if(type==POSITION_TYPE_SELL && newSL-price<guard) newSL=NormalizeDouble(price+guard,dg);
         }
         bool valid=(type==POSITION_TYPE_BUY)?(newSL<price && ImprovesSL(type,curSL,newSL))
                                             :(newSL>price && ImprovesSL(type,curSL,newSL));
         if(valid){
            if(!trade.PositionModify(ticket,newSL,curTP))
               Print("PositionModify رد شد #",id," sym=",sym," newSL=",newSL," ret=",trade.ResultRetcode()," ",trade.ResultRetcodeDescription());
         }
      }
   }
}
//+------------------------------------------------------------------+
