import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase =
      await createServerSupabaseClient();

    const {
      data: {
        user,
      },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
          code: "authentication_required",
        },
        { status: 401 }
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "get_credit_balance"
    );

    if (error) {
      console.error(
        "Credit balance error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to load credit balance.",
          code: "credit_balance_error",
        },
        { status: 500 }
      );
    }

    const balance = Number(data ?? 0);

    return NextResponse.json(
      {
        balance,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Credits API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong while loading credits.",
        code: "credits_error",
      },
      { status: 500 }
    );
  }
}