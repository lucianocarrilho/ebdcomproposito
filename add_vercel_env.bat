@echo off
echo mysql://u223033896_ebd2026:Eulk2180263#@srv890.hstgr.io:3306/u223033896_ebd2026> db.txt
npx vercel env add DATABASE_URL production < db.txt
npx vercel env add DATABASE_URL preview < db.txt
npx vercel env add DATABASE_URL development < db.txt

echo https://ebdcomproposito.com.br> nextauth.txt
npx vercel env add NEXTAUTH_URL production < nextauth.txt
npx vercel env add NEXTAUTH_URL preview < nextauth.txt

echo ebd-com-proposito-secret-key-2026> secret.txt
npx vercel env add AUTH_SECRET production < secret.txt
npx vercel env add AUTH_SECRET preview < secret.txt

echo true> trust.txt
npx vercel env add AUTH_TRUST_HOST production < trust.txt
npx vercel env add AUTH_TRUST_HOST preview < trust.txt

del db.txt nextauth.txt secret.txt trust.txt
echo DONE
