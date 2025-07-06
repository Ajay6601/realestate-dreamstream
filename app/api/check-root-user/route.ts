import { NextRequest, NextResponse } from "next/server";
import { isRootUser } from "@/lib/server-utils/invite-server-utils";

export async function GET(request: NextRequest) {
  try {
    const rootUser = await isRootUser();

    return NextResponse.json({
      isRootUser: rootUser,
    });
  } catch (error) {
    console.error("Error checking root user:", error);
    return NextResponse.json({ isRootUser: false }, { status: 500 });
  }
}
