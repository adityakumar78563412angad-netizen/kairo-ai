import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Google OAuth returned an error:", error);

      return NextResponse.redirect(
        new URL(
          `/bulk-messenger?google_error=${encodeURIComponent(error)}`,
          request.url
        )
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          "/bulk-messenger?google_error=missing_oauth_parameters",
          request.url
        )
      );
    }

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(
        new URL(
          "/login?error=authentication_required",
          request.url
        )
      );
    }

    const cookieStore = await import("next/headers").then(
      ({ cookies }) => cookies()
    );

    const storedState = (await cookieStore).get(
      "google_oauth_state"
    )?.value;

    if (!storedState || storedState !== state) {
      console.error("Google OAuth state validation failed.");

      return NextResponse.redirect(
        new URL(
          "/bulk-messenger?google_error=invalid_oauth_state",
          request.url
        )
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("Google OAuth environment variables are missing.");

      return NextResponse.json(
        {
          error: "Google OAuth is not configured on the server.",
        },
        { status: 500 }
      );
    }

    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
        cache: "no-store",
      }
    );

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();

      console.error(
        "Google token exchange failed:",
        tokenError
      );

      return NextResponse.redirect(
        new URL(
          "/bulk-messenger?google_error=token_exchange_failed",
          request.url
        )
      );
    }

    const tokenData = await tokenResponse.json();

    const accessToken = tokenData.access_token as string | undefined;
    const refreshToken = tokenData.refresh_token as string | undefined;
    const expiresIn = tokenData.expires_in as number | undefined;
    const scopeString = tokenData.scope as string | undefined;

    if (!accessToken) {
      console.error("Google did not return an access token.");

      return NextResponse.redirect(
        new URL(
          "/bulk-messenger?google_error=missing_access_token",
          request.url
        )
      );
    }

    /*
     * Get the Google account identity.
     */
    const userInfoResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!userInfoResponse.ok) {
      const userInfoError = await userInfoResponse.text();

      console.error(
        "Google userinfo request failed:",
        userInfoError
      );

      return NextResponse.redirect(
        new URL(
          "/bulk-messenger?google_error=userinfo_failed",
          request.url
        )
      );
    }

    const googleUser = await userInfoResponse.json();

    const googleAccountId = googleUser.sub as string | undefined;
    const googleEmail = googleUser.email as string | undefined;
    const googleName =
      (googleUser.name as string | undefined) ||
      googleEmail ||
      "Google Account";

    if (!googleAccountId) {
      console.error("Google account ID was not returned.");

      return NextResponse.redirect(
        new URL(
          "/bulk-messenger?google_error=missing_google_account_id",
          request.url
        )
      );
    }

    /*
     * Google may not return a refresh token when the same
     * account has already authorized the application.
     *
     * If an existing connection already has one, preserve it.
     */
    const { data: existingConnection, error: existingError } =
      await supabase
        .from("connected_accounts")
        .select(
          "id, refresh_token"
        )
        .eq("user_id", user.id)
        .eq("provider", "google")
        .eq("provider_account_id", googleAccountId)
        .maybeSingle();

    if (existingError) {
      console.error(
        "Failed to check existing Google connection:",
        existingError
      );

      return NextResponse.redirect(
        new URL(
          "/bulk-messenger?google_error=connection_lookup_failed",
          request.url
        )
      );
    }

    const finalRefreshToken =
      refreshToken ||
      existingConnection?.refresh_token ||
      null;

    const tokenExpiresAt =
      typeof expiresIn === "number"
        ? new Date(
            Date.now() + expiresIn * 1000
          ).toISOString()
        : null;

    const scopes =
      scopeString
        ?.split(" ")
        .map((scope) => scope.trim())
        .filter(Boolean) || [];

    const connectionData = {
      user_id: user.id,
      provider: "google",
      provider_account_id: googleAccountId,
      account_name: googleName,
      account_email: googleEmail || null,
      access_token: accessToken,
      refresh_token: finalRefreshToken,
      token_expires_at: tokenExpiresAt,
      scopes,
      status: "connected",
      updated_at: new Date().toISOString(),
    };

    let saveError: unknown = null;

    if (existingConnection?.id) {
      const { error: updateError } = await supabase
        .from("connected_accounts")
        .update(connectionData)
        .eq("id", existingConnection.id)
        .eq("user_id", user.id);

      saveError = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("connected_accounts")
        .insert(connectionData);

      saveError = insertError;
    }

    if (saveError) {
      console.error(
        "Failed to save Google connection:",
        saveError
      );

      return NextResponse.redirect(
        new URL(
          "/bulk-messenger?google_error=connection_save_failed",
          request.url
        )
      );
    }

    /*
     * Delete the one-time OAuth state cookie.
     */
    const response = NextResponse.redirect(
      new URL(
        "/bulk-messenger?google_connected=true",
        request.url
      )
    );

    response.cookies.set("google_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error(
      "Google OAuth callback error:",
      error
    );

    return NextResponse.redirect(
      new URL(
        "/bulk-messenger?google_error=oauth_callback_failed",
        request.url
      )
    );
  }
}