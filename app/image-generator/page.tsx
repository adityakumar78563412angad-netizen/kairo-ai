"use client";

import { useCallback, useEffect, useState } from "react";
import puter from "@heyputer/puter.js";
import { createClient } from "@/lib/supabase";

const FEATURE_KEY = "image_generator";
const IMAGE_MODEL = "gpt-image-1-mini";
const IMAGE_CREDIT_COST = 1.0;

type ImageError = {
  message?: string;
  code?: string;
  errorCode?: string;
};

type ReservationResult = {
  success?: boolean;
  code?: string;
  reservationId?: string;
  reservation_id?: string;
  provider?: string;
  reserved?: number;
  newBalance?: number;
  new_balance?: number;
};

type SettlementResult = {
  success?: boolean;
  code?: string;
  used?: number;
  refunded?: number;
  newBalance?: number;
  new_balance?: number;
};

type RefundResult = {
  success?: boolean;
  code?: string;
  refunded?: number;
  newBalance?: number;
  new_balance?: number;
};

export default function ImageGeneratorPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [credits, setCredits] = useState(0);
  const [loadingCredits, setLoadingCredits] = useState(true);

  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [lastPrompt, setLastPrompt] = useState("");

  const [downloadName, setDownloadName] = useState(
    "zuqen-generated-image.png"
  );

  /**
   * Load current authenticated user + Image Generator credits.
   */
  const loadCredits = useCallback(async () => {
    setLoadingCredits(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Supabase getUser error:", userError);
        setUserId(null);
        setIsAnonymous(false);
        setCredits(0);
        return;
      }

      if (!user) {
        setUserId(null);
        setIsAnonymous(false);
        setCredits(0);
        return;
      }

      setUserId(user.id);

      const anonymous = Boolean(user.is_anonymous);
      setIsAnonymous(anonymous);

      if (anonymous) {
        setCredits(0);
        return;
      }

      const { data, error: creditError } = await supabase
        .from("feature_credit_balances")
        .select("balance")
        .eq("user_id", user.id)
        .eq("feature_key", FEATURE_KEY)
        .maybeSingle();

      if (creditError) {
        console.error("Image credit load error:", creditError);
        setCredits(0);
        setError(
          "Unable to load your Image Generator credits. Please refresh and try again."
        );
        return;
      }

      setCredits(Number(data?.balance ?? 0));
    } catch (err) {
      console.error("loadCredits error:", err);
      setCredits(0);
    } finally {
      setLoadingCredits(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  /**
   * Reserve 1.00 ZUQEN Image Credit before calling Puter.
   *
   * This prevents generation when the user has no credit.
   */
  const reserveCredit = async (): Promise<string> => {
    if (!userId) {
      throw new Error("Please sign in to generate images.");
    }

    const { data, error } = await supabase.rpc("reserve_feature_credits", {
      p_user_id: userId,
      p_feature_key: FEATURE_KEY,
      p_amount: IMAGE_CREDIT_COST,
      p_provider_request_id: null,
      p_reference_id: null,
      p_metadata: {
        source: "image_generator",
        model: IMAGE_MODEL,
        billing_basis: "successful_image",
        zuqen_credit_cost: IMAGE_CREDIT_COST,
      },
    });

    if (error) {
      console.error("Reserve credit RPC error:", error);
      throw new Error(error.message || "Unable to reserve Image Credit.");
    }

    const result = data as ReservationResult | null;

    if (!result?.success || !result.reservationId && !result?.reservation_id) {
      const code = result?.code || "CREDIT_RESERVATION_FAILED";

      if (code === "INSUFFICIENT_CREDITS") {
        throw new Error(
          "You don't have enough ZUQEN Image Credits. Please add credits to continue."
        );
      }

      throw new Error(
        `Unable to reserve Image Credit (${code}). Please try again.`
      );
    }

    const reservationId =
      result.reservationId || result.reservation_id;

    if (!reservationId) {
      throw new Error("Credit reservation ID was not returned.");
    }

    return reservationId;
  };

  /**
   * Settle reservation after successful image generation.
   *
   * 1 successful image = exactly 1.00 ZUQEN Image Credit.
   */
  const settleCredit = async (reservationId: string) => {
    if (!userId) return;

    const { data, error } = await supabase.rpc(
      "settle_feature_credit_reservation",
      {
        p_reservation_id: reservationId,
        p_actual_amount: IMAGE_CREDIT_COST,
        p_provider_request_id: null,
        p_description: "Successful Image Generator image",
        p_reference_id: null,
        p_metadata: {
          source: "image_generator",
          model: IMAGE_MODEL,
          billing_basis: "successful_image",
          zuqen_credits_used: IMAGE_CREDIT_COST,
        },
      }
    );

    if (error) {
      console.error("Settle credit RPC error:", error);
      throw new Error(
        error.message || "Image generated, but credit settlement failed."
      );
    }

    const result = data as SettlementResult | null;

    if (!result?.success) {
      throw new Error(
        `Image generated, but credit settlement failed (${result?.code || "SETTLEMENT_FAILED"}).`
      );
    }

    const newBalance =
      result.newBalance ?? result.new_balance;

    if (typeof newBalance === "number") {
      setCredits(Number(newBalance));
    } else {
      await loadCredits();
    }
  };

  /**
   * Refund reserved credit if Puter generation fails.
   */
  const refundCredit = async (reservationId: string) => {
    if (!reservationId) return;

    try {
      const { data, error } = await supabase.rpc(
        "refund_feature_credit_reservation",
        {
          p_reservation_id: reservationId,
          p_provider_request_id: null,
          p_description: "Failed Image Generator generation refund",
          p_reference_id: null,
          p_metadata: {
            source: "image_generator",
            model: IMAGE_MODEL,
            reason: "generation_failed",
            zuqen_credit_refunded: IMAGE_CREDIT_COST,
          },
        }
      );

      if (error) {
        console.error("Refund credit RPC error:", error);
        return;
      }

      const result = data as RefundResult | null;

      if (!result?.success) {
        console.error(
          "Credit refund failed:",
          result
        );
        return;
      }

      const newBalance =
        result.newBalance ?? result.new_balance;

      if (typeof newBalance === "number") {
        setCredits(Number(newBalance));
      } else {
        await loadCredits();
      }
    } catch (refundError) {
      console.error("refundCredit error:", refundError);
    }
  };

  /**
   * Convert Puter errors into a readable message.
   */
  const getPuterErrorMessage = (err: unknown): string => {
    console.error("========== PUTER IMAGE ERROR ==========");
    console.error("Raw error:", err);

    if (err && typeof err === "object") {
      const puterError = err as ImageError;

      console.error("Error message:", puterError.message);
      console.error("Error code:", puterError.code);
      console.error("Error errorCode:", puterError.errorCode);

      try {
        console.error(
          "Full error JSON:",
          JSON.stringify(err, null, 2)
        );
      } catch {
        console.error("Could not stringify Puter error.");
      }

      console.error("=======================================");

      if (puterError.errorCode === "insufficient_funds") {
        return "Puter does not have enough available AI usage for this image.";
      }

      if (puterError.errorCode === "moderation_flagged") {
        return "Puter's image safety system rejected this prompt. Please try a different prompt.";
      }

      if (puterError.errorCode === "upstream_failed") {
        return (
          "The image provider failed to generate the image. " +
          "Please try again."
        );
      }

      if (puterError.message) {
        let message = puterError.message;

        if (puterError.code) {
          message += ` (${puterError.code})`;
        }

        if (puterError.errorCode) {
          message += ` [${puterError.errorCode}]`;
        }

        return message;
      }

      if (puterError.code) {
        return `Puter image generation failed (${puterError.code}).`;
      }
    }

    if (err instanceof Error) {
      console.error("=======================================");
      return err.message;
    }

    console.error("=======================================");

    return "Puter image generation failed. Please try again.";
  };

  /**
   * Generate image.
   */
  const generateImage = async () => {
    const trimmedPrompt = prompt.trim();

    setError("");

    if (!trimmedPrompt) {
      setError("Please enter a prompt first.");
      return;
    }

    if (isAnonymous) {
      setError("Please sign in to generate images.");
      return;
    }

    if (!userId) {
      setError("Please sign in to generate images.");
      return;
    }

    if (credits < IMAGE_CREDIT_COST) {
      setError(
        "You don't have enough ZUQEN Image Credits. You need 1.00 credit to generate one image."
      );
      return;
    }

    if (generating) {
      return;
    }

    setGenerating(true);

    let reservationId: string | null = null;

    try {
      /**
       * Make sure Puter is authenticated.
       *
       * Puter has its own authentication system, separate from Supabase.
       */
      try {
        const puterSignedIn = await puter.auth.isSignedIn();

        if (!puterSignedIn) {
          await puter.auth.signIn();
        }
      } catch (puterAuthError) {
        console.error("Puter authentication error:", puterAuthError);

        throw new Error(
          "Puter sign-in is required before generating an image."
        );
      }

      /**
       * Reserve ZUQEN credit first.
       */
      reservationId = await reserveCredit();

      /**
       * Generate image using Puter.
       *
       * Explicit model is important because Puter previously returned:
       * Missing model (bad_request)
       */
      const generatedImage = await puter.ai.txt2img(
        trimmedPrompt,
        {
          model: IMAGE_MODEL,
          quality: "low",
        }
      );

      if (!generatedImage) {
        throw new Error(
          "Puter returned no image."
        );
      }

      const imageSrc = generatedImage.src;

      if (!imageSrc) {
        throw new Error(
          "Puter returned an image without a source."
        );
      }

      /**
       * Image generation succeeded.
       * Now permanently consume exactly 1.00 credit.
       */
      await settleCredit(reservationId);

      setImage(imageSrc);
      setLastPrompt(trimmedPrompt);

      const safeName =
        trimmedPrompt
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) || "zuqen-image";

      setDownloadName(
        `${safeName}-${Date.now()}.png`
      );

      setError("");
    } catch (err) {
      console.error("Image generation failed:", err);

      /**
       * If a credit was reserved but generation failed,
       * return that credit to the user.
       */
      if (reservationId) {
        await refundCredit(reservationId);
      }

      const message = getPuterErrorMessage(err);

      setError(message);
    } finally {
      setGenerating(false);

      /**
       * Refresh actual DB balance.
       */
      await loadCredits();
    }
  };

  /**
   * Regenerate the last prompt.
   */
  const regenerate = async () => {
    if (!lastPrompt) return;

    setPrompt(lastPrompt);

    /**
     * Small timeout allows React to update state before generation.
     */
    setTimeout(() => {
      void generateImageWithPrompt(lastPrompt);
    }, 0);
  };

  /**
   * Internal generation helper for regenerate.
   */
  const generateImageWithPrompt = async (
    value: string
  ) => {
    const trimmedPrompt = value.trim();

    setError("");

    if (!trimmedPrompt) {
      setError("Please enter a prompt first.");
      return;
    }

    if (isAnonymous || !userId) {
      setError("Please sign in to generate images.");
      return;
    }

    if (credits < IMAGE_CREDIT_COST) {
      setError(
        "You don't have enough ZUQEN Image Credits."
      );
      return;
    }

    if (generating) {
      return;
    }

    setGenerating(true);

    let reservationId: string | null = null;

    try {
      try {
        const puterSignedIn = await puter.auth.isSignedIn();

        if (!puterSignedIn) {
          await puter.auth.signIn();
        }
      } catch {
        throw new Error(
          "Puter sign-in is required before generating an image."
        );
      }

      reservationId = await reserveCredit();

      const generatedImage = await puter.ai.txt2img(
        trimmedPrompt,
        {
          model: IMAGE_MODEL,
          quality: "low",
        }
      );

      if (!generatedImage?.src) {
        throw new Error(
          "Puter returned no image."
        );
      }

      await settleCredit(reservationId);

      setImage(generatedImage.src);
      setLastPrompt(trimmedPrompt);

      const safeName =
        trimmedPrompt
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) || "zuqen-image";

      setDownloadName(
        `${safeName}-${Date.now()}.png`
      );

      setError("");
    } catch (err) {
      console.error(
        "Regeneration failed:",
        err
      );

      if (reservationId) {
        await refundCredit(reservationId);
      }

      setError(
        getPuterErrorMessage(err)
      );
    } finally {
      setGenerating(false);
      await loadCredits();
    }
  };

  /**
   * Download generated image.
   */
  const downloadImage = () => {
    if (!image) return;

    const link = document.createElement("a");

    link.href = image;
    link.download = downloadName;

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  /**
   * Clear current image and start fresh.
   */
  const newImage = () => {
    setImage(null);
    setLastPrompt("");
    setPrompt("");
    setError("");
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#ffffff",
        padding: "40px 20px 80px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              opacity: 0.55,
              marginBottom: "10px",
            }}
          >
            ZUQEN AI
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "38px",
              lineHeight: 1.1,
              fontWeight: 700,
            }}
          >
            Image Generator
          </h1>

          <p
            style={{
              marginTop: "12px",
              marginBottom: 0,
              color: "#a8a8a8",
              fontSize: "15px",
            }}
          >
            Create an image from your imagination.
          </p>
        </div>

        {/* Credit Card */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            padding: "18px 20px",
            marginBottom: "24px",
            border: "1px solid #252525",
            borderRadius: "14px",
            background: "#0c0c0c",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "12px",
                color: "#8c8c8c",
                marginBottom: "5px",
              }}
            >
              ZUQEN IMAGE CREDITS
            </div>

            <div
              style={{
                fontSize: "25px",
                fontWeight: 700,
              }}
            >
              {loadingCredits
                ? "Loading..."
                : credits.toFixed(2)}
            </div>
          </div>

          <div
            style={{
              textAlign: "right",
              fontSize: "12px",
              color: "#8c8c8c",
              lineHeight: 1.5,
            }}
          >
            <div>
              1.00 Credit = 1 successful image
            </div>

            <div>
              Model: {IMAGE_MODEL}
            </div>
          </div>
        </div>

        {/* Guest warning */}
        {isAnonymous && (
          <div
            style={{
              padding: "15px 17px",
              marginBottom: "20px",
              border: "1px solid #493d1d",
              borderRadius: "12px",
              background: "#17130a",
              color: "#e7d39b",
              fontSize: "14px",
            }}
          >
            Please sign in to generate images.
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "16px 18px",
              marginBottom: "20px",
              border: "1px solid #512727",
              borderRadius: "12px",
              background: "#170b0b",
              color: "#ffb4b4",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                marginBottom: "5px",
              }}
            >
              Generation failed
            </div>

            <div>{error}</div>
          </div>
        )}

        {/* Prompt */}
        <section
          style={{
            border: "1px solid #252525",
            borderRadius: "16px",
            background: "#0c0c0c",
            padding: "20px",
            marginBottom: "25px",
          }}
        >
          <label
            htmlFor="image-prompt"
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: 600,
              marginBottom: "10px",
            }}
          >
            Describe your image
          </label>

          <textarea
            id="image-prompt"
            value={prompt}
            onChange={(event) =>
              setPrompt(event.target.value)
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.ctrlKey || event.metaKey)
              ) {
                event.preventDefault();
                void generateImage();
              }
            }}
            disabled={generating}
            placeholder="Example: A cinematic futuristic city at sunset, ultra detailed, dramatic lighting..."
            rows={5}
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              minHeight: "130px",
              borderRadius: "12px",
              border: "1px solid #2c2c2c",
              background: "#070707",
              color: "#ffffff",
              padding: "15px",
              outline: "none",
              fontSize: "15px",
              lineHeight: 1.5,
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "15px",
              marginTop: "14px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                color: "#777777",
                fontSize: "12px",
              }}
            >
              Ctrl + Enter to generate
            </div>

            <button
              type="button"
              onClick={() => void generateImage()}
              disabled={
                generating ||
                loadingCredits ||
                isAnonymous ||
                !userId ||
                credits < IMAGE_CREDIT_COST ||
                !prompt.trim()
              }
              style={{
                border: "none",
                borderRadius: "10px",
                padding: "12px 20px",
                background:
                  generating ||
                  loadingCredits ||
                  isAnonymous ||
                  !userId ||
                  credits < IMAGE_CREDIT_COST ||
                  !prompt.trim()
                    ? "#292929"
                    : "#ffffff",
                color:
                  generating ||
                  loadingCredits ||
                  isAnonymous ||
                  !userId ||
                  credits < IMAGE_CREDIT_COST ||
                  !prompt.trim()
                    ? "#777777"
                    : "#000000",
                fontSize: "14px",
                fontWeight: 700,
                cursor:
                  generating ||
                  loadingCredits ||
                  isAnonymous ||
                  !userId ||
                  credits < IMAGE_CREDIT_COST ||
                  !prompt.trim()
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {generating
                ? "Generating..."
                : "Generate Image"}
            </button>
          </div>
        </section>

        {/* Generated Image */}
        {image && (
          <section
            style={{
              border: "1px solid #252525",
              borderRadius: "16px",
              background: "#0c0c0c",
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "15px",
                marginBottom: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                  }}
                >
                  Generated Image
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    color: "#777777",
                    fontSize: "12px",
                  }}
                >
                  1.00 ZUQEN Image Credit used
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={downloadImage}
                  style={{
                    border: "1px solid #303030",
                    borderRadius: "9px",
                    padding: "9px 14px",
                    background: "#151515",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Download
                </button>

                <button
                  type="button"
                  onClick={() => void regenerate()}
                  disabled={generating || credits < 1}
                  style={{
                    border: "1px solid #303030",
                    borderRadius: "9px",
                    padding: "9px 14px",
                    background:
                      generating || credits < 1
                        ? "#101010"
                        : "#ffffff",
                    color:
                      generating || credits < 1
                        ? "#666666"
                        : "#000000",
                    cursor:
                      generating || credits < 1
                        ? "not-allowed"
                        : "pointer",
                    fontSize: "13px",
                  }}
                >
                  Regenerate
                </button>

                <button
                  type="button"
                  onClick={newImage}
                  style={{
                    border: "1px solid #303030",
                    borderRadius: "9px",
                    padding: "9px 14px",
                    background: "#151515",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  New Image
                </button>
              </div>
            </div>

            <div
              style={{
                width: "100%",
                overflow: "hidden",
                borderRadius: "12px",
                background: "#050505",
                border: "1px solid #202020",
              }}
            >
              <img
                src={image}
                alt={lastPrompt || "Generated image"}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                }}
              />
            </div>

            {lastPrompt && (
              <div
                style={{
                  marginTop: "15px",
                  padding: "13px 15px",
                  borderRadius: "10px",
                  background: "#101010",
                  color: "#9a9a9a",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                <strong
                  style={{
                    color: "#cfcfcf",
                  }}
                >
                  Prompt:
                </strong>{" "}
                {lastPrompt}
              </div>
            )}
          </section>
        )}

        {/* Empty state */}
        {!image && !generating && (
          <div
            style={{
              minHeight: "260px",
              border: "1px dashed #292929",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "30px",
              color: "#666666",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "32px",
                  marginBottom: "12px",
                }}
              >
                ✦
              </div>

              <div
                style={{
                  fontSize: "15px",
                  color: "#999999",
                  marginBottom: "5px",
                }}
              >
                Your generated image will appear here.
              </div>

              <div
                style={{
                  fontSize: "12px",
                }}
              >
                Every successful generation uses exactly 1.00
                ZUQEN Image Credit.
              </div>
            </div>
          </div>
        )}

        {/* Generating state */}
        {generating && !image && (
          <div
            style={{
              minHeight: "260px",
              border: "1px solid #252525",
              borderRadius: "16px",
              background: "#0c0c0c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  marginBottom: "8px",
                }}
              >
                Creating your image...
              </div>

              <div
                style={{
                  color: "#777777",
                  fontSize: "13px",
                }}
              >
                Please wait while Puter generates the image.
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}