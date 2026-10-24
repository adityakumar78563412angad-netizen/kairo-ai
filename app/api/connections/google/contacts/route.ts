import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GooglePerson = {
  resourceName?: string;
  names?: Array<{
    displayName?: string;
  }>;
  emailAddresses?: Array<{
    value?: string;
    type?: string;
  }>;
};

type GooglePeopleResponse = {
  connections?: GooglePerson[];
  nextPageToken?: string;
  totalPeople?: number;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

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

    const { data: connection, error: connectionError } = await supabase
      .from("connected_accounts")
      .select(
        "id, provider, provider_account_id, account_name, account_email, access_token, refresh_token, token_expires_at, scopes, status"
      )
      .eq("user_id", user.id)
      .eq("provider", "google")
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError) {
      console.error("Failed to load Google connection:", connectionError);

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

    if (!connection.access_token) {
      return NextResponse.json(
        {
          error: "Google access token is missing.",
        },
        { status: 401 }
      );
    }

    let accessToken = connection.access_token;

    const tokenExpiresAt = connection.token_expires_at
      ? new Date(connection.token_expires_at).getTime()
      : 0;

    const shouldRefresh =
      tokenExpiresAt > 0 && tokenExpiresAt <= Date.now() + 60_000;

    if (shouldRefresh) {
      if (!connection.refresh_token) {
        return NextResponse.json(
          {
            error:
              "Google authorization has expired and no refresh token is available. Please reconnect Google.",
          },
          { status: 401 }
        );
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error("Google OAuth credentials are missing.");

        return NextResponse.json(
          {
            error: "Google OAuth is not configured on the server.",
          },
          { status: 500 }
        );
      }

      const refreshResponse = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: connection.refresh_token,
            grant_type: "refresh_token",
          }),
          cache: "no-store",
        }
      );

      const refreshData =
        (await refreshResponse.json()) as GoogleTokenResponse;

      if (!refreshResponse.ok || !refreshData.access_token) {
        console.error(
          "Google access token refresh failed:",
          refreshData
        );

        return NextResponse.json(
          {
            error:
              "Google authorization expired. Please reconnect your Google account.",
          },
          { status: 401 }
        );
      }

      accessToken = refreshData.access_token;

      const newExpiresAt = new Date(
        Date.now() + (refreshData.expires_in ?? 3600) * 1000
      ).toISOString();

      const { error: updateTokenError } = await supabase
        .from("connected_accounts")
        .update({
          access_token: accessToken,
          token_expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id)
        .eq("user_id", user.id);

      if (updateTokenError) {
        console.error(
          "Failed to update refreshed Google token:",
          updateTokenError
        );
      }
    }

    const contacts: Array<{
      id: string;
      name: string;
      email: string;
      source: "google";
    }> = [];

    let nextPageToken: string | undefined;

    do {
      const peopleUrl = new URL(
        "https://people.googleapis.com/v1/people/me/connections"
      );

      peopleUrl.searchParams.set(
        "personFields",
        "names,emailAddresses"
      );

      peopleUrl.searchParams.set("pageSize", "1000");

      if (nextPageToken) {
        peopleUrl.searchParams.set("pageToken", nextPageToken);
      }

      const peopleResponse = await fetch(peopleUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const peopleData =
        (await peopleResponse.json()) as GooglePeopleResponse & {
          error?: {
            message?: string;
          };
        };

      if (!peopleResponse.ok) {
        console.error(
          "Google People API error:",
          peopleData
        );

        return NextResponse.json(
          {
            error:
              peopleData.error?.message ??
              "Unable to load Google contacts.",
          },
          { status: peopleResponse.status }
        );
      }

      for (const person of peopleData.connections ?? []) {
        const email =
          person.emailAddresses?.find(
            (item) => item.value
          )?.value?.trim();

        if (!email) {
          continue;
        }

        const name =
          person.names?.find(
            (item) => item.displayName
          )?.displayName?.trim() || email;

        contacts.push({
          id:
            person.resourceName ??
            `google-${email.toLowerCase()}`,
          name,
          email,
          source: "google",
        });
      }

      nextPageToken = peopleData.nextPageToken;
    } while (nextPageToken);
console.log("GOOGLE CONTACTS DEBUG:", {
  rawContacts: contacts.length,
  uniqueContactsBeforeReturn: Array.from(
    new Map(
      contacts.map((contact) => [
        contact.email.toLowerCase(),
        contact,
      ])
    ).values()
  ).length,
  sampleContacts: contacts.slice(0, 10),
});
    const uniqueContacts = Array.from(
      new Map(
        contacts.map((contact) => [
          contact.email.toLowerCase(),
          contact,
        ])
      ).values()
    );

    return NextResponse.json({
      provider: "google",
      account: {
        name: connection.account_name,
        email: connection.account_email,
      },
      contacts: uniqueContacts,
      count: uniqueContacts.length,
    });
  } catch (error) {
    console.error("Google contacts API error:", error);

    return NextResponse.json(
      {
        error: "Unable to load Google contacts.",
      },
      { status: 500 }
    );
  }
}