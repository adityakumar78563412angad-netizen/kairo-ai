import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(
        new URL("/login?error=authentication_required", request.url)
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error("Google OAuth environment variables are missing.");

      return NextResponse.json(
        {
          error: "Google OAuth is not configured on the server.",
        },
        { status: 500 }
      );
    }

    const state = crypto.randomUUID();

    const googleAuthUrl = new URL(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );

    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");

    googleAuthUrl.searchParams.set(
      "scope",
      [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.send",
      ].join(" ")
    );

    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "consent");
    googleAuthUrl.searchParams.set("include_granted_scopes", "true");
    googleAuthUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(googleAuthUrl);

    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  } catch (error) {
    console.error("Google OAuth connect error:", error);

    return NextResponse.json(
      {
        error: "Unable to start Google authorization.",
      },
      { status: 500 }
    );
  }
}