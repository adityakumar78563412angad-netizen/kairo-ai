import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("templateId")?.trim();

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required." },
        { status: 400 }
      );
    }

    const { data: template, error: templateError } =
      await supabase
        .from("templates")
        .select("id, seller_id, status, review_status")
        .eq("id", templateId)
        .maybeSingle();

    if (templateError) {
      console.error(
        "MARKETPLACE FILES TEMPLATE LOOKUP ERROR:",
        templateError
      );

      return NextResponse.json(
        { error: "Unable to verify template ownership." },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        { error: "Template not found." },
        { status: 404 }
      );
    }

    const { data: sellerProfile, error: sellerError } =
      await supabase
        .from("seller_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (sellerError) {
      console.error(
        "MARKETPLACE FILES SELLER LOOKUP ERROR:",
        sellerError
      );

      return NextResponse.json(
        { error: "Unable to verify seller profile." },
        { status: 500 }
      );
    }

    if (!sellerProfile || template.seller_id !== sellerProfile.id) {
      return NextResponse.json(
        { error: "You do not own this template." },
        { status: 403 }
      );
    }

    const { data: files, error: filesError } =
      await supabase
        .from("template_files")
        .select(
          `
            id,
            template_id,
            version_id,
            file_name,
            file_size,
            content_type,
            created_at,
            storage_provider,
            storage_bucket,
            storage_object_key,
            storage_region,
            file_role,
            is_private,
            metadata
          `
        )
        .eq("template_id", templateId)
        .order("created_at", {
          ascending: true,
        });

    if (filesError) {
      console.error(
        "MARKETPLACE FILES QUERY ERROR:",
        filesError
      );

      return NextResponse.json(
        { error: "Unable to load template files." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      files: files || [],
    });
  } catch (error) {
    console.error(
      "MARKETPLACE FILES GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load template files.",
      },
      { status: 500 }
    );
  }
}