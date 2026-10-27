import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramGetMeResponse = {
  ok?: boolean;
  description?: string;
  result?: {
    id?: number;
    is_bot?: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
};

type TelegramSetWebhookResponse = {
  ok?: boolean;
  description?: string;
};

export async function POST(request: Request) {
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

    let body: {
      botToken?: string;
    };

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

    const botToken =
      typeof body.botToken === "string"
        ? body.botToken.trim()
        : "";

    if (!botToken) {
      return NextResponse.json(
        {
          error: "Telegram bot token is required.",
        },
        { status: 400 }
      );
    }

    if (botToken.length > 300) {
      return NextResponse.json(
        {
          error: "Invalid Telegram bot token.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 1. Verify the Telegram bot token
    // --------------------------------------------------

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(
        botToken
      )}/getMe`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const telegramData =
      (await telegramResponse.json()) as TelegramGetMeResponse;

    if (
      !telegramResponse.ok ||
      !telegramData.ok ||
      !telegramData.result?.id ||
      telegramData.result.is_bot !== true
    ) {
      return NextResponse.json(
        {
          error:
            telegramData.description ??
            "Telegram rejected this bot token.",
        },
        { status: 400 }
      );
    }

    const bot = telegramData.result;

    const botName =
      [bot.first_name, bot.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      bot.username ||
      "Telegram Bot";

    const accountName = bot.username
      ? `@${bot.username}`
      : botName;

    const scopes = ["telegram.bot"];

    // --------------------------------------------------
    // 2. Save/update the Telegram connection
    // --------------------------------------------------

    const {
      data: existingConnection,
      error: lookupError,
    } = await supabase
      .from("connected_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "telegram")
      .eq("provider_account_id", String(bot.id))
      .maybeSingle();

    if (lookupError) {
      console.error(
        "Telegram connection lookup failed:",
        lookupError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check the existing Telegram connection.",
        },
        { status: 500 }
      );
    }

    if (existingConnection) {
      const { error: updateError } = await supabase
        .from("connected_accounts")
        .update({
          account_name: accountName,
          account_email: null,
          access_token: botToken,
          refresh_token: null,
          token_expires_at: null,
          scopes,
          status: "connected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingConnection.id)
        .eq("user_id", user.id);

      if (updateError) {
        console.error(
          "Telegram connection update failed:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              "Telegram was verified but could not be saved.",
          },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from("connected_accounts")
        .insert({
          user_id: user.id,
          provider: "telegram",
          provider_account_id: String(bot.id),
          account_name: accountName,
          account_email: null,
          access_token: botToken,
          refresh_token: null,
          token_expires_at: null,
          scopes,
          status: "connected",
        });

      if (insertError) {
        console.error(
          "Telegram connection insert failed:",
          insertError
        );

        return NextResponse.json(
          {
            error:
              "Telegram was verified but could not be saved.",
          },
          { status: 500 }
        );
      }
    }

    // --------------------------------------------------
    // 3. Automatically register the Telegram webhook
    // --------------------------------------------------

    const webhookUrl =
      "https://zuqen.vercel.app/api/connections/telegram/webhook";

    const webhookResponse = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(
        botToken
      )}/setWebhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message"],
          drop_pending_updates: false,
        }),
        cache: "no-store",
      }
    );

    const webhookData =
      (await webhookResponse.json()) as TelegramSetWebhookResponse;

    if (
      !webhookResponse.ok ||
      !webhookData.ok
    ) {
      console.error(
        "Telegram webhook setup failed:",
        webhookData
      );

      return NextResponse.json(
        {
          error:
            webhookData.description ??
            "Telegram connected, but webhook setup failed.",
        },
        { status: 502 }
      );
    }

    // --------------------------------------------------
    // 4. Everything succeeded
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      connection: {
        provider: "telegram",
        providerAccountId: String(bot.id),
        accountName,
        username: bot.username
          ? `@${bot.username}`
          : null,
      },

      webhook: {
        configured: true,
        url: webhookUrl,
      },
    });
  } catch (error) {
    console.error(
      "Telegram connection error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to connect Telegram.",
      },
      { status: 500 }
    );
  }
}