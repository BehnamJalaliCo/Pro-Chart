// بیومتریک (اثرِ انگشت/چهره) — پلاگینِ نیتیوِ Capacitor. روی وب/دسکتاپ بی‌صدا غیرفعال.
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

const KEY = 'pc_biometric_v1';
export function bioEnabled() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
export function setBioEnabled(v) { try { if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) { /* noop */ } }

// آیا دستگاه بیومتریک دارد و ثبت شده است؟
export async function bioAvailable() {
  try { const r = await NativeBiometric.isAvailable(); return !!(r && r.isAvailable); } catch (e) { return false; }
}
// نوعِ بیومتریک (اثرِ انگشت/چهره) برای متنِ UI
export async function bioType() {
  try { const r = await NativeBiometric.isAvailable(); return r && r.biometryType; } catch (e) { return null; }
}
// نمایشِ دیالوگِ سیستمی؛ true = موفق
export async function bioVerify(reason) {
  try {
    await NativeBiometric.verifyIdentity({ reason: reason || 'Unlock Pro-Chart', title: 'Pro-Chart', subtitle: '', description: '' });
    return true;
  } catch (e) { return false; }
}
