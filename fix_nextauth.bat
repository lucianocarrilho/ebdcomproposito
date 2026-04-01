@echo off
echo https://ebd-app.vercel.app> nextauth.txt
npx vercel env rm NEXTAUTH_URL production -y
npx vercel env rm NEXTAUTH_URL preview -y
npx vercel env add NEXTAUTH_URL production < nextauth.txt
npx vercel env add NEXTAUTH_URL preview < nextauth.txt
del nextauth.txt
npx vercel --prod --yes
