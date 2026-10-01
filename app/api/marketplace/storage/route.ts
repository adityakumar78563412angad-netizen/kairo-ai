import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { headB2Object } from "@/lib/marketplace/b2";

const ALLOWED_ROLES = new Set([
  "template",
  "thumbnail",
  "screenshot",
  "demo_video",
  "documentation",
  "asset",
]);

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Ignore cookie mutation errors in this server context.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const body = await request.json();

    const templateId =
      typeof body.templateId === "string" ? body.templateId : "";

    const objectKey =
      typeof body.objectKey === "string" ? body.objectKey : "";

    const fileName =
      typeof body.fileName === "string" ? body.fileName : "";

    const contentType =
      typeof body.contentType === "string"
        ? body.contentType
        : "application/octet-stream";

    const fileSize =
      typeof body.fileSize === "number"
        ? body.fileSize
        : 0;

    const fileRole =
      typeof body.fileRole === "string"
        ? body.fileRole
        : "";

    if (!templateId || !objectKey || !fileName || !fileRole) {
      return NextResponse.json(
        {
          error: "Missing required upload metadata.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.has(fileRole)) {
      return NextResponse.json(
        {
          error: "Invalid file role.",
        },
        { status: 400 }
      );
    }

    const expectedPrefix =
      `marketplace/templates/${user.id}/${templateId}/uploads/`;

    if (!objectKey.startsWith(expectedPrefix)) {
      return NextResponse.json(
        {
          error: "Invalid storage object.",
        },
        { status: 403 }
      );
    }

    const { data: template, error: templateError } = await supabase
      .from("templates")
      .select("id, seller_id, status")
      .eq("id", templateId)
      .eq("seller_id", user.id)
      .maybeSingle();

    if (templateError) {
      console.error("Template verification failed:", templateError);

      return NextResponse.json(
        {
          error: "Unable to verify template.",
        },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        {
          error: "Template not found.",
        },
        { status: 404 }
      );
    }

    if (
      template.status === "published" ||
      template.status === "under_review"
    ) {
      return NextResponse.json(
        {
          error:
            "Files cannot be added after the template enters review or publishing.",
        },
        { status: 409 }
      );
    }

    const objectInfo = await headB2Object(objectKey);

    const actualSize = Number(objectInfo.ContentLength ?? 0);

    if (actualSize <= 0) {
      return NextResponse.json(
        {
          error: "Uploaded object is empty or unavailable.",
        },
        { status: 400 }
      );
    }

    if (fileSize > 0 && actualSize !== fileSize) {
      return NextResponse.json(
        {
          error:
            "Uploaded file size does not match the expected size.",
        },
        { status: 400 }
      );
    }

    const { data: fileRecord, error: insertError } = await supabase
      .from("template_files")
      .insert({
        template_id: templateId,
        file_name: fileName,
        file_path: objectKey,
        file_size: actualSize,
        content_type:
          objectInfo.ContentType || contentType,
        storage_provider: "backblaze_b2",
        storage_bucket: process.env.B2_S3_BUCKET,
        storage_object_key: objectKey,
        storage_region: process.env.B2_S3_REGION,
        file_role: fileRole,
        is_private: true,
        metadata: {
          uploaded_by: user.id,
          verified_size: true,
        },
      })
      .select(
        `
          id,
          template_id,
          file_name,
          file_path,
          file_size,
          content_type,
          storage_provider,
          storage_bucket,
          storage_object_key,
          storage_region,
          file_role,
          is_private,
          created_at
        `
      )
      .single();

    if (insertError) {
      console.error("Template file metadata insert failed:", insertError);

      return NextResponse.json(
        {
          error: "File uploaded but metadata could not be saved.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      file: fileRecord,
    });
  } catch (error) {
    console.error("Marketplace upload completion error:", error);

    return NextResponse.json(
      {
        error: "Unable to complete upload.",
      },
      {
        status: 500,
      }
    );
  }
}