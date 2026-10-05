import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { deleteB2Object } from "@/lib/marketplace/b2";

export async function DELETE(request: Request) {
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

    let body: {
      fileId?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const fileId = body.fileId?.trim();

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId is required." },
        { status: 400 }
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
        "MARKETPLACE DELETE SELLER LOOKUP ERROR:",
        sellerError
      );

      return NextResponse.json(
        { error: "Unable to verify seller profile." },
        { status: 500 }
      );
    }

    if (!sellerProfile) {
      return NextResponse.json(
        { error: "Seller profile not found." },
        { status: 403 }
      );
    }

    const { data: fileRecord, error: fileError } =
      await supabase
        .from("template_files")
        .select(
          `
            id,
            template_id,
            storage_provider,
            storage_bucket,
            storage_object_key,
            file_name,
            file_role
          `
        )
        .eq("id", fileId)
        .maybeSingle();

    if (fileError) {
      console.error(
        "MARKETPLACE DELETE FILE LOOKUP ERROR:",
        fileError
      );

      return NextResponse.json(
        { error: "Unable to find uploaded file." },
        { status: 500 }
      );
    }

    if (!fileRecord) {
      return NextResponse.json(
        { error: "Uploaded file not found." },
        { status: 404 }
      );
    }

    const { data: template, error: templateError } =
      await supabase
        .from("templates")
        .select(
          `
            id,
            seller_id,
            status,
            review_status
          `
        )
        .eq("id", fileRecord.template_id)
        .maybeSingle();

    if (templateError) {
      console.error(
        "MARKETPLACE DELETE TEMPLATE LOOKUP ERROR:",
        templateError
      );

      return NextResponse.json(
        { error: "Unable to verify template." },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        { error: "Template not found." },
        { status: 404 }
      );
    }

    if (template.seller_id !== sellerProfile.id) {
      return NextResponse.json(
        { error: "You do not own this template." },
        { status: 403 }
      );
    }

    /*
     * Published and under-review templates should not have
     * their marketplace assets silently modified.
     */
    if (
      template.status === "published" ||
      template.review_status === "under_review"
    ) {
      return NextResponse.json(
        {
          error:
            "Files cannot be deleted while the template is published or under review.",
        },
        { status: 409 }
      );
    }

    /*
     * Only B2-backed files are deleted from external storage.
     *
     * Older/local records without a B2 object key are handled
     * by deleting their database metadata only.
     */
    if (
      fileRecord.storage_provider === "backblaze_b2" &&
      fileRecord.storage_object_key
    ) {
      try {
        await deleteB2Object(
          fileRecord.storage_object_key
        );
      } catch (storageError) {
        console.error(
          "MARKETPLACE B2 DELETE ERROR:",
          storageError
        );

        return NextResponse.json(
          {
            error:
              "The file could not be removed from secure storage. The database record was kept safe.",
          },
          { status: 502 }
        );
      }
    }

    const { error: deleteDatabaseError } =
      await supabase
        .from("template_files")
        .delete()
        .eq("id", fileRecord.id);

    if (deleteDatabaseError) {
      console.error(
        "MARKETPLACE DELETE FILE DATABASE ERROR:",
        deleteDatabaseError
      );

      return NextResponse.json(
        {
          error:
            "The storage object was removed, but the database record could not be removed.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fileId: fileRecord.id,
      fileName: fileRecord.file_name,
    });
  } catch (error) {
    console.error(
      "MARKETPLACE DELETE FILE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete uploaded file.",
      },
      { status: 500 }
    );
  }
}