@echo off
echo y | npx vercel env rm NEXTAUTH_URL production
echo y | npx vercel env rm DATABASE_URL production
echo y | npx vercel env rm AUTH_SECRET production
echo y | npx vercel env rm AUTH_TRUST_HOST production

echo https://ebd-app.vercel.app> nextauth.txt
npx vercel env add NEXTAUTH_URL production < nextauth.txt

echo mysql://u223033896_ebd2026:Eulk2180263#@srv890.hstgr.io:3306/u223033896_ebd2026> db.txt
npx vercel env add DATABASE_URL production < db.txt

echo ebd-com-proposito-secret-key-2026> secret.txt
npx vercel env add AUTH_SECRET production < secret.txt

echo true> trust.txt
npx vercel env add AUTH_TRUST_HOST production < trust.txt

npx vercel build --yes --prod
npx vercel deploy --prebuilt --prod
