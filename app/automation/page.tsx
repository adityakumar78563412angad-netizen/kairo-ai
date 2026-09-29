"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase";

type AutomationStatus =
  | "idle"
  | "creating"
  | "planning"
  | "ready"
  | "running"
  | "completed"
  | "failed";

type AutomationStep = {
  id?: string;
  step_number: number;
  name: string;
  description?: string;
  tool_name: string;
  status?: string;
  requires_approval?: boolean;
};

type AutomationTask = {
  id: string;
  prompt: string;
  title?: string | null;
  summary?: string | null;
  status?: string | null;
  run_id?: string | null;
  steps?: AutomationStep[];
};

type Particle = {
  x: number;
  y: number;
  size: number;
  opacity: number;
  angle: number;
  radius: number;
  speed: number;
  drift: number;
};

type AutomationStatusResponse = {
  success?: boolean;
  error?: string;
  task?: {
    id: string;
    prompt?: string;
    title?: string | null;
    summary?: string | null;
    status?: string | null;
  };
  run?: {
    id: string;
    task_id: string;
    status?: string | null;
    result?: unknown;
    error?: string | null;
  } | null;
  steps?: AutomationStep[];
  progress?: {
    completed: number;
    running: number;
    failed: number;
    waiting: number;
    total: number;
    percentage: number;
  };
  terminal?: boolean;
  completed?: boolean;
  failed?: boolean;
  waiting_approval?: boolean;
};

const supabase = createClient();

const TOOL_LABELS: Record<string, string> = {
  web_search: "Web Search",
  web_research: "Web Research",
  data_transform: "Data Transform",
  document: "Document",
  http_request: "HTTP Request",
  file_read: "File Read",
  file_write: "File Write",
  spreadsheet: "Spreadsheet",
  notification: "Notification",
  email: "Email",
  calendar: "Calendar",
  crm: "CRM",
  browser: "Browser",
};

function createParticles(
  count: number
): Particle[] {
  return Array.from(
    { length: count },
    (_, index) => {
      const angle =
        (Math.PI * 2 * index) / count +
        (Math.random() - 0.5) * 0.35;

      return {
        x: Math.random(),
        y: Math.random(),
        size:
          0.7 +
          Math.random() * 2.6,
        opacity:
          0.15 +
          Math.random() * 0.75,
        angle,
        radius:
          65 +
          Math.random() * 125,
        speed:
          0.00015 +
          Math.random() * 0.00045,
        drift:
          (Math.random() - 0.5) *
          0.0015,
      };
    }
  );
}

function getStatusLabel(
  status: AutomationStatus
) {
  switch (status) {
    case "creating":
      return "Creating automation";

    case "planning":
      return "Planning your task";

    case "ready":
      return "Automation ready";

    case "running":
      return "Automation running";

    case "completed":
      return "Automation completed";

    case "failed":
      return "Automation failed";

    default:
      return "Ready when you are";
  }
}

function getStepStatusIcon(
  status?: string
) {
  switch (status) {
    case "completed":
    case "success":
      return "✓";

    case "running":
    case "executing":
      return "◌";

    case "failed":
      return "×";

    case "waiting":
    case "waiting_approval":
    case "approval_required":
      return "⋯";

    default:
      return "○";
  }
}

function normalizeSteps(
  value: unknown
): AutomationStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const steps: AutomationStep[] = [];

  value.forEach((item, index) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      return;
    }

    const step =
      item as Record<string, unknown>;

    const normalizedStep: AutomationStep =
      {
        step_number:
          typeof step.step_number ===
          "number"
            ? step.step_number
            : index + 1,

        name:
          typeof step.name ===
          "string"
            ? step.name
            : `Step ${index + 1}`,

        description:
          typeof step.description ===
          "string"
            ? step.description
            : "",

        tool_name:
          typeof step.tool_name ===
          "string"
            ? step.tool_name
            : "unknown",

        status:
          typeof step.status ===
          "string"
            ? step.status
            : "queued",

        requires_approval:
          Boolean(
            step.requires_approval
          ),
      };

    if (
      typeof step.id === "string"
    ) {
      normalizedStep.id =
        step.id;
    }

    steps.push(
      normalizedStep
    );
  });

  return steps;
}

