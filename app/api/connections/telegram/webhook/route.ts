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

export async function GET() {
  return NextResponse.json({
    success: true,
    service: "telegram-webhook",
    status: "online",
  });
}

export async function POST(request: Request) {
  try {
    const update =
      (await request.json()) as TelegramUpdate;

    console.log(
      "Telegram webhook update received:",
      JSON.stringify({
        updateId: update?.update_id,
        hasMessage: Boolean(update?.message),
        chatId: update?.message?.chat?.id ?? null,
      })
    );

    const message = update?.message;
    const chat = message?.chat;

    if (!chat?.id) {
      return NextResponse.json({
        success: true,
        received: true,
        ignored: true,
        reason: "No chat in update.",
      });
    }

    const supabase =
      await createServerSupabaseClient();

    /*
     * Get all connected Telegram bots.
     *
     * Telegram webhook updates do not contain the bot
     * token directly, so for the current one-bot-per-user
     * setup we use the connected Telegram account.
     *
     * If multiple Telegram bots are connected later,
     * webhook secret-token routing should be added.
     */
    const {
      data: connections,
      error: connectionError,
    } = await supabase
      .from("connected_accounts")
      .select(
        "id, user_id, provider, provider_account_id, access_token, status"
      )
      .eq("provider", "telegram")
      .eq("status", "connected")
      .order("created_at", {
        ascending: true,
      });

    if (connectionError) {
      console.error(
        "Failed to load Telegram connections:",
        connectionError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load Telegram connections.",
        },
        { status: 500 }
      );
    }

    if (!connections || connections.length === 0) {
      console.error(
        "Telegram webhook received but no connected Telegram bot exists."
      );

      return NextResponse.json({
        success: true,
        received: true,
        ignored: true,
        reason: "No connected Telegram bot.",
      });
    }

    /*
     * Current ZUQEN setup supports one Telegram bot per
     * connected user. Pick the first active connection.
     *
     * This keeps compatibility with the current database
     * and existing Telegram connection system.
     */
    const connection = connections[0];

    if (!connection?.user_id) {
      console.error(
        "Telegram connection does not contain a user_id."
      );

      return NextResponse.json({
        success: true,
        received: true,
        ignored: true,
      });
    }

    const telegramChatId = String(chat.id);

    const username =
      chat.username ??
      message?.from?.username ??
      null;

    const firstName =
      chat.first_name ??
      message?.from?.first_name ??
      null;

    const lastName =
      chat.last_name ??
      message?.from?.last_name ??
      null;

    const lastMessageText =
      typeof message?.text === "string"
        ? message.text
        : null;

    const lastMessageAt =
      typeof message?.date === "number"
        ? new Date(
            message.date * 1000
          ).toISOString()
        : new Date().toISOString();

    /*
     * Save or update the Telegram contact.
     */
    const {
      data: savedContact,
      error: upsertError,
    } = await supabase
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
      )
      .select(
        `
          id,
          telegram_chat_id,
          username,
          first_name,
          last_name,
          is_eligible
        `
      )
      .single();

    if (upsertError) {
      console.error(
        "Failed to save Telegram contact:",
        upsertError
      );

      return NextResponse.json(
        {
          success: false,
          received: true,
          contactSaved: false,
          error:
            "Unable to save Telegram contact.",
        },
        { status: 500 }
      );
    }

    console.log(
      "Telegram contact saved successfully:",
      {
        contactId: savedContact?.id,
        chatId: telegramChatId,
        userId: connection.user_id,
        eligible: savedContact?.is_eligible,
      }
    );

    return NextResponse.json({
      success: true,
      received: true,
      contactSaved: true,
      contact: savedContact ?? null,
    });
  } catch (error) {
    console.error(
      "Telegram webhook error:",
      error
    );

    /*
     * Return HTTP 200 to Telegram for malformed/unsupported
     * updates so Telegram does not continuously retry them.
     */
    return NextResponse.json({
      success: true,
      received: true,
      ignored: true,
    });
  }
}