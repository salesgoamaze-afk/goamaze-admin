import { NextResponse } from "next/server";

const TOKEN_URL = "https://api.amazon.co.uk/auth/o2/token";
const API_URL = "https://creatorsapi.amazon/catalog/v1/getItems";

export async function GET() {
  try {
    // 1. Get OAuth access token
    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: process.env.AMAZON_CLIENT_ID,
        client_secret: process.env.AMAZON_CLIENT_SECRET,
        scope: "creatorsapi::default",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return NextResponse.json(
        {
          error: "Amazon authentication failed",
          details: tokenData,
        },
        { status: tokenResponse.status }
      );
    }

    const accessToken = tokenData.access_token;

    // 2. Call Creators API
    const amazonResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-marketplace": "www.amazon.in",
      },
      body: JSON.stringify({
        itemIds: ["B09B2SBHQK",
        "B09B8V1LZ3",
        "B0199980K4",
        "B000HZD168","B0FN41SQQ7"],
        itemIdType: "ASIN",
        marketplace: "www.amazon.in",
        partnerTag: process.env.AMAZON_PARTNER_TAG,

        resources: [
          "images.primary.large",
          "itemInfo.title",
          "itemInfo.features",
          "offersV2.listings.price",
        ],
      }),
    });

    const amazonData = await amazonResponse.json();

    if (!amazonResponse.ok) {
      return NextResponse.json(
        {
          error: "Amazon API request failed",
          details: amazonData,
        },
        { status: amazonResponse.status }
      );
    }

    // 3. Return Amazon data to your frontend
    return NextResponse.json(amazonData);

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}