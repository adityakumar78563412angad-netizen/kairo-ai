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
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from("connected_accounts")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "telegram");

    if (error) {
      console.error(
        "Failed to disconnect Telegram:",
        error
      );

      return NextResponse.json(
        { error: "Unable to disconnect Telegram." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Telegram has been disconnected from ZUQEN.",
    });
  } catch (error) {
    console.error(
      "Telegram disconnect API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to disconnect Telegram.",
      },
      { status: 500 }
    );
  }
}