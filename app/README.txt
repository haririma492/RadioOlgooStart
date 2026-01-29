# Extract into your project's app/ folder

This zip is meant to be extracted into:
  <your-project-root>/app

After extracting, you should have:
  app/admin/page.tsx
  app/api/admin/presign/route.ts
  app/api/admin/slides/route.ts

Next steps:
1) Install deps:
   npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

2) Add to .env.local (project root):
   NEXT_PUBLIC_S3_PUBLIC_BASE=...
   AWS_REGION=ca-central-1
   S3_BUCKET=...
   DDB_TABLE_NAME=RadioOlgooSlides
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ADMIN_TOKEN=...

3) Restart:
   npm run dev

Then open:
  http://localhost:3000/admin
