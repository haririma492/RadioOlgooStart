// test-dynamodb.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
require("dotenv").config();

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "ca-central-1" })
);

async function test() {
  try {
    const result = await ddb.send(
      new ScanCommand({
        TableName: process.env.DDB_TABLE_NAME,
        Limit: 1, // Just get 1 item
      })
    );
    console.log("✅ Connection successful!");
    console.log("📊 Sample item:", JSON.stringify(result.Items[0], null, 2));
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error("Full error:", err);
  }
}

test();