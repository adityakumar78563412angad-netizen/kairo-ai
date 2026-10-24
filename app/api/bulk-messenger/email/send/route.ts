import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RECIPIENTS = 50;

type SendRequest = {
  subject?: string;
  message?: string;
  recipients?: Array<{
    id?: string;
    name?: string;
    email?: string;
  }>;
};

type SendResult = {
  email: string;
  name?: string;
  status: "sent" | "failed";
  messageId?: string;
  threadId?: string;
  error?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createMimeMessage(
  from: string,
  to: string,
  subject: string,
  body: string
) {
  const safeSubject = subject
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");

  const safeFrom = from
    .replace(/\r/g, "")
    .replace(/\n/g, "");

  const safeTo = to
    .replace(/\r/g, "")
    .replace(/\n/g, "");

  const normalizedBody = body
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  return [
    `From: ${safeFrom}`,
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizedBody,
  ].join("\r\n");
}

async function refreshGoogleAccessToken(
  refreshToken: string
) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth server configuration is missing."
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
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error(
      "Google token refresh failed:",
      data
    );

    throw new Error(
      "Google authorization expired. Please reconnect Google."
    );
  }

  return {
    accessToken: data.access_token as string,
    expiresIn:
      typeof data.expires_in === "number"
        ? data.expires_in
        : 3600,
  };
}

