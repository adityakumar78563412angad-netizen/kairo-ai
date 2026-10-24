import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const { data: connection, error: connectionError } =
      await supabase
        .from("connected_accounts")
        .select(
          "id, access_token, provider, status"
        )
        .eq("user_id", user.id)
        .eq("provider", "google")
        .eq("status", "connected")
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (connectionError) {
      console.error(
        "Failed to load Google connection:",
        connectionError
      );

      return NextResponse.json(
        {
          error: "Unable to load Google connection.",
        },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        {
          error: "Google account is not connected.",
        },
        { status: 404 }
      );
    }

    let revokeWarning: string | null = null;

    if (connection.access_token) {
      try {
        const revokeResponse = await fetch(
          "https://oauth2.googleapis.com/revoke",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              token: connection.access_token,
            }),
            cache: "no-store",
          }
        );

        if (!revokeResponse.ok) {
          revokeWarning =
            "Google authorization was removed from ZUQEN, but Google token revocation could not be confirmed.";
        }
      } catch (error) {
        console.error(
          "Google token revocation error:",
          error
        );

        revokeWarning =
          "Google authorization was removed from ZUQEN, but Google token revocation could not be confirmed.";
      }
    }

    const { error: deleteError } = await supabase
      .from("connected_accounts")
      .delete()
      .eq("id", connection.id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error(
        "Failed to delete Google connection:",
        deleteError
      );

      return NextResponse.json(
        {
          error:
            "Unable to disconnect the Google account.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      warning: revokeWarning,
    });
  } catch (error) {
    console.error(
      "Google disconnect API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to disconnect the Google account.",
      },
      { status: 500 }
    );
  }
}