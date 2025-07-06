import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrichPropertyData } from "@/lib/gemini";
import { sendCompletionEmail } from "@/lib/email";
import {
  canProcessProperties,
  incrementProcessPropertiesRequests,
  getRequestStats,
} from "@/lib/request-tracker";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function processPropertiesAsync(
  properties: string[],
  parentAddress: string,
  userEmail: string
) {
  let processedCount = 0;
  let skippedCount = 0;
  const skippedProperties: string[] = [];
  const failedProperties: string[] = [];

  // Optimized batch size for better performance
  const batchSize = 50;

  // Function to process a single property (Gemini API call only)
  async function processSingleProperty(propertyName: string): Promise<{
    propertyName: string;
    status: "processed" | "failed";
    enrichedData?: Record<string, string>;
    processingTime: number;
  }> {
    const startTime = Date.now();
    try {
      // Call Gemini API for property enrichment
      const enrichedData = await enrichPropertyData(
        propertyName,
        parentAddress
      );

      const processingTime = Date.now() - startTime;
      console.log(`✅ ${propertyName}: ${processingTime}ms`);

      return {
        propertyName,
        status: "processed",
        enrichedData,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ ${propertyName} failed (${processingTime}ms):`, error);
      failedProperties.push(propertyName);
      return {
        propertyName,
        status: "failed",
        processingTime,
      };
    }
  }

  // Batch function to check existing properties
  async function getExistingProperties(
    propertyNames: string[]
  ): Promise<Set<string>> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("properties")
        .select("property_address")
        .in("property_address", propertyNames);

      if (error) {
        console.error("Error checking existing properties:", error);
        return new Set();
      }

      return new Set(data?.map((row) => row.property_address) || []);
    } catch (error) {
      console.error("Exception checking existing properties:", error);
      return new Set();
    }
  }

  // Batch function to insert new properties
  async function batchInsertProperties(
    enrichedProperties: Array<{
      propertyName: string;
      enrichedData: Record<string, string>;
    }>
  ): Promise<number> {
    if (enrichedProperties.length === 0) return 0;

    try {
      const supabase = await createClient();

      const insertData = enrichedProperties.map(
        ({ propertyName, enrichedData }) => ({
          property_address: propertyName,
          city: enrichedData.city || null,
          county: enrichedData.county || null,
          state: enrichedData.state || null,
          zip_code: enrichedData.zip_code || null,
          decision_maker_name: enrichedData.decision_maker_name || null,
          decision_maker_email: enrichedData.email || null,
          decision_maker_phone: enrichedData.phone || null,
          hoa_or_management_company: enrichedData.management_company || null,
        })
      );

      const { error } = await supabase.from("properties").insert(insertData);

      if (error) {
        console.error("Batch insertion failed:", error);
        return 0;
      }

      return enrichedProperties.length;
    } catch (error) {
      console.error("Exception during batch insertion:", error);
      return 0;
    }
  }

  try {
    console.log(
      `🚀 Starting batch processing of ${properties.length} properties`
    );

    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(properties.length / batchSize);

      console.log(
        `\n🔄 Processing batch ${batchNumber}/${totalBatches}: ${batch.length} properties`
      );

      const batchStartTime = Date.now();

      // Step 1: Check which properties already exist (single DB call)
      console.log(`📋 Checking existing properties...`);
      const existingProperties = await getExistingProperties(batch);

      // Filter out existing properties
      const newProperties = batch.filter(
        (property) => !existingProperties.has(property)
      );
      const skippedInBatch = batch.length - newProperties.length;

      if (skippedInBatch > 0) {
        console.log(`⏭️ Skipping ${skippedInBatch} existing properties`);
        skippedProperties.push(
          ...batch.filter((property) => existingProperties.has(property))
        );
        skippedCount += skippedInBatch;
      }

      if (newProperties.length === 0) {
        console.log(
          `✅ Batch ${batchNumber} completed - all properties already exist`
        );
        continue;
      }

      // Step 2: Process ALL new properties in parallel (Gemini API calls)
      console.log(
        `🤖 Processing ${newProperties.length} new properties with Gemini...`
      );
      const geminiStartTime = Date.now();

      const batchPromises = newProperties.map((propertyName) =>
        processSingleProperty(propertyName)
      );

      // Wait for ALL Gemini calls to complete
      const batchResults = await Promise.all(batchPromises);

      const geminiEndTime = Date.now();
      const geminiTime = Math.round((geminiEndTime - geminiStartTime) / 1000);

      // Separate successful and failed results
      const successfulResults = batchResults.filter(
        (result) => result.status === "processed"
      );
      const failedInBatch = batchResults.filter(
        (result) => result.status === "failed"
      ).length;

      console.log(`🤖 Gemini processing completed in ${geminiTime}s`);
      console.log(
        `📊 Gemini results: ${successfulResults.length} successful, ${failedInBatch} failed`
      );

      if (successfulResults.length > 0) {
        // Step 3: Batch insert all successful properties (single DB call)
        console.log(
          `💾 Batch inserting ${successfulResults.length} properties...`
        );
        const dbStartTime = Date.now();

        const enrichedProperties = successfulResults.map((result) => ({
          propertyName: result.propertyName,
          enrichedData: result.enrichedData!,
        }));

        const insertedCount = await batchInsertProperties(enrichedProperties);

        const dbEndTime = Date.now();
        const dbTime = dbEndTime - dbStartTime;

        console.log(`💾 Database insertion completed in ${dbTime}ms`);

        if (insertedCount > 0) {
          processedCount += insertedCount;

          // Step 4: Single increment of request count for this batch (processed + failed)
          const incrementSuccess = await incrementProcessPropertiesRequests(
            insertedCount + failedInBatch
          );
          if (!incrementSuccess) {
            console.warn(
              `Failed to increment request count for batch ${batchNumber}`
            );
          }
        }
      }

      const batchEndTime = Date.now();
      const totalBatchTime = Math.round((batchEndTime - batchStartTime) / 1000);

      console.log(
        `✅ Batch ${batchNumber} completed in ${totalBatchTime}s - Processed: ${successfulResults.length}, Skipped: ${skippedInBatch}, Failed: ${failedInBatch}`
      );
      console.log(
        `📈 Total progress: ${processedCount + skippedCount}/${
          properties.length
        } (${Math.round(
          ((processedCount + skippedCount) / properties.length) * 100
        )}%)`
      );

      // Wait 5 seconds between batches (if not the last batch)
      if (i + batchSize < properties.length) {
        console.log(`⏸️ Waiting 5 seconds before next batch...`);
        await delay(5000);
      }
    }

    const totalFailed = failedProperties.length;
    console.log(`\n🎯 Processing completed!`);
    console.log(
      `📊 Final results: ${processedCount} processed, ${skippedCount} skipped, ${totalFailed} failed`
    );

    if (failedProperties.length > 0) {
      console.log(`❌ Failed properties: ${failedProperties.join(", ")}`);
    }

    // Send completion email
    await sendCompletionEmail(
      userEmail,
      properties.length,
      processedCount,
      skippedCount
    );

    console.log(`📧 Completion email sent to ${userEmail}`);
  } catch (error) {
    console.error("💥 Error in processing:", error);

    // Send error notification email
    try {
      await sendCompletionEmail(
        userEmail,
        properties.length,
        processedCount,
        skippedCount
      );
    } catch (emailError) {
      console.error("Failed to send error notification email:", emailError);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { properties, parentAddress, filename } = await request.json();

    if (!properties || !Array.isArray(properties) || properties.length === 0) {
      return NextResponse.json(
        { error: "Properties array is required" },
        { status: 400 }
      );
    }

    if (!parentAddress) {
      return NextResponse.json(
        { error: "Parent address is required" },
        { status: 400 }
      );
    }

    // Check if we can make all the required requests within daily limit
    const requestCount = properties.length; // Each property = 1 Gemini API call
    const canProceed = await canProcessProperties(requestCount);
    if (!canProceed) {
      const stats = await getRequestStats();
      return NextResponse.json(
        {
          error: "Daily request limit exceeded",
          details: `Processing ${requestCount} properties would exceed the daily limit of ${
            stats?.limit || 1500
          } requests. Current usage: ${stats?.used || 0}/${
            stats?.limit || 1500
          }. Limit resets at midnight UTC.`,
          requestsNeeded: requestCount,
          currentUsage: stats?.used || 0,
          remainingRequests: stats?.remaining || 0,
          resetTime: stats?.resetTime || null,
        },
        { status: 429 }
      );
    }

    console.log(`🎬 Starting processing for ${properties.length} properties`);

    // Start processing in the background (fire-and-forget)
    processPropertiesAsync(properties, parentAddress, user.email!).catch(
      (error) => {
        console.error("🚨 Background processing error:", error);
      }
    );

    // Return immediate response to user
    return NextResponse.json({
      message: "Processing started successfully",
      total: properties.length,
      status: "processing",
    });
  } catch (error) {
    console.error("💥 Error in process-properties API:", error);
    return NextResponse.json(
      { error: "Failed to start processing" },
      { status: 500 }
    );
  }
}