function extractTaskFromResponse(
  data: any
): AutomationTask | null {
  const candidate =
    data?.task ??
    data?.automation ??
    data?.data ??
    data;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    return null;
  }

  const id =
    typeof candidate.id ===
    "string"
      ? candidate.id
      : typeof candidate.taskId ===
          "string"
        ? candidate.taskId
        : typeof candidate.task_id ===
            "string"
          ? candidate.task_id
          : null;

  if (!id) {
    return null;
  }

  const runId =
    typeof candidate.run_id ===
    "string"
      ? candidate.run_id
      : typeof candidate.runId ===
          "string"
        ? candidate.runId
        : null;

  const planSteps =
    candidate?.plan &&
    typeof candidate.plan ===
      "object" &&
    !Array.isArray(
      candidate.plan
    )
      ? (
          candidate.plan as Record<
            string,
            unknown
          >
        ).steps
      : undefined;

  const rawSteps =
    candidate.steps ??
    planSteps;

  return {
    id,

    prompt:
      typeof candidate.prompt ===
      "string"
        ? candidate.prompt
        : "",

    title:
      typeof candidate.title ===
      "string"
        ? candidate.title
        : null,

    summary:
      typeof candidate.summary ===
      "string"
        ? candidate.summary
        : null,

    status:
      typeof candidate.status ===
      "string"
        ? candidate.status
        : null,

    run_id: runId,

    steps:
      normalizeSteps(rawSteps),
  };
}

function ParticleField({
  active,
}: {
  active: boolean;
}) {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  const particlesRef =
    useRef<Particle[]>(
      createParticles(150)
    );

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const context =
      canvas.getContext("2d");

    if (!context) return;

    let animationFrame = 0;
    let destroyed = false;

    const resize = () => {
      const ratio =
        Math.min(
          window.devicePixelRatio ||
            1,
          2
        );

      const width =
        canvas.clientWidth;

      const height =
        canvas.clientHeight;

      canvas.width =
        width * ratio;

      canvas.height =
        height * ratio;

      context.setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
      );
    };

    const draw = (
      timestamp: number
    ) => {
      if (destroyed) return;

      const width =
        canvas.clientWidth;

      const height =
        canvas.clientHeight;

      context.clearRect(
        0,
        0,
        width,
        height
      );

      const centerX =
        width / 2;

      const centerY =
        height / 2;

      const pulse =
        active
          ? 1 +
            Math.sin(
              timestamp *
                0.003
            ) *
              0.055
          : 1 +
            Math.sin(
              timestamp *
                0.0012
            ) *
              0.025;

      for (const particle of
        particlesRef.current) {
        particle.angle +=
          particle.speed *
          (active ? 2.2 : 1);

        particle.radius +=
          particle.drift *
          (active ? 1.8 : 1);

        if (
          particle.radius <
            55 ||
          particle.radius >
            205
        ) {
          particle.drift *= -1;
        }

        const radius =
          particle.radius *
          pulse;

        const x =
          centerX +
          Math.cos(
            particle.angle
          ) *
            radius;

        const y =
          centerY +
          Math.sin(
            particle.angle
          ) *
            radius *
            0.76;

        const glow =
          context.createRadialGradient(
            x,
            y,
            0,
            x,
            y,
            particle.size *
              5
          );

        glow.addColorStop(
          0,
          `rgba(245,245,255,${particle.opacity})`
        );

        glow.addColorStop(
          0.25,
          `rgba(190,190,220,${particle.opacity * 0.35})`
        );

        glow.addColorStop(
          1,
          "rgba(100,100,130,0)"
        );

        context.fillStyle =
          glow;

        context.beginPath();

        context.arc(
          x,
          y,
          particle.size * 5,
          0,
          Math.PI * 2
        );

        context.fill();

        context.fillStyle =
          `rgba(255,255,255,${particle.opacity})`;

        context.beginPath();

        context.arc(
          x,
          y,
          particle.size,
          0,
          Math.PI * 2
        );

        context.fill();
      }

      animationFrame =
        requestAnimationFrame(
          draw
        );
    };

    resize();

    window.addEventListener(
      "resize",
      resize
    );

    animationFrame =
      requestAnimationFrame(draw);

    return () => {
      destroyed = true;

      cancelAnimationFrame(
        animationFrame
      );

      window.removeEventListener(
        "resize",
        resize
      );
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}