export async function POST(request: Request) {
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

    let body: SendRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const subject = body.subject?.trim() ?? "";
    const message = body.message?.trim() ?? "";
    const recipients = Array.isArray(body.recipients)
      ? body.recipients
      : [];

    if (!subject) {
      return NextResponse.json(
        {
          error: "Email subject is required.",
        },
        { status: 400 }
      );
    }

    if (subject.length > 200) {
      return NextResponse.json(
        {
          error:
            "Email subject must be 200 characters or less.",
        },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        {
          error: "Email message is required.",
        },
        { status: 400 }
      );
    }

    if (message.length > 100000) {
      return NextResponse.json(
        {
          error:
            "Email message is too large.",
        },
        { status: 400 }
      );
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        {
          error:
            "Select at least one recipient.",
        },
        { status: 400 }
      );
    }

    if (recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        {
          error: `You can send to a maximum of ${MAX_RECIPIENTS} recipients per send action.`,
        },
        { status: 400 }
      );
    }

    const normalizedRecipients = recipients
      .map((recipient) => ({
        id: recipient?.id,
        name:
          typeof recipient?.name === "string"
            ? recipient.name.trim()
            : undefined,
        email:
          typeof recipient?.email === "string"
            ? recipient.email.trim().toLowerCase()
            : "",
      }))
      .filter((recipient) => recipient.email);

    const uniqueRecipients = Array.from(
      new Map(
        normalizedRecipients.map((recipient) => [
          recipient.email,
          recipient,
        ])
      ).values()
    );

    const invalidRecipients =
      uniqueRecipients.filter(
        (recipient) => !isValidEmail(recipient.email)
      );

    if (invalidRecipients.length > 0) {
      return NextResponse.json(
        {
          error:
            "One or more selected recipients contain an invalid email address.",
        },
        { status: 400 }
      );
    }

    if (uniqueRecipients.length === 0) {
      return NextResponse.json(
        {
          error: "No valid recipients were selected.",
        },
        { status: 400 }
      );
    }

    const { data: connection, error: connectionError } =
      await supabase
        .from("connected_accounts")
        .select(
          "id, account_email, access_token, refresh_token, token_expires_at, scopes, status"
        )
        .eq("user_id", user.id)
        .eq("provider", "google")
        .eq("status", "connected")
        .order("updated_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (connectionError) {
      console.error(
        "Google connection lookup failed:",
        connectionError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load your connected Google account.",
        },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        {
          error:
            "Google is not connected. Connect Gmail first.",
        },
        { status: 400 }
      );
    }

    const scopes = Array.isArray(connection.scopes)
      ? connection.scopes
      : [];

    const hasGmailSendScope = scopes.some(
      (scope: string) =>
        scope ===
        "https://www.googleapis.com/auth/gmail.send"
    );

    if (!hasGmailSendScope) {
      return NextResponse.json(
        {
          error:
            "Gmail sending permission is missing. Disconnect and reconnect Google, then allow Gmail sending permission.",
          requiresReconnect: true,
        },
        { status: 403 }
      );
    }

    if (!connection.access_token) {
      return NextResponse.json(
        {
          error:
            "Google access token is missing. Please reconnect Google.",
          requiresReconnect: true,
        },
        { status: 403 }
      );
    }

    let accessToken = connection.access_token;

    const expiresAt = connection.token_expires_at
      ? new Date(
          connection.token_expires_at
        ).getTime()
      : 0;

    const shouldRefresh =
      !expiresAt ||
      expiresAt <= Date.now() + 60_000;

    if (shouldRefresh) {
      if (!connection.refresh_token) {
        return NextResponse.json(
          {
            error:
              "Google authorization needs to be renewed. Please reconnect Google.",
            requiresReconnect: true,
          },
          { status: 403 }
        );
      }

      try {
        const refreshed =
          await refreshGoogleAccessToken(
            connection.refresh_token
          );

        accessToken = refreshed.accessToken;

        const newExpiresAt = new Date(
          Date.now() +
            refreshed.expiresIn * 1000
        ).toISOString();

        await supabase
          .from("connected_accounts")
          .update({
            access_token: accessToken,
            token_expires_at: newExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id)
          .eq("user_id", user.id);
      } catch (error) {
        console.error(
          "Unable to refresh Google token:",
          error
        );

        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Google authorization needs to be renewed.",
            requiresReconnect: true,
          },
          { status: 403 }
        );
      }
    }

    const fromEmail =
      connection.account_email ??
      user.email ??
      "";

    if (!fromEmail) {
      return NextResponse.json(
        {
          error:
            "Unable to determine the connected Gmail address.",
        },
        { status: 400 }
      );
    }

    const results: SendResult[] = [];

    for (const recipient of uniqueRecipients) {
      try {
        const mimeMessage =
          createMimeMessage(
            fromEmail,
            recipient.email,
            subject,
            message
          );

        const encodedMessage =
          base64UrlEncode(mimeMessage);

        const gmailResponse = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              raw: encodedMessage,
            }),
            cache: "no-store",
          }
        );

        const gmailData =
          await gmailResponse.json();

        if (!gmailResponse.ok) {
          console.error(
            "Gmail send failed:",
            recipient.email,
            gmailData
          );

          const googleMessage =
            typeof gmailData?.error?.message ===
            "string"
              ? gmailData.error.message
              : "Gmail rejected this message.";

          results.push({
            email: recipient.email,
            name: recipient.name,
            status: "failed",
            error: googleMessage,
          });

          continue;
        }

        results.push({
          email: recipient.email,
          name: recipient.name,
          status: "sent",
          messageId:
            typeof gmailData?.id === "string"
              ? gmailData.id
              : undefined,
          threadId:
            typeof gmailData?.threadId ===
            "string"
              ? gmailData.threadId
              : undefined,
        });
      } catch (error) {
        console.error(
          "Unexpected Gmail send error:",
          recipient.email,
          error
        );

        results.push({
          email: recipient.email,
          name: recipient.name,
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : "Unexpected sending error.",
        });
      }
    }

    const sent = results.filter(
      (result) => result.status === "sent"
    ).length;

    const failed = results.filter(
      (result) => result.status === "failed"
    ).length;

    return NextResponse.json({
      success: sent > 0 && failed === 0,
      results,
      summary: {
        sent,
        failed,
        total: results.length,
      },
      sender: fromEmail,
    });
  } catch (error) {
    console.error(
      "Bulk email send route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to send email.",
      },
      { status: 500 }
    );
  }
}