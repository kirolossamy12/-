# عجلة القرعة (سيرفر)

## تشغيل محلي
node server.js
ثم افتح http://localhost:3000  (رابط الأدمن بيظهر في الـ Terminal)

## متغيرات البيئة
- ADMIN_KEY : كلمة سر صفحة الإدارة (/admin?key=...)  -- لازم تحطها
- NAMES     : الأسماء الابتدائية مفصولة بـ |  (اختياري)
- PORT      : بتتحط لوحدها على أغلب الاستضافات

## رفع على Render (مجاني)
1. ارفع الفولدر على GitHub.
2. Render > New > Web Service > اختار الريبو.
3. Build Command: (سيبه فاضي)   Start Command: node server.js
4. Environment: ضيف ADMIN_KEY بقيمة من عندك.
5. بعد النشر: اللينك الرئيسي لصحابك، و /admin?key=كلمتك ليك إنت.
