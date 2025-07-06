import { type NextRequest, NextResponse } from "next/server";
import { extractNamesFromImage } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;

    if (!image) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image file too large (max 10MB)" },
        { status: 400 }
      );
    }

    // Convert image to buffer
    const imageBuffer = Buffer.from(await image.arrayBuffer());

    // Extract names using Gemini Vision
    const names = await extractNamesFromImage(imageBuffer, image.type);

    return NextResponse.json({ names });
  } catch (error) {
    console.error("Error in extract-names API:", error);

    // Type-safe error handling
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to extract names from image";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