function Core({
  active,
}: {
  active: boolean;
}) {
  return (
    <div
      className={`relative flex h-[320px] w-[320px] items-center justify-center transition-transform duration-1000 sm:h-[390px] sm:w-[390px] ${
        active
          ? "scale-105"
          : "scale-100"
      }`}
    >
      <div className="absolute h-[190px] w-[190px] rounded-full bg-white/[0.025] blur-[70px]" />

      <div className="absolute h-[120px] w-[120px] rounded-full border border-white/[0.035] bg-white/[0.015] shadow-[0_0_100px_rgba(255,255,255,0.035)] backdrop-blur-[2px]" />

      <ParticleField
        active={active}
      />

      <div
        className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.025] shadow-[0_0_45px_rgba(255,255,255,0.08)] transition-all duration-700 ${
          active
            ? "scale-110 shadow-[0_0_70px_rgba(255,255,255,0.14)]"
            : ""
        }`}
      >
        <div className="h-2 w-2 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.9)]" />
      </div>
    </div>
  );
}

function StepTimeline({
  steps,
}: {
  steps: AutomationStep[];
}) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
          Execution plan
        </span>

        <span className="text-[11px] text-white/25">
          {steps.length}{" "}
          {steps.length === 1
            ? "step"
            : "steps"}
        </span>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl">
        {steps.map(
          (
            step,
            index
          ) => (
            <div
              key={
                step.id ??
                `${step.step_number}-${index}`
              }
              className={`relative flex items-center gap-4 px-4 py-4 sm:px-5 ${
                index !==
                steps.length - 1
                  ? "border-b border-white/[0.055]"
                  : ""
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs ${
                  step.status ===
                    "completed" ||
                  step.status ===
                    "success"
                    ? "border-white/20 bg-white/10 text-white"
                    : step.status ===
                          "running" ||
                        step.status ===
                          "executing"
                      ? "border-white/15 bg-white/[0.07] text-white"
                      : step.status ===
                          "failed"
                        ? "border-white/15 bg-white/[0.05] text-white/70"
                        : step.status ===
                              "waiting_approval" ||
                            step.status ===
                              "approval_required" ||
                            step.status ===
                              "waiting"
                          ? "border-white/15 bg-white/[0.06] text-white/60"
                          : "border-white/[0.08] bg-white/[0.025] text-white/35"
                }`}
              >
                {getStepStatusIcon(
                  step.status
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-white/85">
                    {step.name}
                  </p>

                  {step.requires_approval && (
                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/35">
                      approval
                    </span>
                  )}
                </div>

                <p className="mt-1 truncate text-xs text-white/30">
                  {TOOL_LABELS[
                    step.tool_name
                  ] ??
                    step.tool_name}
                </p>

                {step.status ===
                  "running" && (
                  <p className="mt-1 text-[10px] text-white/25">
                    Executing...
                  </p>
                )}

                {step.status ===
                  "failed" && (
                  <p className="mt-1 text-[10px] text-white/35">
                    Step failed
                  </p>
                )}

                {step.status ===
                    "waiting_approval" ||
                  step.status ===
                    "approval_required" ? (
                  <p className="mt-1 text-[10px] text-white/25">
                    Waiting for approval
                  </p>
                ) : null}
              </div>

              <span className="text-[10px] text-white/20">
                {String(
                  step.step_number
                ).padStart(2, "0")}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function AutomationPage() {
  const [input, setInput] =
    useState("");

  const [status, setStatus] =
    useState<AutomationStatus>(
      "idle"
    );

  const [task, setTask] =
    useState<AutomationTask | null>(
      null
    );

  const [error, setError] =
    useState("");

  const [
    progress,
    setProgress,
  ] = useState({
    completed: 0,
    running: 0,
    failed: 0,
    waiting: 0,
    total: 0,
    percentage: 0,
  });

  const [
    mobileInfoOpen,
    setMobileInfoOpen,
  ] = useState(false);

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(
      null
    );

  const executionStartedRef =
    useRef(false);

  const executionRequestRef =
    useRef<Promise<void> | null>(
      null
    );

  const pollTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const mountedRef =
    useRef(true);

  const active =
    status === "creating" ||
    status === "planning" ||
    status === "running";

  const hasPlan =
    Boolean(
      task?.steps &&
        task.steps.length > 0
    );

  const resetComposerHeight =
    useCallback(() => {
      const textarea =
        textareaRef.current;

      if (!textarea) return;

      textarea.style.height =
        "auto";

      textarea.style.height =
        `${Math.min(
          textarea.scrollHeight,
          180
        )}px`;
    }, []);

  useEffect(() => {
    resetComposerHeight();
  }, [
    input,
    resetComposerHeight,
  ]);

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;

      if (
        pollTimerRef.current
      ) {
        clearTimeout(
          pollTimerRef.current
        );

        pollTimerRef.current =
          null;
      }
    };
  }, []);

  const getAuthHeaders =
    useCallback(
      async (): Promise<HeadersInit> => {
        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        const headers: HeadersInit =
          {
            "Content-Type":
              "application/json",
          };

        if (
          session?.access_token
        ) {
          headers.Authorization =
            `Bearer ${session.access_token}`;
        }

        return headers;
      },
      []
    );

  const refreshAutomationStatus =
    useCallback(
      async (
        taskId: string,
        runId?: string | null
      ): Promise<
        AutomationStatusResponse | null
      > => {
        try {
          const params =
            new URLSearchParams();

          params.set(
            "taskId",
            taskId
          );

          if (runId) {
            params.set(
              "runId",
              runId
            );
          }

          const headers =
            await getAuthHeaders();

          const response =
            await fetch(
              `/api/automation/status?${params.toString()}`,
              {
                method: "GET",
                headers,
                cache: "no-store",
              }
            );

          const raw =
            await response.text();

          let data: AutomationStatusResponse =
            {};

          try {
            data = raw
              ? JSON.parse(raw)
              : {};
          } catch {
            throw new Error(
              "Automation status returned an invalid response."
            );
          }

          if (!response.ok) {
            throw new Error(
              data?.error ||
                `Unable to read automation status (${response.status}).`
            );
          }

          if (
            !mountedRef.current
          ) {
            return data;
          }

          if (
            Array.isArray(
              data.steps
            )
          ) {
            setTask(
              previous => {
                if (!previous) {
                  return previous;
                }

                return {
                  ...previous,
                  status:
                    data.task
                      ?.status ??
                    previous.status,
                  title:
                    data.task
                      ?.title ??
                    previous.title,
                  summary:
                    data.task
                      ?.summary ??
                    previous.summary,
                  steps:
                    normalizeSteps(
                      data.steps
                    ),
                };
              }
            );
          }

          if (data.progress) {
            setProgress(
              data.progress
            );
          }

          if (
            data.waiting_approval
          ) {
            setStatus(
              "ready"
            );

            return data;
          }

          if (data.failed) {
            setStatus(
              "failed"
            );

            const failedStep =
              data.steps?.find(
                step =>
                  step.status ===
                  "failed"
              );

            setError(
              failedStep
                ? `Automation step ${failedStep.step_number} failed.`
                : data.run
                    ?.error ||
                    data.error ||
                    "Automation execution failed."
            );

            return data;
          }

          if (data.completed) {
            setStatus(
              "completed"
            );

            return data;
          }

          return data;
        } catch (caught) {
          console.error(
            "Automation status refresh error:",
            caught
          );

          return null;
        }
      },
      [getAuthHeaders]
    );

  const stopPolling =
    useCallback(() => {
      if (
        pollTimerRef.current
      ) {
        clearTimeout(
          pollTimerRef.current
        );

        pollTimerRef.current =
          null;
      }
    }, []);

  const pollAutomation =
    useCallback(
      async (
        taskId: string,
        runId: string
      ) => {
        stopPolling();

        const poll = async () => {
          if (
            !mountedRef.current
          ) {
            return;
          }

          const result =
            await refreshAutomationStatus(
              taskId,
              runId
            );

          if (
            !mountedRef.current
          ) {
            return;
          }

          if (
            result?.terminal ||
            result?.completed ||
            result?.failed ||
            result?.waiting_approval
          ) {
            return;
          }

          pollTimerRef.current =
            setTimeout(
              poll,
              1000
            );
        };

        await poll();
      },
      [
        refreshAutomationStatus,
        stopPolling,
      ]
    );

  const createAutomation =
    useCallback(
      async () => {
        const prompt =
          input.trim();

        if (!prompt || active) {
          return;
        }

        stopPolling();

        setError("");
        setProgress({
          completed: 0,
          running: 0,
          failed: 0,
          waiting: 0,
          total: 0,
          percentage: 0,
        });
        setStatus("creating");

        try {
          const {
            data: { user },
          } =
            await supabase.auth.getUser();

          if (!user) {
            throw new Error(
              "Authentication required."
            );
          }

          const headers =
            await getAuthHeaders();

          const response =
            await fetch(
              "/api/automation",
              {
                method: "POST",
                headers,
                body: JSON.stringify({
                  prompt,
                }),
              }
            );

          const raw =
            await response.text();

          let data: any = {};

          try {
            data = raw
              ? JSON.parse(raw)
              : {};
          } catch {
            throw new Error(
              "Automation server returned an invalid response."
            );
          }

          if (!response.ok) {
            throw new Error(
              data?.error ||
                data?.message ||
                `Automation request failed (${response.status}).`
            );
          }

          const created =
            extractTaskFromResponse(
              data
            );

          if (!created) {
            console.error(
              "Automation API response did not contain a usable task:",
              data
            );

            throw new Error(
              "Automation task was created but no task ID was returned."
            );
          }

          const createdSteps =
            created.steps ?? [];

          setTask({
            ...created,
            prompt,
          });

          setProgress({
            completed: 0,
            running: 0,
            failed: 0,
            waiting: 0,
            total:
              createdSteps.length,
            percentage: 0,
          });

          setStatus("planning");

          if (
            createdSteps.length > 0 ||
            created.status ===
              "planned" ||
            created.status ===
              "ready"
          ) {
            setStatus("ready");
          }
        } catch (caught) {
          console.error(
            "Automation creation error:",
            caught
          );

          setError(
            caught instanceof Error
              ? caught.message
              : "Automation could not be created."
          );

          setStatus("failed");
        }
      },
      [
        active,
        getAuthHeaders,
        input,
        stopPolling,
      ]
    );

  const executeAutomation =
    useCallback(
      async () => {
        if (
          !task?.id ||
          active ||
          executionStartedRef.current
        ) {
          return;
        }

        if (!task.run_id) {
          setError(
            "This automation does not have a valid execution run."
          );

          setStatus("failed");

          return;
        }

        executionStartedRef.current =
          true;

        setError("");

        setProgress(
          previous => ({
            ...previous,
            percentage:
              previous.total >
              0
                ? previous.percentage
                : 0,
          })
        );

        setStatus("running");

        const taskId =
          task.id;

        const runId =
          task.run_id;

        try {
          /*
           * Start execution without making the UI
           * wait for the entire automation.
           *
           * The execution request continues on
           * the server while the frontend polls
           * the database-backed status endpoint.
           */
          const executionPromise =
            (async () => {
              try {
                const headers =
                  await getAuthHeaders();

                const response =
                  await fetch(
                    "/api/automation/execute",
                    {
                      method: "POST",
                      headers,
                      body: JSON.stringify({
                        taskId,
                        runId,
                      }),
                    }
                  );

                const raw =
                  await response.text();

                let data: any = {};

                try {
                  data = raw
                    ? JSON.parse(raw)
                    : {};
                } catch {
                  throw new Error(
                    "Automation execution returned an invalid response."
                  );
                }

                if (!response.ok) {
                  throw new Error(
                    data?.error ||
                      data?.message ||
                      "Automation execution failed."
                  );
                }

                return data;
              } catch (caught) {
                console.error(
                  "Automation execution request error:",
                  caught
                );

                return {
                  __executionError:
                    caught instanceof Error
                      ? caught.message
                      : "Automation execution failed.",
                };
              }
            })();

          executionRequestRef.current =
            executionPromise.then(
              () => undefined
            );

          /*
           * Immediately start status polling.
           */
          await pollAutomation(
            taskId,
            runId
          );

          /*
           * Polling is authoritative for the
           * visible automation state.
           *
           * If the execution request itself
           * returns an error, perform one final
           * status read before showing failure.
           */
          const executionResult =
            await executionPromise;

          if (
            executionResult?.__executionError
          ) {
            const latest =
              await refreshAutomationStatus(
                taskId,
                runId
              );

            if (
              latest?.completed
            ) {
              setStatus(
                "completed"
              );
            } else if (
              latest?.failed
            ) {
              setStatus(
                "failed"
              );

              setError(
                latest.run
                  ?.error ||
                  executionResult.__executionError
              );
            } else {
              setStatus(
                "failed"
              );

              setError(
                executionResult.__executionError
              );
            }
          } else {
            const latest =
              await refreshAutomationStatus(
                taskId,
                runId
              );

            if (
              latest?.completed
            ) {
              setStatus(
                "completed"
              );
            } else if (
              latest?.failed
            ) {
              setStatus(
                "failed"
              );

              setError(
                latest.run
                  ?.error ||
                  "Automation execution failed."
              );
            }
          }
        } finally {
          executionStartedRef.current =
            false;

          executionRequestRef.current =
            null;
        }
      },
      [
        active,
        getAuthHeaders,
        pollAutomation,
        refreshAutomationStatus,
        task,
      ]
    );

  const startOver =
    useCallback(() => {
      stopPolling();

      executionStartedRef.current =
        false;

      executionRequestRef.current =
        null;

      setInput("");
      setTask(null);
      setError("");
      setProgress({
        completed: 0,
        running: 0,
        failed: 0,
        waiting: 0,
        total: 0,
        percentage: 0,
      });
      setStatus("idle");
      setMobileInfoOpen(false);
    }, [stopPolling]);

  const suggestions = useMemo(
    () => [
      "Research the latest AI trends and create a report",
      "Analyze my data and create a spreadsheet summary",
      "Research competitors and create a comparison document",
      "Find information and notify me when the task is complete",
    ],
    []
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030305] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-30%] h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-white/[0.018] blur-[150px]" />

        <div className="absolute bottom-[-25%] left-[10%] h-[500px] w-[500px] rounded-full bg-white/[0.012] blur-[140px]" />

        <div className="absolute right-[-10%] top-[20%] h-[500px] w-[500px] rounded-full bg-white/[0.009] blur-[130px]" />
      </div>

      <header className="relative z-30 flex h-16 items-center justify-between border-b border-white/[0.055] px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              window.location.href =
                "/";
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Back to ZUQEN"
          >
            ←
          </button>

          <div>
            <div className="text-sm font-semibold tracking-[0.16em] text-white">
              ZUQEN
            </div>

            <div className="text-[9px] uppercase tracking-[0.22em] text-white/25">
              Automation
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30 sm:block">
            Autonomous workspace
          </div>

          <button
            onClick={() =>
              setMobileInfoOpen(
                value => !value
              )
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/50 hover:bg-white/[0.06] hover:text-white"
            aria-label="Automation information"
          >
            i
          </button>
        </div>
      </header>

      {mobileInfoOpen && (
        <div className="absolute right-4 top-20 z-40 w-[280px] rounded-2xl border border-white/[0.08] bg-[#0a0a0d]/95 p-4 shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-medium text-white/75">
            ZUQEN Automation
          </p>

          <p className="mt-2 text-xs leading-5 text-white/35">
            Describe a goal and ZUQEN
            will turn it into an
            executable automation plan.
          </p>
        </div>
      )}

      <section className="relative z-10 flex min-h-[calc(100vh-64px)] flex-col">
        <div
          className={`mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 transition-all duration-700 ${
            hasPlan
              ? "justify-start pt-10 sm:pt-14"
              : "justify-center pb-16"
          }`}
        >
          <Core active={active} />

          <div
            className={`-mt-8 w-full text-center transition-all duration-700 ${
              hasPlan
                ? "sm:-mt-12"
                : ""
            }`}
          >
            <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.38em] text-white/25">
              ZUQEN AUTOMATION
            </div>

            <h1 className="text-3xl font-medium tracking-[-0.035em] text-white/90 sm:text-5xl">
              {status ===
              "completed"
                ? "Automation complete"
                : status ===
                    "failed"
                  ? "Something went wrong"
                  : status ===
                      "running"
                    ? "ZUQEN is working"
                    : "What do you want to automate?"}
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/30 sm:text-base">
              {status ===
              "running"
                ? progress.total >
                  0
                  ? `Executing ${progress.completed} of ${progress.total} steps.`
                  : "Your automation is executing its plan."
                : status ===
                    "completed"
                  ? "The automation has finished processing your request."
                  : "Describe the outcome you want. ZUQEN will plan the work and execute the required steps."}
            </p>
          </div>

          {!hasPlan && (
            <div className="mt-9 w-full max-w-3xl">
              <div className="rounded-[28px] border border-white/[0.09] bg-white/[0.025] p-1.5 shadow-[0_20px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
                <div className="rounded-[22px] border border-white/[0.045] bg-[#0a0a0d]/90 p-4">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={event =>
                      setInput(
                        event.target.value
                      )
                    }
                    onKeyDown={event => {
                      if (
                        event.key ===
                          "Enter" &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();

                        void createAutomation();
                      }
                    }}
                    placeholder="Describe what you want ZUQEN to do..."
                    rows={1}
                    maxLength={20_000}
                    disabled={active}
                    className="max-h-[180px] min-h-[72px] w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 text-white outline-none placeholder:text-white/20 sm:text-base"
                  />

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.055] pt-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/[0.06] px-2.5 py-1 text-[9px] uppercase tracking-wider text-white/25">
                        AI Planner
                      </span>

                      <span className="hidden text-[10px] text-white/20 sm:block">
                        Enter to run
                      </span>
                    </div>

                    <button
                      onClick={() =>
                        void createAutomation()
                      }
                      disabled={
                        active ||
                        !input.trim()
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white text-black transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-20"
                      aria-label="Start automation"
                    >
                      ↑
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {suggestions.map(
                  suggestion => (
                    <button
                      key={
                        suggestion
                      }
                      onClick={() =>
                        setInput(
                          suggestion
                        )
                      }
                      disabled={active}
                      className="rounded-full border border-white/[0.055] bg-white/[0.018] px-3.5 py-2 text-[10px] text-white/30 transition hover:border-white/10 hover:bg-white/[0.04] hover:text-white/55 disabled:opacity-20"
                    >
                      {suggestion}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {status ===
            "planning" && (
            <div className="mt-8 flex items-center gap-3 rounded-full border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-xs text-white/35 backdrop-blur-xl">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white/70" />

              ZUQEN is building your
              execution plan...
            </div>
          )}

          {status ===
              "running" &&
            hasPlan && (
              <div className="mt-7 w-full max-w-3xl">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/25">
                  <span>
                    Live execution
                  </span>

                  <span>
                    {progress.percentage}%
                  </span>
                </div>

                <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-white/60 transition-all duration-500"
                    style={{
                      width: `${Math.max(
                        2,
                        Math.min(
                          100,
                          progress.percentage
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

          {error && (
            <div className="mt-7 w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 text-center">
              <p className="text-xs leading-5 text-white/50">
                {error}
              </p>

              <button
                onClick={
                  startOver
                }
                className="mt-3 rounded-full border border-white/10 px-4 py-2 text-[10px] text-white/60 hover:bg-white/[0.05] hover:text-white"
              >
                Try again
              </button>
            </div>
          )}

          {hasPlan &&
            task && (
              <div className="mt-8 w-full max-w-3xl pb-12">
                <div className="mb-6 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 backdrop-blur-xl sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-white/25">
                        Automation goal
                      </p>

                      <h2 className="mt-2 text-base font-medium text-white/80 sm:text-lg">
                        {task.title ||
                          "Automation task"}
                      </h2>

                      <p className="mt-2 text-xs leading-5 text-white/30">
                        {task.summary ||
                          task.prompt}
                      </p>
                    </div>

                    <div className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[9px] uppercase tracking-wider text-white/30">
                      {getStatusLabel(
                        status
                      )}
                    </div>
                  </div>
                </div>

                <StepTimeline
                  steps={
                    task.steps ?? []
                  }
                />

                {status ===
                    "running" &&
                  progress.total >
                    0 && (
                    <div className="mt-4 flex justify-center">
                      <div className="rounded-full border border-white/[0.07] bg-white/[0.025] px-4 py-2 text-[10px] text-white/30">
                        {progress.completed}{" "}
                        completed
                        {" · "}
                        {progress.running}{" "}
                        running
                        {progress.failed >
                          0
                          ? ` · ${progress.failed} failed`
                          : ""}
                      </div>
                    </div>
                  )}

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    onClick={
                      startOver
                    }
                    className="rounded-full border border-white/[0.07] px-5 py-3 text-xs text-white/35 transition hover:bg-white/[0.035] hover:text-white/70"
                  >
                    New automation
                  </button>

                  {status ===
                    "ready" && (
                    <button
                      onClick={() =>
                        void executeAutomation()
                      }
                      className="rounded-full bg-white px-6 py-3 text-xs font-medium text-black transition hover:scale-[1.01]"
                    >
                      Run automation →
                    </button>
                  )}

                  {status ===
                    "running" && (
                    <div className="rounded-full border border-white/[0.08] bg-white/[0.035] px-6 py-3 text-xs text-white/45">
                      ZUQEN is executing...
                    </div>
                  )}

                  {status ===
                    "completed" && (
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-xs text-white/60">
                      ✓ Completed
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>

        <footer className="relative z-20 flex items-center justify-center px-4 pb-5">
          <p className="text-center text-[9px] tracking-wide text-white/15">
            ZUQEN Automation can perform
            multi-step actions. Review
            sensitive actions before execution.
          </p>
        </footer>
      </section>
    </main>
  );
}