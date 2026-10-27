import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramSendResult = {
  contactId: string;
  chatId: string;
  name: string | null;
  status: "sent" | "failed";
  messageId?: number;
  error?: string;
};

type RequestBody = {
  message?: string;
  contactIds?: string[];
};

type TelegramApiResponse = {
  ok: boolean;
  result?: {
    message_id?: number;
  };
  description?: string;
  error_code?: number;
};

const MAX_MESSAGE_LENGTH = 4096;
const MAX_RECIPIENTS = 50;

export async function POST(request: Request) {
  try {
    // ---------------------------------------------------------
    // 1. Authenticate current ZUQEN user
    // ---------------------------------------------------------

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // 2. Read request body
    // ---------------------------------------------------------

    let body: RequestBody;

    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const contactIds = Array.isArray(body.contactIds)
      ? [
          ...new Set(
            body.contactIds.filter(
              (id): id is string =>
                typeof id === "string" && id.trim().length > 0
            )
          ),
        ]
      : [];

    // ---------------------------------------------------------
    // 3. Validate message
    // ---------------------------------------------------------

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "Message cannot be empty.",
        },
        { status: 400 }
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `Telegram messages can contain at most ${MAX_MESSAGE_LENGTH} characters.`,
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 4. Validate recipients
    // ---------------------------------------------------------

    if (contactIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Please select at least one Telegram contact.",
        },
        { status: 400 }
      );
    }

    if (contactIds.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        {
          success: false,
          error: `You can send to a maximum of ${MAX_RECIPIENTS} Telegram contacts per request.`,
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 5. Load the current user's Telegram connection
    // ---------------------------------------------------------

    const { data: connection, error: connectionError } =
      await supabase
        .from("connected_accounts")
        .select(
          `
            id,
            provider,
            provider_account_id,
            access_token,
            status
          `
        )
        .eq("user_id", user.id)
        .eq("provider", "telegram")
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();

    if (connectionError) {
      console.error(
        "Failed to load Telegram connection:",
        connectionError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load your Telegram connection.",
        },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No connected Telegram account was found. Please connect Telegram first.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 6. Get Telegram bot token server-side
    // ---------------------------------------------------------

    const botToken =
      typeof connection.access_token === "string"
        ? connection.access_token.trim()
        : "";

    if (!botToken) {
      console.error(
        "Telegram connection does not contain an access token."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Your Telegram connection is missing its bot token. Please reconnect Telegram.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 7. Load only eligible contacts belonging to this user
    // ---------------------------------------------------------

    const { data: contacts, error: contactsError } =
      await supabase
        .from("telegram_contacts")
        .select(
          `
            id,
            telegram_chat_id,
            username,
            first_name,
            last_name,
            title,
            chat_type,
            is_eligible
          `
        )
        .eq("user_id", user.id)
        .eq("is_eligible", true)
        .in("id", contactIds);

    if (contactsError) {
      console.error(
        "Failed to load Telegram contacts:",
        contactsError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load the selected Telegram contacts.",
        },
        { status: 500 }
      );
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "None of the selected Telegram contacts are currently eligible for messaging.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 8. Protect against invalid/missing chat IDs
    // ---------------------------------------------------------

    const validContacts = contacts.filter(
      (contact) =>
        typeof contact.telegram_chat_id === "string" &&
        contact.telegram_chat_id.trim().length > 0
    );

    if (validContacts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected Telegram contacts do not have valid chat IDs.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 9. Send messages through Telegram Bot API
    // ---------------------------------------------------------

    const results: TelegramSendResult[] = [];

    for (const contact of validContacts) {
      const chatId = contact.telegram_chat_id.trim();

      const fullName = [
        contact.first_name,
        contact.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const displayName =
        fullName ||
        contact.title ||
        (contact.username
          ? `@${contact.username}`
          : null);

      try {
        const telegramResponse = await fetch(
          `https://api.telegram.org/bot${encodeURIComponent(
            botToken
          )}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
            }),
            cache: "no-store",
          }
        );

        let telegramData: TelegramApiResponse | null =
          null;

        try {
          telegramData =
            (await telegramResponse.json()) as TelegramApiResponse;
        } catch {
          telegramData = null;
        }

        if (
          telegramResponse.ok &&
          telegramData?.ok === true
        ) {
          results.push({
            contactId: contact.id,
            chatId,
            name: displayName,
            status: "sent",
            messageId:
              telegramData.result?.message_id,
          });

          continue;
        }

        const telegramError =
          telegramData?.description ||
          `Telegram API returned HTTP ${telegramResponse.status}.`;

        console.error(
          "Telegram send failed:",
          {
            contactId: contact.id,
            chatId,
            error: telegramError,
          }
        );

        results.push({
          contactId: contact.id,
          chatId,
          name: displayName,
          status: "failed",
          error: telegramError,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unable to send Telegram message.";

        console.error(
          "Telegram request error:",
          {
            contactId: contact.id,
            chatId,
            error: errorMessage,
          }
        );

        results.push({
          contactId: contact.id,
          chatId,
          name: displayName,
          status: "failed",
          error: errorMessage,
        });
      }
    }

    // ---------------------------------------------------------
    // 10. Build summary
    // ---------------------------------------------------------

    const sent = results.filter(
      (result) => result.status === "sent"
    ).length;

    const failed = results.filter(
      (result) => result.status === "failed"
    ).length;

    return NextResponse.json({
      success: sent > 0,
      provider: "telegram",
      message,
      summary: {
        requested: contactIds.length,
        eligible: validContacts.length,
        sent,
        failed,
      },
      results,
    });
  } catch (error) {
    console.error(
      "Telegram bulk send API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to send Telegram messages.",
      },
      { status: 500 }
    );
  }
}