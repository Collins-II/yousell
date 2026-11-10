This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

On the home page, scroll the region cards horizontally and select a region to
open its listings on the map. The map shows listings with a location pin; region
counts can include listings without one. Search and listing-type filters remain
scoped to the selected region until you choose "View all locations".

## Production setup

Set `MONGODB_URL` (or `MONGODB_URI`) and a strong `AUTH_SECRET` in the
deployment's Production environment, then redeploy. The app reads the
`yousell` database on the configured MongoDB server; local `.env` values and
local data are not automatically copied to Vercel. Ensure that database
contains the intended listings and users, and that the deployment can reach it
(including MongoDB Atlas network access rules and database user permissions).
If the connection uses a `mongodb+srv` URI, the deployment must also be able
to resolve its SRV records. Leave `MONGODB_DNS_SERVERS` unset unless those DNS
servers are reachable from the deployment environment.
Do not run the demo seed script against production data.

If listings or sign-in fail, inspect the Vercel deployment's runtime logs for
the server error and use the error reference shown on the page to correlate it.
Do not share connection strings, credentials, or tokens in logs or support
requests.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
