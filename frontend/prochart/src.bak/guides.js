// راهنمای جامعِ درون‌اپِ آکادمی — محتوا در دو فایل (یادگیری/ابزارها) و اینجا ادغام می‌شود.
// شکلِ هر راهنما:
//   key: { title, intro, features: [{ name, what, how:[steps], tip }] }
import { GUIDES_LEARN } from './guides.learn';
import { GUIDES_TOOLS } from './guides.tools';

export const GUIDES = { ...GUIDES_LEARN, ...GUIDES_TOOLS };
