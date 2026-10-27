import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
          success: false,
          error: "Authentication required.",
          contacts: [],
          count: 0,
        },
        { status: 401 }
      );
    }

    const { data: contacts, error: contactsError } =
      await supabase
        .from("telegram_contacts")
        .select(
          `
            id,
            telegram_chat_id,
            chat_type,
            username,
            first_name,
            last_name,
            title,
            last_message_at,
            last_message_text,
            is_eligible,
            created_at,
            updated_at
          `
        )
        .eq("user_id", user.id)
        .order("last_message_at", {
          ascending: false,
          nullsFirst: false,
        });

    if (contactsError) {
      console.error(
        "Failed to load Telegram contacts:",
        contactsError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load Telegram contacts.",
          contacts: [],
          count: 0,
        },
        { status: 500 }
      );
    }

    const normalizedContacts = (contacts ?? []).map(
      (contact) => {
        const fullName = [
          contact.first_name,
          contact.last_name,
        ]
          .filter(
            (value): value is string =>
              Boolean(value?.trim())
          )
          .join(" ")
          .trim();

        const displayName =
          fullName ||
          contact.title ||
          (contact.username
            ? `@${contact.username}`
            : `Telegram Chat ${contact.telegram_chat_id}`);

        return {
          id: contact.id,

          address: contact.telegram_chat_id,

          chatId: contact.telegram_chat_id,

          name: displayName,

          username: contact.username
            ? `@${contact.username}`
            : null,

          chatType: contact.chat_type,

          firstName: contact.first_name,

          lastName: contact.last_name,

          title: contact.title,

          lastMessageAt: contact.last_message_at,

          lastMessageText: contact.last_message_text,

          isEligible: contact.is_eligible,

          createdAt: contact.created_at,

          updatedAt: contact.updated_at,
        };
      }
    );

    return NextResponse.json({
      success: true,
      contacts: normalizedContacts,
      count: normalizedContacts.length,
    });
  } catch (error) {
    console.error(
      "Telegram contacts API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Telegram contacts.",
        contacts: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}