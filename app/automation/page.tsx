"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase";

type TaskStatus =
  | "queued"
  | "planning"
  | "planned"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

type StepStatus =
  | "queued"
  | "ready"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";

type AutomationPlanStep = {
  step_number: number;
  name: string;
  description: string;
  tool_name: string;
  input?: Record<string, unknown>;
  dependencies?: number[];
  requires_approval?: boolean;
  max_retries?: number;
};

type AutomationTask = {
  id: string;
  title: string;
  prompt: string;
  status: TaskStatus;
  plan?: {
    goal?: string;
    summary?: string;
    steps?: AutomationPlanStep[];
  } | null;
  result?: Record<string, unknown> | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at?: string | null;
};

type AutomationRun = {
  id: string;
  status: string;
  run_number: number;
  trigger_type: string;
  started_at?: string | null;
  completed_at?: string | null;
};

type AutomationStep = {
  id: string;
  step_number: number;
  name: string;
  description: string;
  tool_name: string;
  status: StepStatus;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  dependencies?: string[] | null;
  retry_count: number;
  max_retries: number;
  error_code?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

type AutomationState = {
  task: AutomationTask | null;
  run: AutomationRun | null;
  steps: AutomationStep[];
};

type SessionResult = {
  accessToken: string;
  userId: string;
};

const supabase = createClient();

const POLL_INTERVAL = 1500;
const MAX_POLL_TIME = 5 * 60 * 1000;

const EXAMPLE_PROMPTS = [
  "Research the latest developments in AI agents and summarize the most important findings with relevant sources.",
  "Research the current AI automation market and identify the major technologies being used.",
  "Research the latest advances in generative AI and create a concise research summary with sources.",
];

function statusLabel(status: string) {
  switch (status) {
    case "queued":
      return "Queued";
    case "planning":
      return "Planning";
    case "planned":
      return "Plan ready";
    case "running":
      return "Running";
    case "waiting_approval":
      return "Waiting for approval";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "ready":
      return "Ready";
    case "skipped":
      return "Skipped";
    default:
      return status.replace(/_/g, " ");
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "completed":
      return "✓";
    case "failed":
      return "!";
    case "cancelled":
      return "×";
    case "running":
      return "●";
    case "planning":
    case "queued":
    case "ready":
    case "planned":
    case "waiting_approval":
      return "○";
    case "skipped":
      return "–";
    default:
      return "○";
  }
}

function formatTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function safeJson(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function extractResearchSources(
  result: Record<string, unknown> | null | undefined
) {
  if (!result || typeof result !== "object") {
    return [];
  }

  const output =
    result.output &&
    typeof result.output === "object"
      ? (result.output as Record<string, unknown>)
      : result;

  const sources = Array.isArray(output.sources)
    ? output.sources
    : [];

  return sources.filter(
    (source): source is Record<string, unknown> =>
      Boolean(
        source &&
          typeof source === "object" &&
          !Array.isArray(source)
      )
  );
}

function extractResearchAnswer(
  result: Record<string, unknown> | null | undefined
) {
  if (!result || typeof result !== "object") {
    return "";
  }

  const output =
    result.output &&
    typeof result.output === "object"
      ? (result.output as Record<string, unknown>)
      : result;

  return typeof output.answer === "string"
    ? output.answer
    : "";
}

function isFinished(status?: string | null) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  );
}

async function getAutomationSession(): Promise<SessionResult> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Automation session error:", error);

    throw new Error(
      "Unable to read your ZUQEN session. Please refresh the page and try again."
    );
  }

  if (!session?.access_token || !session.user?.id) {
    throw new Error(
      "Your ZUQEN session is not available. Please sign in again."
    );
  }

  return {
    accessToken: session.access_token,
    userId: session.user.id,
  };
}

