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
          error: "Authentication required.",
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
        .eq("is_eligible", true)
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
          error: "Unable to load Telegram contacts.",
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
          .filter(Boolean)
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
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Telegram contacts.",
      },
      { status: 500 }
    );
  }
}