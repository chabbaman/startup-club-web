Startup Club is a [Next.js](https://nextjs.org) app for managing club activities and board history.

## Live polls

In Teacher view, use **Create a poll** to publish a question with 2–4 choices.
Open polls appear in a floating card in the bottom-right corner of both dashboard
views for all signed-in club members, without taking up space above the board.
Members select a choice and press **Vote** once; votes cannot be changed.
Convex withholds all results until the caller has voted, including teachers,
then streams updated counts and percentages as other members vote.

Teachers can use **End poll** to close voting and remove the poll from the screen.
The floating card is hidden when there are no active polls.
No member-facing API exposes other voters' identities.

Run `bun run test` for poll access, validation, duplicate-vote, and result-privacy
checks. Run `bunx convex dev --once` to sync the schema and functions to your
development deployment before trying polls locally.

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Production uses two deployments: the Next.js frontend on Vercel and the Convex
backend. Pushing to GitHub republishes the frontend, but does not deploy Convex
functions or schema changes.

Before pushing a release that changes `convex/`, publish the backend first:

```bash
bun run lint
bun run build
bun run deploy:backend
git push origin main
```

Confirm the Convex production target is `diligent-robin-100`. Vercel's production
`NEXT_PUBLIC_CONVEX_URL` must be `https://diligent-robin-100.convex.cloud`.
After deployment, open Teacher view and verify Roles, Members, and Version history
load. A missing `history:list` production function causes Teacher view to crash
even when the frontend build succeeds.

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