function automationHeaders(accessToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

export default function AutomationPage() {
  const [input, setInput] = useState("");

  const [state, setState] = useState<AutomationState>({
    task: null,
    run: null,
    steps: [],
  });

  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState(false);
  const [error, setError] = useState("");
  const [showExamples, setShowExamples] = useState(false);

  const pollTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollStartedRef = useRef<number>(0);

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null);

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  const loadAutomationState = useCallback(
    async (
      taskId: string,
      runId?: string
    ): Promise<AutomationState | null> => {
      setLoadingState(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "Please sign in to use Automation Mode."
          );
        }

        const { data: task, error: taskError } =
          await supabase
            .from("automation_tasks")
            .select(
              [
                "id",
                "title",
                "prompt",
                "status",
                "plan",
                "result",
                "error_code",
                "error_message",
                "created_at",
                "updated_at",
                "started_at",
                "completed_at",
              ].join(", ")
            )
            .eq("id", taskId)
            .eq("user_id", user.id)
            .single();

        if (taskError || !task) {
          throw new Error(
            "Unable to load automation task."
          );
        }

        let run: AutomationRun | null = null;

        if (runId) {
          const { data: runData, error: runError } =
            await supabase
              .from("automation_runs")
              .select(
                [
                  "id",
                  "status",
                  "run_number",
                  "trigger_type",
                  "started_at",
                  "completed_at",
                ].join(", ")
              )
              .eq("id", runId)
              .eq("task_id", taskId)
              .eq("user_id", user.id)
              .maybeSingle();

          if (runError) {
            console.error(
              "Automation run load error:",
              runError
            );
          }

          if (runData) {
            run = runData as unknown as AutomationRun;
          }
        } else {
          const { data: runData, error: runError } =
            await supabase
              .from("automation_runs")
              .select(
                [
                  "id",
                  "status",
                  "run_number",
                  "trigger_type",
                  "started_at",
                  "completed_at",
                ].join(", ")
              )
              .eq("task_id", taskId)
              .eq("user_id", user.id)
              .order("run_number", {
                ascending: false,
              })
              .limit(1)
              .maybeSingle();

          if (runError) {
            console.error(
              "Automation latest run load error:",
              runError
            );
          }

          if (runData) {
            run = runData as unknown as AutomationRun;
          }
        }

        let steps: AutomationStep[] = [];

        if (run?.id) {
          const { data: stepData, error: stepError } =
            await supabase
              .from("automation_steps")
              .select(
                [
                  "id",
                  "step_number",
                  "name",
                  "description",
                  "tool_name",
                  "status",
                  "input",
                  "output",
                  "dependencies",
                  "retry_count",
                  "max_retries",
                  "error_code",
                  "error_message",
                  "started_at",
                  "completed_at",
                ].join(", ")
              )
              .eq("task_id", taskId)
              .eq("run_id", run.id)
              .order("step_number", {
                ascending: true,
              });

          if (stepError) {
            console.error(
              "Automation step load error:",
              stepError
            );
          }

          if (stepData) {
            steps =
              stepData as unknown as AutomationStep[];
          }
        }

        const nextState: AutomationState = {
          task: task as unknown as AutomationTask,
          run,
          steps,
        };

        setState(nextState);

        return nextState;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to load automation state.";

        setError(message);

        return null;
      } finally {
        setLoadingState(false);
      }
    },
    []
  );

  const startPolling = useCallback(
    (taskId: string, runId: string) => {
      clearPolling();

      pollStartedRef.current = Date.now();

      const poll = async () => {
        if (
          Date.now() - pollStartedRef.current >
          MAX_POLL_TIME
        ) {
          setError(
            "Automation status polling timed out. The task may still be running."
          );

          return;
        }

        const nextState =
          await loadAutomationState(
            taskId,
            runId
          );

        if (
          nextState?.task &&
          isFinished(nextState.task.status)
        ) {
          return;
        }

        if (
          nextState?.task?.status ===
          "waiting_approval"
        ) {
          return;
        }

        pollTimerRef.current = setTimeout(
          poll,
          POLL_INTERVAL
        );
      };

      void poll();
    },
    [clearPolling, loadAutomationState]
  );

  const runAutomation = useCallback(async () => {
    const prompt = input.trim();

    if (!prompt) {
      setError(
        "Tell ZUQEN what you want to automate."
      );

      textareaRef.current?.focus();

      return;
    }

    if (prompt.length > 10000) {
      setError(
        "Automation request cannot exceed 10,000 characters."
      );

      return;
    }

    clearPolling();
    setError("");
    setLoading(true);

    setState({
      task: null,
      run: null,
      steps: [],
    });

    try {
      const { accessToken } =
        await getAutomationSession();

      const response = await fetch(
        "/api/automation",
        {
          method: "POST",
          headers:
            automationHeaders(accessToken),
          body: JSON.stringify({
            prompt,
          }),
        }
      );

      const data =
        (await response.json().catch(
          () => ({})
        )) as {
          success?: boolean;
          taskId?: string;
          runId?: string;
          status?: TaskStatus;
          plan?: AutomationTask["plan"];
          error?: string;
          errorCode?: string;
        };

      if (
        !response.ok ||
        !data.success ||
        !data.taskId
      ) {
        throw new Error(
          data.error ||
            "Unable to create automation."
        );
      }

      await loadAutomationState(
        data.taskId,
        data.runId
      );

      if (!data.runId) {
        throw new Error(
          "Automation run was not initialized."
        );
      }

      const executeResponse =
        await fetch(
          "/api/automation/execute",
          {
            method: "POST",
            headers:
              automationHeaders(
                accessToken
              ),
            body: JSON.stringify({
              taskId: data.taskId,
              runId: data.runId,
            }),
          }
        );

      const executeData =
        (await executeResponse
          .json()
          .catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          errorCode?: string;
        };

      if (
        !executeResponse.ok ||
        !executeData.success
      ) {
        throw new Error(
          executeData.error ||
            "Automation execution failed to start."
        );
      }

      startPolling(
        data.taskId,
        data.runId
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to run automation.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    clearPolling,
    input,
    loadAutomationState,
    startPolling,
  ]);

  const handleKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        if (!loading) {
          void runAutomation();
        }
      }
    },
    [loading, runAutomation]
  );

  const currentStepNumber = useMemo(() => {
    const runningStep =
      state.steps.find(
        (step) =>
          step.status === "running"
      );

    if (runningStep) {
      return runningStep.step_number;
    }

    const waitingStep =
      state.steps.find(
        (step) =>
          step.status ===
          "waiting_approval"
      );

    if (waitingStep) {
      return waitingStep.step_number;
    }

    const readyStep =
      state.steps.find(
        (step) =>
          step.status === "ready"
      );

    return readyStep?.step_number ?? 0;
  }, [state.steps]);

  const completedSteps =
    state.steps.filter(
      (step) =>
        step.status === "completed"
    ).length;

  const progress =
    state.steps.length > 0
      ? Math.round(
          (completedSteps /
            state.steps.length) *
            100
        )
      : state.task?.status === "completed"
        ? 100
        : 0;

  const researchSources =
    extractResearchSources(
      state.task?.result
    );

  const researchAnswer =
    extractResearchAnswer(
      state.task?.result
    );

  const planSteps =
    state.task?.plan?.steps ?? [];

  const displaySteps: AutomationStep[] =
    state.steps.length > 0
      ? state.steps
      : planSteps.map(
          (step): AutomationStep => ({
            id: `plan-${step.step_number}`,
            step_number:
              step.step_number,
            name: step.name,
            description:
              step.description,
            tool_name:
              step.tool_name,
            status: "queued",
            input:
              step.input ?? null,
            output: null,
            dependencies: null,
            retry_count: 0,
            max_retries:
              step.max_retries ?? 2,
            error_code: null,
            error_message: null,
            started_at: null,
            completed_at: null,
          })
        );

  return (
    <main className="min-h-screen bg-[#07080b] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-lg font-semibold">
                Z
              </div>

              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  ZUQEN Automation
                </h1>

                <p className="text-xs text-white/45">
                  Independent AI automation engine
                </p>
              </div>
            </div>
          </div>

          <a
            href="/"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            Back to ZUQEN
          </a>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-h-[620px] flex-col rounded-3xl border border-white/10 bg-white/[0.025] shadow-2xl shadow-black/20">
            <div className="border-b border-white/10 px-5 py-5 sm:px-7">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-white/55">
                  Automation Mode
                </span>

                {state.task && (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/55">
                    {statusLabel(
                      state.task.status
                    )}
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                What do you want me to automate?
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                Describe the outcome you want. ZUQEN will
                create an execution plan and run the available
                automation tools.
              </p>
            </div>

            <div className="flex flex-1 flex-col p-5 sm:p-7">
              {!state.task && (
                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                  {EXAMPLE_PROMPTS.map(
                    (example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() =>
                          setInput(example)
                        }
                        className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left text-xs leading-5 text-white/55 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white/80"
                      >
                        {example}
                      </button>
                    )
                  )}
                </div>
              )}

              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) =>
                    setInput(
                      event.target.value
                    )
                  }
                  onKeyDown={handleKeyDown}
                  disabled={
                    loading ||
                    Boolean(
                      state.task &&
                        !isFinished(
                          state.task.status
                        ) &&
                        state.task.status !==
                          "waiting_approval"
                    )
                  }
                  maxLength={10000}
                  rows={7}
                  placeholder="Example: Research the latest AI agent developments, compare the major approaches, and give me a concise source-backed summary."
                  className="w-full resize-none rounded-3xl border border-white/10 bg-black/30 px-5 py-5 pr-5 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-white/25"
                />

                <div className="pointer-events-none absolute bottom-4 right-4 text-[11px] text-white/25">
                  {input.length}/10,000
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowExamples(
                      (value) => !value
                    )
                  }
                  className="text-xs text-white/40 transition hover:text-white/70"
                >
                  {showExamples
                    ? "Hide examples"
                    : "Need an example?"}
                </button>

                <button
                  type="button"
                  disabled={
                    loading ||
                    !input.trim()
                  }
                  onClick={() =>
                    void runAutomation()
                  }
                  className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {loading
                    ? "Starting..."
                    : "Run Automation"}
                </button>
              </div>

              {showExamples && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/35">
                    Examples
                  </p>

                  <div className="space-y-2">
                    {EXAMPLE_PROMPTS.map(
                      (example) => (
                        <button
                          key={`detail-${example}`}
                          type="button"
                          onClick={() => {
                            setInput(
                              example
                            );
                            setShowExamples(
                              false
                            );
                            textareaRef.current?.focus();
                          }}
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/55 transition hover:bg-white/[0.05] hover:text-white"
                        >
                          {example}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {state.task && (
                <div className="mt-8">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/35">
                        Execution
                      </p>

                      <h3 className="mt-1 text-lg font-semibold">
                        {state.task.title}
                      </h3>

                      <p className="mt-1 text-xs text-white/30">
                        Created{" "}
                        {formatDate(
                          state.task.created_at
                        )}
                      </p>
                    </div>

                    <span className="text-sm text-white/45">
                      {progress}%
                    </span>
                  </div>

                  <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>

                  {currentStepNumber > 0 &&
                    !isFinished(
                      state.task.status
                    ) && (
                      <p className="mb-4 text-xs text-white/35">
                        Current step:{" "}
                        {currentStepNumber}
                      </p>
                    )}

                  <div className="space-y-3">
                    {displaySteps.map(
                      (step) => (
                        <div
                          key={step.id}
                          className={`rounded-2xl border px-4 py-4 transition ${
                            step.status ===
                            "running"
                              ? "border-white/25 bg-white/[0.06]"
                              : step.status ===
                                  "completed"
                                ? "border-white/10 bg-white/[0.025]"
                                : step.status ===
                                    "failed"
                                  ? "border-red-400/20 bg-red-400/[0.04]"
                                  : step.status ===
                                      "waiting_approval"
                                    ? "border-yellow-400/20 bg-yellow-400/[0.04]"
                                    : "border-white/10 bg-white/[0.015]"
                          }`}
                        >
                          <div className="flex gap-4">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm ${
                                step.status ===
                                "completed"
                                  ? "border-white/20 bg-white/10"
                                  : step.status ===
                                      "failed"
                                    ? "border-red-400/30 bg-red-400/10 text-red-200"
                                    : step.status ===
                                        "running"
                                      ? "border-white/30 bg-white/10"
                                      : step.status ===
                                          "waiting_approval"
                                        ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
                                        : "border-white/10 bg-white/[0.03] text-white/45"
                              }`}
                            >
                              {statusIcon(
                                step.status
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium">
                                    {step.step_number}.{" "}
                                    {step.name}
                                  </p>

                                  <p className="mt-1 text-xs text-white/35">
                                    {step.tool_name}
                                  </p>
                                </div>

                                <span className="text-xs capitalize text-white/40">
                                  {statusLabel(
                                    step.status
                                  )}
                                </span>
                              </div>

                              <p className="mt-3 text-sm leading-6 text-white/45">
                                {step.description}
                              </p>

                              {step.status ===
                                "running" && (
                                <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                                  Executing step{" "}
                                  {
                                    step.step_number
                                  }
                                  ...
                                </div>
                              )}

                              {step.status ===
                                "waiting_approval" && (
                                <div className="mt-3 rounded-xl border border-yellow-400/15 bg-yellow-400/[0.05] p-3">
                                  <p className="text-xs font-medium text-yellow-100">
                                    Approval required
                                  </p>

                                  <p className="mt-1 text-xs leading-5 text-yellow-100/60">
                                    This step requires explicit approval before the automation can continue.
                                  </p>
                                </div>
                              )}

                              {step.status ===
                                "failed" &&
                                step.error_message && (
                                  <div className="mt-3 rounded-xl border border-red-400/10 bg-red-400/[0.04] p-3 text-xs text-red-200/80">
                                    {step.error_message}
                                  </div>
                                )}

                              {step.status ===
                                "completed" &&
                                step.completed_at && (
                                  <p className="mt-3 text-[11px] text-white/25">
                                    Completed{" "}
                                    {formatTime(
                                      step.completed_at
                                    )}
                                  </p>
                                )}

                              {step.retry_count >
                                0 && (
                                <p className="mt-2 text-[11px] text-white/25">
                                  Retries:{" "}
                                  {
                                    step.retry_count
                                  }
                                  /
                                  {
                                    step.max_retries
                                  }
                                </p>
                              )}

                              {step.output &&
                                Object.keys(
                                  step.output
                                ).length >
                                  0 && (
                                  <details className="mt-3">
                                    <summary className="cursor-pointer text-xs text-white/35 hover:text-white/60">
                                      View step output
                                    </summary>

                                    <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] leading-5 text-white/45">
                                      {safeJson(
                                        step.output
                                      )}
                                    </pre>
                                  </details>
                                )}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {state.task.plan && (
                    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                      <p className="text-xs uppercase tracking-wider text-white/30">
                        Execution plan
                      </p>

                      {state.task.plan.goal && (
                        <div className="mt-3">
                          <p className="text-xs text-white/30">
                            Goal
                          </p>

                          <p className="mt-1 text-sm leading-6 text-white/65">
                            {state.task.plan.goal}
                          </p>
                        </div>
                      )}

                      {state.task.plan.summary && (
                        <div className="mt-4">
                          <p className="text-xs text-white/30">
                            Strategy
                          </p>

                          <p className="mt-1 text-sm leading-6 text-white/50">
                            {
                              state.task
                                .plan
                                .summary
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {state.task.status ===
                    "completed" &&
                    (researchAnswer ||
                      researchSources.length >
                        0) && (
                      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
                        <div className="mb-5">
                          <p className="text-xs uppercase tracking-wider text-white/30">
                            Result
                          </p>

                          <h3 className="mt-1 text-xl font-semibold">
                            Automation completed
                          </h3>
                        </div>

                        {researchAnswer && (
                          <div className="whitespace-pre-wrap text-sm leading-7 text-white/70">
                            {researchAnswer}
                          </div>
                        )}

                        {researchSources.length >
                          0 && (
                          <div className="mt-7">
                            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">
                              Sources
                            </p>

                            <div className="space-y-2">
                              {researchSources.map(
                                (
                                  source,
                                  index
                                ) => {
                                  const title =
                                    typeof source.title ===
                                    "string"
                                      ? source.title
                                      : `Source ${index + 1}`;

                                  const url =
                                    typeof source.url ===
                                    "string"
                                      ? source.url
                                      : "";

                                  const snippet =
                                    typeof source.content ===
                                    "string"
                                      ? source.content
                                      : typeof source.snippet ===
                                          "string"
                                        ? source.snippet
                                        : "";

                                  return (
                                    <div
                                      key={`${url}-${index}`}
                                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-white/75">
                                            {title}
                                          </p>

                                          {url && (
                                            <a
                                              href={
                                                url
                                              }
                                              target="_blank"
                                              rel="noreferrer"
                                              className="mt-1 block truncate text-xs text-white/35 hover:text-white/60"
                                            >
                                              {
                                                url
                                              }
                                            </a>
                                          )}
                                        </div>

                                        <span className="text-[11px] text-white/20">
                                          {index +
                                            1}
                                        </span>
                                      </div>

                                      {snippet && (
                                        <p className="mt-3 text-xs leading-5 text-white/40">
                                          {
                                            snippet
                                          }
                                        </p>
                                      )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  {state.task.status ===
                    "completed" &&
                    !researchAnswer &&
                    researchSources.length ===
                      0 &&
                    state.task.result && (
                      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5">
                        <p className="mb-3 text-xs uppercase tracking-wider text-white/30">
                          Result
                        </p>

                        <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/30 p-4 text-xs leading-6 text-white/50">
                          {safeJson(
                            state.task.result
                          )}
                        </pre>
                      </div>
                    )}

                  {state.task.status ===
                    "failed" && (
                    <div className="mt-8 rounded-3xl border border-red-400/20 bg-red-400/[0.04] p-5">
                      <p className="text-xs uppercase tracking-wider text-red-200/50">
                        Automation failed
                      </p>

                      <h3 className="mt-1 text-lg font-semibold text-red-100">
                        The automation could not complete.
                      </h3>

                      {state.task.error_code && (
                        <p className="mt-3 text-xs text-red-200/40">
                          Error code:{" "}
                          {state.task.error_code}
                        </p>
                      )}

                      {state.task.error_message && (
                        <p className="mt-2 text-sm leading-6 text-red-200/70">
                          {
                            state.task
                              .error_message
                          }
                        </p>
                      )}
                    </div>
                  )}

                  {state.task.status ===
                    "cancelled" && (
                    <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5">
                      <p className="text-xs uppercase tracking-wider text-white/30">
                        Automation cancelled
                      </p>

                      <p className="mt-2 text-sm text-white/50">
                        This automation run was cancelled before completion.
                      </p>
                    </div>
                  )}

                  {state.run && (
                    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/25">
                      <span>
                        Run #
                        {state.run.run_number}
                      </span>

                      <span>
                        Trigger:{" "}
                        {state.run.trigger_type}
                      </span>

                      {state.run.started_at && (
                        <span>
                          Started{" "}
                          {formatTime(
                            state.run
                              .started_at
                          )}
                        </span>
                      )}

                      {state.run.completed_at && (
                        <span>
                          Finished{" "}
                          {formatTime(
                            state.run
                              .completed_at
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-xs uppercase tracking-wider text-white/30">
                How it works
              </p>

              <div className="mt-5 space-y-4">
                {[
                  [
                    "01",
                    "Understand",
                    "ZUQEN interprets your requested outcome.",
                  ],
                  [
                    "02",
                    "Plan",
                    "The automation planner converts the request into executable steps.",
                  ],
                  [
                    "03",
                    "Execute",
                    "The independent execution engine runs compatible tools.",
                  ],
                  [
                    "04",
                    "Verify",
                    "Results and step states are recorded for inspection.",
                  ],
                ].map(
                  ([number, title, description]) => (
                    <div
                      key={number}
                      className="flex gap-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[10px] text-white/40">
                        {number}
                      </span>

                      <div>
                        <p className="text-sm font-medium text-white/70">
                          {title}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-white/35">
                          {description}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-xs uppercase tracking-wider text-white/30">
                Current automation
              </p>

              {!state.task ? (
                <p className="mt-4 text-sm leading-6 text-white/35">
                  No automation is running. Describe the outcome you want and start a new run.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-[11px] text-white/25">
                      Status
                    </p>

                    <p className="mt-1 text-sm text-white/65">
                      {statusLabel(
                        state.task.status
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] text-white/25">
                      Steps
                    </p>

                    <p className="mt-1 text-sm text-white/65">
                      {completedSteps} /{" "}
                      {displaySteps.length}{" "}
                      completed
                    </p>
                  </div>

                  {loadingState && (
                    <div className="flex items-center gap-2 text-xs text-white/35">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      Updating status...
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-xs uppercase tracking-wider text-white/30">
                Important
              </p>

              <p className="mt-3 text-xs leading-6 text-white/35">
                Automation Mode is an independent execution system. It does not automatically reuse or orchestrate the existing ZUQEN Website Builder, Image Generator, Video Generator, or Voice Generator agents.
              </p>
            </div>
          </aside>
        </section>

        <footer className="mt-8 border-t border-white/10 pt-5 text-center text-[11px] text-white/20">
          ZUQEN Automation • Independent automation engine
        </footer>
      </div>
    </main>
  );
}