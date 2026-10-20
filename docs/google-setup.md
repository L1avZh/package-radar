# הגדרת חיבור Gmail (Google OAuth Client ID)

זה נדרש פעם אחת, למי שמפעיל את האתר. לוקח בערך 10 דקות.

1. נכנסים ל‑https://console.cloud.google.com ויוצרים פרויקט חדש, למשל `package-radar`.
2. **APIs & Services → Library:** מחפשים **Gmail API** ולוחצים **Enable**.
3. **Google Auth Platform → Branding:** ממלאים שם אפליקציה ("רדאר חבילות"), מייל תמיכה, וקישורים:
   - Home page: `https://l1avzh.github.io/package-radar/`
   - Privacy policy: `https://github.com/L1avZh/package-radar/blob/main/PRIVACY.md`
4. **Audience:** בוחרים **External**. בשלב Testing מוסיפים תחת **Test users** את כתובות ה‑Gmail שיורשו להתחבר (עד 100).
5. **Data Access → Add or remove scopes:** מוסיפים `https://www.googleapis.com/auth/gmail.readonly`.
6. **Clients → Create client:** סוג **Web application**.
   - Authorized JavaScript origins: `https://l1avzh.github.io`
   - (לבדיקות מקומיות אפשר להוסיף גם `http://localhost:8080`)
   - Authorized redirect URIs: משאירים ריק.
7. מעתיקים את ה‑Client ID (מסתיים ב‑`.apps.googleusercontent.com`) ומדביקים אותו ב‑`src/config.js`:

   ```js
   export const GOOGLE_CLIENT_ID = '1234-abc.apps.googleusercontent.com';
   ```

   אחרי push, האתר מתעדכן אוטומטית.

## לפתוח לכל העולם

`gmail.readonly` הוא scope מסוג **restricted** אצל Google. כל עוד האפליקציה במצב Testing, רק משתמשי הבדיקה יכולים להתחבר, וגם הם רואים אזהרה ש"האפליקציה לא אומתה". כדי לפתוח לכולם צריך לעבור **verification** של Google, שכולל בדרך כלל גם הערכת אבטחה (CASA) בתשלום. בינתיים, כל משתמש יכול:

- לייבא קובצי ‎`.eml` או להוסיף חבילות ידנית, בלי Google בכלל, או
- ליצור Client ID משלו לפי ההוראות כאן ולהדביק אותו תחת "הגדרות מתקדמות" באתר. בצורה הזו הוא משתמש באפליקציה של עצמו.
