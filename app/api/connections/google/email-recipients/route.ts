import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GoogleConnection = {
  id: string;
  provider: string;
  provider_account_id: string | null;
  account_name: string | null;
  account_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  status: string;
};

type Contact = {
  id: string;
  name: string;
  email: string;
  source: "google-contact" | "gmail";
};

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

type GmailHeader = {
  name?: string;
  value?: string;
};

type GmailMessage = {
  id?: string;
  payload?: {
    headers?: GmailHeader[];
  };
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function extractEmailAddresses(value: string): string[] {
  const results: string[] = [];

  const angleAddressRegex =
    /<\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\s*>/gi;

  let match: RegExpExecArray | null;

  while ((match = angleAddressRegex.exec(value)) !== null) {
    results.push(match[1]);
  }

  if (results.length > 0) {
    return results;
  }

  const plainEmailRegex =
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

  return value.match(plainEmailRegex) ?? [];
}

function parseHeaderEmails(
  headers: GmailHeader[],
  headerName: string
) {
  const values = headers
    .filter(
      (header) =>
        header.name?.toLowerCase() === headerName.toLowerCase()
    )
    .map((header) => header.value ?? "");

  return values.flatMap(extractEmailAddresses);
}

async function refreshGoogleAccessToken(
  connection: GoogleConnection
) {
  if (!connection.refresh_token) {
    throw new Error(
      "Google authorization needs to be renewed. Please reconnect your Google account."
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth configuration is missing."
    );
  }

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
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

  const result = await response.json();

  if (!response.ok || !result.access_token) {
    console.error(
      "Google token refresh failed:",
      result
    );

    throw new Error(
      "Google authorization expired. Please reconnect your Google account."
    );
  }

  const expiresIn =
    typeof result.expires_in === "number"
      ? result.expires_in
      : 3600;

  const expiresAt = new Date(
    Date.now() + expiresIn * 1000
  ).toISOString();

  const supabase =
    await createServerSupabaseClient();

  await supabase
    .from("connected_accounts")
    .update({
      access_token: result.access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return result.access_token as string;
}

async function getUsableGoogleAccessToken(
  connection: GoogleConnection
) {
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;

  const shouldRefresh =
    !connection.access_token ||
    expiresAt <= Date.now() + 60_000;

  if (!shouldRefresh) {
    return connection.access_token as string;
  }

  return refreshGoogleAccessToken(connection);
}

async function fetchGoogleContacts(
  accessToken: string
): Promise<Contact[]> {
  const contacts: Contact[] = [];

  let pageToken = "";

  let pagesLoaded = 0;

  do {
    const params = new URLSearchParams({
      personFields: "names,emailAddresses",
      pageSize: "1000",
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(
      `https://people.googleapis.com/v1/people/me/connections?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error(
        "Google People API error:",
        result
      );

      throw new Error(
        result?.error?.message ??
          "Unable to load Google Contacts."
      );
    }

    const people = Array.isArray(result.connections)
      ? (result.connections as GooglePerson[])
      : [];

    for (const person of people) {
      const emailEntries =
        Array.isArray(person.emailAddresses)
          ? person.emailAddresses
          : [];

      const name =
        person.names?.[0]?.displayName?.trim() ?? "";

      for (const entry of emailEntries) {
        const email = entry.value?.trim();

        if (!email) {
          continue;
        }

        contacts.push({
          id:
            person.resourceName ??
            `google-contact-${normalizeEmail(email)}`,
          name: name || email,
          email,
          source: "google-contact",
        });
      }
    }

    pagesLoaded += 1;

    pageToken =
      typeof result.nextPageToken === "string"
        ? result.nextPageToken
        : "";
  } while (pageToken && pagesLoaded < 20);

  return contacts;
}

async function fetchGmailContacts(
  accessToken: string,
  ownEmail: string | null
): Promise<Contact[]> {
  const contacts: Contact[] = [];

  let pageToken = "";

  let pagesLoaded = 0;

  /*
   * We intentionally use message metadata only.
   *
   * We do NOT download email bodies.
   *
   * The query excludes:
   * - spam
   * - trash
   * - drafts
   *
   * This gives ZUQEN real email addresses from the user's
   * mailbox without reading message bodies.
   */
  do {
    const params = new URLSearchParams({
      maxResults: "100",
      includeSpamTrash: "false",
      q: "-in:spam -in:trash -in:drafts",
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const listResult = await listResponse.json();

    if (!listResponse.ok) {
      console.error(
        "Gmail messages.list error:",
        listResult
      );

      throw new Error(
        listResult?.error?.message ??
          "Unable to load Gmail email contacts."
      );
    }

    const messages = Array.isArray(listResult.messages)
      ? listResult.messages
      : [];

    /*
     * Fetch metadata for each message.
     *
     * Only these headers are requested:
     * From, To, Cc.
     *
     * No email body is requested.
     */
    const messageResults = await Promise.all(
      messages.map(async (message: { id?: string }) => {
        if (!message.id) {
          return null;
        }

        const messageParams = new URLSearchParams();

        messageParams.append(
          "metadataHeaders",
          "From"
        );

        messageParams.append(
          "metadataHeaders",
          "To"
        );

        messageParams.append(
          "metadataHeaders",
          "Cc"
        );

        const response = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
            message.id
          )}?format=metadata&${messageParams.toString()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
          }
        );

        if (!response.ok) {
          return null;
        }

        return (await response.json()) as GmailMessage;
      })
    );

    for (const message of messageResults) {
      if (!message?.payload?.headers) {
        continue;
      }

      const headers = message.payload.headers;

      const addresses = [
        ...parseHeaderEmails(headers, "From"),
        ...parseHeaderEmails(headers, "To"),
        ...parseHeaderEmails(headers, "Cc"),
      ];

      for (const email of addresses) {
        const normalized = normalizeEmail(email);

        if (!normalized) {
          continue;
        }

        if (
          ownEmail &&
          normalized === normalizeEmail(ownEmail)
        ) {
          continue;
        }

        contacts.push({
          id: `gmail-${normalized}`,
          name: normalized,
          email: normalized,
          source: "gmail",
        });
      }
    }

    pagesLoaded += 1;

    pageToken =
      typeof listResult.nextPageToken === "string"
        ? listResult.nextPageToken
        : "";

    /*
     * Keep the first sync bounded.
     *
     * The page can be expanded later with server-side
     * incremental synchronization/history tracking.
     */
  } while (pageToken && pagesLoaded < 5);

  return contacts;
}

export async function GET() {
  try {
    const supabase =
      await createServerSupabaseClient();

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

    const { data, error: connectionError } =
      await supabase
        .from("connected_accounts")
        .select(
          `
            id,
            provider,
            provider_account_id,
            account_name,
            account_email,
            access_token,
            refresh_token,
            token_expires_at,
            scopes,
            status
          `
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
          error:
            "Unable to load Google connection.",
        },
        { status: 500 }
      );
    }

    const connection =
      data as GoogleConnection | null;

    if (!connection) {
      return NextResponse.json(
        {
          error:
            "Google account is not connected.",
        },
        { status: 404 }
      );
    }

    const scopes = Array.isArray(connection.scopes)
      ? connection.scopes
      : [];

    const hasGmailReadonly =
      scopes.includes(
        "https://www.googleapis.com/auth/gmail.readonly"
      );

    const hasContactsReadonly =
      scopes.includes(
        "https://www.googleapis.com/auth/contacts.readonly"
      );

    /*
     * Gmail data cannot be loaded unless the user granted
     * gmail.readonly.
     */
    if (!hasGmailReadonly) {
      return NextResponse.json(
        {
          error:
            "Gmail email access is not authorized yet. Please reconnect your Google account and allow Gmail access.",
          requiresReconnect: true,
          missingScopes: [
            "https://www.googleapis.com/auth/gmail.readonly",
          ],
        },
        { status: 403 }
      );
    }

    const accessToken =
      await getUsableGoogleAccessToken(
        connection
      );

    let googleContacts: Contact[] = [];
    let gmailContacts: Contact[] = [];

    /*
     * Google Contacts are optional.
     *
     * If Contacts permission is missing, we still show
     * Gmail-derived contacts instead of failing everything.
     */
    if (hasContactsReadonly) {
      try {
        googleContacts =
          await fetchGoogleContacts(
            accessToken
          );
      } catch (error) {
        console.error(
          "Google Contacts loading failed:",
          error
        );
      }
    }

    gmailContacts =
      await fetchGmailContacts(
        accessToken,
        connection.account_email
      );

    /*
     * Merge both sources by normalized email.
     *
     * Preference:
     * Google Contact name > Gmail address.
     *
     * If the same person exists in both places, one row
     * is shown instead of duplicates.
     */
    const merged = new Map<
      string,
      Contact
    >();

    for (const contact of gmailContacts) {
      const email = normalizeEmail(
        contact.email
      );

      if (!email) {
        continue;
      }

      merged.set(email, {
        ...contact,
        email,
        name: contact.name || email,
      });
    }

    for (const contact of googleContacts) {
      const email = normalizeEmail(
        contact.email
      );

      if (!email) {
        continue;
      }

      const existing = merged.get(email);

      if (existing) {
        merged.set(email, {
          ...existing,
          name:
            contact.name &&
            contact.name !== contact.email
              ? contact.name
              : existing.name,
          source: "google-contact",
        });
      } else {
        merged.set(email, {
          ...contact,
          email,
          name:
            contact.name || email,
        });
      }
    }

    const uniqueContacts = Array.from(
      merged.values()
    ).sort((a, b) =>
      a.name.localeCompare(
        b.name,
        undefined,
        {
          sensitivity: "base",
        }
      )
    );

    console.log(
      "GOOGLE EMAIL RECIPIENTS RESULT:",
      {
        googleAccount:
          connection.account_email,
        googleContacts:
          googleContacts.length,
        gmailContacts:
          gmailContacts.length,
        uniqueContacts:
          uniqueContacts.length,
        contactsPermission:
          hasContactsReadonly,
        gmailPermission:
          hasGmailReadonly,
      }
    );

    return NextResponse.json({
      contacts: uniqueContacts,
      googleContactsCount:
        googleContacts.length,
      gmailContactsCount:
        gmailContacts.length,
      totalContacts:
        uniqueContacts.length,
      sources: {
        googleContacts:
          hasContactsReadonly,
        gmail: true,
      },
    });
  } catch (error) {
    console.error(
      "Google email recipients API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load email recipients.",
      },
      { status: 500 }
    );
  }
}