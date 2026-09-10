"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (data.session?.user) {
        setCheckingSession(false);
        return;
      }

      setCheckingSession(false);
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        /*
         * Check whether the visitor is already an anonymous
         * Supabase user.
         */
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        /*
         * ============================================
         * GUEST -> PERMANENT ACCOUNT
         * ============================================
         *
         * The same Supabase user ID is preserved.
         *
         * Guest credits:
         *     2 Chat Credits
         *
         * After conversion:
         *     4 Chat Credits total
         */
        if (currentUser?.is_anonymous) {
          const { data, error: updateError } =
            await supabase.auth.updateUser({
              email: cleanEmail,
              password,
              data: {
                full_name: fullName.trim(),
              },
            });

          if (updateError) {
            throw updateError;
          }

          if (!data.user) {
            throw new Error("Unable to create your account.");
          }

          /*
           * Replace guest allocation with signup allocation.
           */
          const {
            data: creditData,
            error: creditError,
          } = await supabase.rpc(
            "convert_guest_to_signup_chat_credits"
          );

          if (creditError) {
            console.error(
              "Guest to signup credit conversion error:",
              creditError
            );

            throw new Error(
              "Your account was created, but Chat credits could not be set up. Please refresh and try again."
            );
          }

          console.log(
            "Guest to signup credits:",
            creditData
          );

          setSuccess(
            "Account created successfully. You received 4 Chat Credits."
          );

          setTimeout(() => {
            router.replace("/");
            router.refresh();
          }, 900);

          return;
        }

        /*
         * ============================================
         * NORMAL NEW ACCOUNT
         * ============================================
         */
        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: fullName.trim(),
              },
            },
          });

        if (signUpError) {
          throw signUpError;
        }

        if (!data.user) {
          throw new Error("Unable to create your account.");
        }

        /*
         * If Supabase immediately created an active session,
         * allocate the 4 signup Chat Credits now.
         */
        if (data.session) {
          const {
            data: creditData,
            error: creditError,
          } = await supabase.rpc(
            "setup_signup_chat_credits"
          );

          if (creditError) {
            console.error(
              "Signup credit setup error:",
              creditError
            );

            throw new Error(
              "Your account was created, but Chat credits could not be set up. Please refresh and try again."
            );
          }

          console.log(
            "Signup credits:",
            creditData
          );

          setSuccess(
            "Account created successfully. You received 4 Chat Credits."
          );

          setTimeout(() => {
            router.replace("/");
            router.refresh();
          }, 900);
        } else {
          /*
           * This branch is mainly for projects where email
           * confirmation is enabled.
           *
           * The credit RPC requires an authenticated session,
           * so it will be handled after the user verifies/logs in.
           */
          setSuccess(
            "Account created. Please check your email to verify your account."
          );
        }

        return;
      }

      /*
       * ============================================
       * EXISTING PERMANENT ACCOUNT LOGIN
       * ============================================
       */
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (signInError) {
        throw signInError;
      }

      if (!data.user) {
        throw new Error("Unable to sign in.");
      }

      /*
       * Existing users should not receive signup credits
       * repeatedly. setup_signup_chat_credits() is
       * idempotent through its signup reference.
       *
       * This also makes sure an older account that never
       * received its initial credits can receive them.
       */
      if (!data.user.is_anonymous) {
        const {
          data: creditData,
          error: creditError,
        } = await supabase.rpc(
          "setup_signup_chat_credits"
        );

        if (creditError) {
          console.error(
            "Login credit setup error:",
            creditError
          );
        } else {
          console.log(
            "Login credit check:",
            creditData
          );
        }
      }

      setSuccess("Signed in successfully.");

      setTimeout(() => {
        router.replace("/");
        router.refresh();
      }, 500);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong.";

      if (
        message
          .toLowerCase()
          .includes("invalid login credentials")
      ) {
        setError("Incorrect email or password.");
      } else if (
        message
          .toLowerCase()
          .includes("user already registered")
      ) {
        setError(
          "An account with this email already exists. Please sign in."
        );
      } else if (
        message.toLowerCase().includes("email") &&
        message.toLowerCase().includes("invalid")
      ) {
        setError(
          "Please enter a valid email address."
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const continueAsGuest = async () => {
    setError("");
    setSuccess("");
    setGuestLoading(true);

    try {
      /*
       * Restore an existing browser session first.
       */
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        /*
         * Existing guest/permanent session.
         *
         * If this is a guest, make sure its 2 credits
         * have been allocated.
         */
        if (session.user.is_anonymous) {
          const {
            data: creditData,
            error: creditError,
          } = await supabase.rpc(
            "setup_guest_chat_credits"
          );

          if (creditError) {
            console.error(
              "Existing guest credit setup error:",
              creditError
            );
          } else {
            console.log(
              "Existing guest credits:",
              creditData
            );
          }
        }

        router.replace("/");
        router.refresh();
        return;
      }

      /*
       * ============================================
       * CREATE NEW GUEST
       * ============================================
       */
      const { data, error: guestError } =
        await supabase.auth.signInAnonymously();

      if (guestError) {
        throw guestError;
      }

      if (!data.user) {
        throw new Error(
          "Unable to start Guest Mode."
        );
      }

      /*
       * Allocate exactly 2 Chat Credits.
       */
      const {
        data: creditData,
        error: creditError,
      } = await supabase.rpc(
        "setup_guest_chat_credits"
      );

      if (creditError) {
        console.error(
          "New guest credit setup error:",
          creditError
        );

        throw new Error(
          "Guest Mode started, but Chat credits could not be set up. Please refresh and try again."
        );
      }

      console.log(
        "New guest credits:",
        creditData
      );

      router.replace("/");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to continue as guest.";

      setError(message);
    } finally {
      setGuestLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="zuqen-auth-page">
        <div className="zuqen-auth-loading">
          <div className="zuqen-auth-spinner" />
          <p>Loading ZUQEN AI...</p>
        </div>

        <style jsx>{`
          .zuqen-auth-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background:
              radial-gradient(
                circle at top left,
                rgba(124, 92, 255, 0.18),
                transparent 35%
              ),
              radial-gradient(
                circle at bottom right,
                rgba(0, 200, 255, 0.12),
                transparent 35%
              ),
              #050509;
            color: #fff;
          }

          .zuqen-auth-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 14px;
            color: #a9a9b7;
            font-size: 14px;
          }

          .zuqen-auth-spinner {
            width: 28px;
            height: 28px;
            border: 3px solid rgba(255, 255, 255, 0.12);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="zuqen-auth-page">
      <div className="zuqen-auth-shell">
        <section className="zuqen-auth-brand">
          <div className="zuqen-logo">Z</div>

          <h1>ZUQEN AI</h1>

          <p>
            Your intelligent AI workspace for chat, voice,
            images, video and more.
          </p>

          <div className="zuqen-auth-features">
            <div>
              <span>✦</span>
              <p>Powerful AI tools</p>
            </div>

            <div>
              <span>⚡</span>
              <p>One account, all your credits</p>
            </div>

            <div>
              <span>☁</span>
              <p>Your work available across devices</p>
            </div>
          </div>
        </section>

        <section className="zuqen-auth-card">
          <div className="zuqen-auth-header">
            <h2>
              {mode === "signin"
                ? "Welcome back"
                : "Create your account"}
            </h2>

            <p>
              {mode === "signin"
                ? "Sign in to continue to ZUQEN AI."
                : "Create an account and keep your ZUQEN workspace with you."}
            </p>
          </div>

          <div className="zuqen-auth-tabs">
            <button
              type="button"
              className={
                mode === "signin" ? "active" : ""
              }
              onClick={() => {
                setMode("signin");
                setError("");
                setSuccess("");
              }}
            >
              Sign In
            </button>

            <button
              type="button"
              className={
                mode === "signup" ? "active" : ""
              }
              onClick={() => {
                setMode("signup");
                setError("");
                setSuccess("");
              }}
            >
              Create Account
            </button>
          </div>

          <form
            onSubmit={handleAuth}
            className="zuqen-auth-form"
          >
            {mode === "signup" && (
              <div className="zuqen-field">
                <label htmlFor="fullName">
                  Full name
                </label>

                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="zuqen-field">
              <label htmlFor="email">Email</label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="zuqen-field">
              <label htmlFor="password">
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="At least 6 characters"
                autoComplete={
                  mode === "signin"
                    ? "current-password"
                    : "new-password"
                }
                required
              />
            </div>

            {mode === "signin" && (
              <div className="zuqen-forgot">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setSuccess(
                      "Password reset will be added in the next authentication step."
                    );
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="zuqen-message error">
                {error}
              </div>
            )}

            {success && (
              <div className="zuqen-message success">
                {success}
              </div>
            )}

            <button
              type="submit"
              className="zuqen-primary-button"
              disabled={
                loading || guestLoading
              }
            >
              {loading
                ? mode === "signin"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          <div className="zuqen-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="zuqen-guest-button"
            onClick={continueAsGuest}
            disabled={
              loading || guestLoading
            }
          >
            {guestLoading
              ? "Starting Guest Mode..."
              : "Continue as Guest"}
          </button>

          <p className="zuqen-guest-note">
            Guest Mode lets you try ZUQEN without creating
            an account. You can create an account later and
            keep your guest workspace.
          </p>

          <p className="zuqen-terms">
            By continuing, you agree to use ZUQEN AI responsibly.
          </p>
        </section>
      </div>

      <style jsx>{`
        .zuqen-auth-page {
          min-height: 100vh;
          padding: 32px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(
              circle at 15% 15%,
              rgba(124, 92, 255, 0.18),
              transparent 32%
            ),
            radial-gradient(
              circle at 85% 85%,
              rgba(0, 200, 255, 0.12),
              transparent 32%
            ),
            #050509;
          color: #fff;
        }

        .zuqen-auth-shell {
          width: min(1050px, 100%);
          display: grid;
          grid-template-columns: 1fr 460px;
          gap: 70px;
          align-items: center;
        }

        .zuqen-auth-brand {
          padding: 20px 0;
        }

        .zuqen-logo {
          width: 58px;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          margin-bottom: 24px;
          background: linear-gradient(
            135deg,
            #ffffff,
            #9d9da8
          );
          color: #07070b;
          font-size: 28px;
          font-weight: 900;
          box-shadow:
            0 12px 40px rgba(255, 255, 255, 0.12);
        }

        .zuqen-auth-brand h1 {
          margin: 0;
          font-size: clamp(42px, 6vw, 70px);
          line-height: 0.95;
          letter-spacing: -4px;
        }

        .zuqen-auth-brand > p {
          max-width: 560px;
          margin: 24px 0 0;
          color: #a8a8b5;
          font-size: 18px;
          line-height: 1.7;
        }

        .zuqen-auth-features {
          margin-top: 38px;
          display: grid;
          gap: 16px;
        }

        .zuqen-auth-features div {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .zuqen-auth-features span {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
        }

        .zuqen-auth-features p {
          margin: 0;
          color: #d5d5df;
          font-size: 14px;
        }

        .zuqen-auth-card {
          padding: 30px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 26px;
          background: rgba(15, 15, 22, 0.88);
          box-shadow:
            0 30px 100px rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(24px);
        }

        .zuqen-auth-header h2 {
          margin: 0;
          font-size: 29px;
          letter-spacing: -1px;
        }

        .zuqen-auth-header p {
          margin: 9px 0 0;
          color: #92929f;
          font-size: 14px;
          line-height: 1.6;
        }

        .zuqen-auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
          margin: 26px 0;
          padding: 4px;
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.045);
        }

        .zuqen-auth-tabs button {
          height: 40px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #858592;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }

        .zuqen-auth-tabs button.active {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .zuqen-auth-form {
          display: grid;
          gap: 16px;
        }

        .zuqen-field {
          display: grid;
          gap: 8px;
        }

        .zuqen-field label {
          color: #c5c5cf;
          font-size: 13px;
          font-weight: 600;
        }

        .zuqen-field input {
          width: 100%;
          height: 48px;
          box-sizing: border-box;
          padding: 0 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          outline: none;
          background: rgba(255, 255, 255, 0.045);
          color: #fff;
          font-size: 14px;
          transition: 0.2s ease;
        }

        .zuqen-field input::placeholder {
          color: #646470;
        }

        .zuqen-field input:focus {
          border-color: rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.06);
        }

        .zuqen-forgot {
          display: flex;
          justify-content: flex-end;
          margin-top: -5px;
        }

        .zuqen-forgot button {
          border: 0;
          padding: 0;
          background: transparent;
          color: #aaaab7;
          cursor: pointer;
          font-size: 12px;
        }

        .zuqen-forgot button:hover {
          color: #fff;
        }

        .zuqen-message {
          padding: 11px 13px;
          border-radius: 11px;
          font-size: 13px;
          line-height: 1.5;
        }

        .zuqen-message.error {
          border: 1px solid rgba(255, 90, 90, 0.2);
          background: rgba(255, 90, 90, 0.08);
          color: #ffb0b0;
        }

        .zuqen-message.success {
          border: 1px solid rgba(80, 220, 150, 0.2);
          background: rgba(80, 220, 150, 0.08);
          color: #a9f5ce;
        }

        .zuqen-primary-button,
        .zuqen-guest-button {
          width: 100%;
          height: 48px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 700;
          transition: 0.2s ease;
        }

        .zuqen-primary-button {
          border: 0;
          background: #fff;
          color: #08080c;
        }

        .zuqen-primary-button:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #ededf2;
        }

        .zuqen-guest-button {
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.045);
          color: #fff;
        }

        .zuqen-guest-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
        }

        .zuqen-primary-button:disabled,
        .zuqen-guest-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .zuqen-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 21px 0;
          color: #62626d;
          font-size: 12px;
        }

        .zuqen-divider::before,
        .zuqen-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
        }

        .zuqen-guest-note {
          margin: 12px 10px 0;
          color: #747481;
          text-align: center;
          font-size: 11px;
          line-height: 1.55;
        }

        .zuqen-terms {
          margin: 22px 0 0;
          color: #555560;
          text-align: center;
          font-size: 10px;
          line-height: 1.5;
        }

        @media (max-width: 850px) {
          .zuqen-auth-shell {
            grid-template-columns: 1fr;
            max-width: 520px;
            gap: 30px;
          }

          .zuqen-auth-brand {
            text-align: center;
          }

          .zuqen-logo {
            margin-left: auto;
            margin-right: auto;
          }

          .zuqen-auth-brand > p {
            margin-left: auto;
            margin-right: auto;
          }

          .zuqen-auth-features {
            display: none;
          }
        }

        @media (max-width: 520px) {
          .zuqen-auth-page {
            padding: 18px 12px;
          }

          .zuqen-auth-card {
            padding: 22px 18px;
            border-radius: 20px;
          }

          .zuqen-auth-brand h1 {
            font-size: 43px;
            letter-spacing: -2.5px;
          }

          .zuqen-auth-brand > p {
            font-size: 14px;
          }
        }
      `}</style>
    </main>
  );
}