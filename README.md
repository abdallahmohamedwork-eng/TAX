# منظومة VOY / GLORY / ROLAND TAX

نسخة Web App جاهزة للرفع على Vercel أو Netlify.

## المميزات
- Dashboard عربي
- GLORY TAX بمعادلة البيع/المشتريات
- ROLAND TAX بمعادلة البيع/المشتريات
- VOY TAX بإدخال هدف الشراء مباشرة
- إدارة محمد رجائي ومصطفى رجائي
- رفع صورة البطاقة الضريبية لكل طرف
- إدارة الأصناف
- إنشاء فواتير بيع/شراء
- ضريبة 14% تضاف بعد الإجمالي
- رفع صور مرفقة مع الفاتورة
- تصدير PDF
- تصدير Excel
- حفظ محلي LocalStorage
- مزامنة اختيارية مع Supabase Free

## التشغيل محليًا
```bash
npm install
npm run dev
```

## الرفع المجاني
### 1) Supabase
- Create Project
- SQL Editor
- شغّل ملف `schema.sql`
- هات `Project URL` و `anon key`

### 2) Vercel
- ارفع المشروع على GitHub
- Import Project من Vercel
- Add Environment Variables:
```env
VITE_SUPABASE_URL=your-url
VITE_SUPABASE_ANON_KEY=your-key
```
- Deploy

## ملاحظة مهمة
الصور المرفوعة تحفظ داخل بيانات التطبيق كـ Base64. مناسب كبداية ولفواتير قليلة. لو الاستخدام هيكون كبير جدًا، يفضل نقل الصور إلى Supabase Storage في مرحلة تطوير لاحقة.
