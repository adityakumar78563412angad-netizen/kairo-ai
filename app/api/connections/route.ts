import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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

    const { data, error } = await supabase
      .from("connected_accounts")
      .select(
        "id, provider, provider_account_id, account_name, account_email, status, scopes, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load connected accounts:", error);

      return NextResponse.json(
        {
          error: "Unable to load connected accounts.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      connections: data ?? [],
    });
  } catch (error) {
    console.error("Connections API error:", error);

    return NextResponse.json(
      {
        error: "Unable to load connected accounts.",
      },
      { status: 500 }
    );
  }
}