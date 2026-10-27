import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUpdate = {
  update_id?: number;

  message?: {
    message_id?: number;
    text?: string;

    date?: number;

    chat?: {
      id?: number | string;
      type?: string;
      title?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };

    from?: {
      id?: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  };
};

export async function POST(request: Request) {
  try {
    const update =
      (await request.json()) as TelegramUpdate;

    const chat = update?.message?.chat;

    // Ignore updates that do not contain a chat.
    if (!chat?.id) {
      return NextResponse.json({
        success: true,
        ignored: true,
      });
    }

    const supabase =
      await createServerSupabaseClient();

    /*
     * Find the ZUQEN user who owns this Telegram bot.
     *
     * We identify the bot using the Telegram bot_id
     * that Telegram sends inside the webhook request.
     *
     * For now, Telegram webhook updates are matched
     * using the bot token configured for the connection.
     */

    const { data: connections, error: connectionError } =
      await supabase
        .from("connected_accounts")
        .select(
          "id, user_id, provider, provider_account_id, access_token"
        )
        .eq("provider", "telegram")
        .eq("status", "connected");

    if (connectionError) {
      console.error(
        "Failed to load Telegram connections:",
        connectionError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load Telegram connections.",
        },
        { status: 500 }
      );
    }

    /*
     * We currently support one Telegram bot per ZUQEN
     * user. The first active Telegram connection is
     * used for this webhook.
     */
    const connection = connections?.[0];

    if (!connection) {
      console.error(
        "No connected Telegram bot found."
      );

      return NextResponse.json({
        success: true,
        ignored: true,
      });
    }

    const telegramChatId = String(chat.id);

    const username =
      chat.username ??
      update?.message?.from?.username ??
      null;

    const firstName =
      chat.first_name ??
      update?.message?.from?.first_name ??
      null;

    const lastName =
      chat.last_name ??
      update?.message?.from?.last_name ??
      null;

    const lastMessageText =
      typeof update?.message?.text === "string"
        ? update.message.text
        : null;

    const lastMessageAt =
      typeof update?.message?.date === "number"
        ? new Date(
            update.message.date * 1000
          ).toISOString()
        : new Date().toISOString();

    /*
     * Save the Telegram chat.
     *
     * If the same user + chat already exists,
     * update it instead of creating a duplicate.
     */
    const { error: upsertError } =
      await supabase
        .from("telegram_contacts")
        .upsert(
          {
            user_id: connection.user_id,

            telegram_chat_id: telegramChatId,

            chat_type:
              chat.type ?? null,

            username,

            first_name: firstName,

            last_name: lastName,

            title:
              chat.title ?? null,

            last_message_at:
              lastMessageAt,

            last_message_text:
              lastMessageText,

            is_eligible: true,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "user_id,telegram_chat_id",
          }
        );

    if (upsertError) {
      console.error(
        "Failed to save Telegram contact:",
        upsertError
      );

      return NextResponse.json(
        {
          error:
            "Unable to save Telegram contact.",
        },
        { status: 500 }
      );
    }

    console.log(
      "Telegram contact saved:",
      telegramChatId
    );

    return NextResponse.json({
      success: true,
      received: true,
      contactSaved: true,
    });
  } catch (error) {
    console.error(
      "Telegram webhook error:",
      error
    );

    /*
     * Return 200 so Telegram knows the webhook
     * request was received.
     */
    return NextResponse.json({
      success: true,
    });
  }
}