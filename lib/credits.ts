import { createServerSupabaseClient } from "@/lib/supabase-server";

export type ConsumeCreditsResult = {
  success: boolean;
  code?: string;
  amount?: number;
  balance?: number;
  required?: number;
};

export async function getCreditBalance(): Promise<number> {
  const supabase =
    await createServerSupabaseClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_credit_balance"
  );

  if (error) {
    console.error(
      "Failed to get credit balance:",
      error
    );

    throw new Error(
      "Unable to load credit balance."
    );
  }

  return Number(data ?? 0);
}

export async function consumeCredits(
  amount: number,
  agent: string,
  description?: string,
  referenceId?: string
): Promise<ConsumeCreditsResult> {
  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Credit amount must be a positive integer."
    );
  }

  if (!agent.trim()) {
    throw new Error(
      "Agent name is required."
    );
  }

  const supabase =
    await createServerSupabaseClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    "consume_credits",
    {
      p_amount: amount,
      p_agent: agent,
      p_description:
        description ?? null,
      p_reference_id:
        referenceId ?? null,
    }
  );

  if (error) {
    console.error(
      "Failed to consume credits:",
      error
    );

    throw new Error(
      "Unable to process credits."
    );
  }

  return data as ConsumeCreditsResult;
}