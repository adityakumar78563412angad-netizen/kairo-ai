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

type AutomationTask = {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  status: AutomationStatus;
  priority?: string | null;
  plan?: unknown;
  context?: unknown;
  result?: unknown;
  errors?: unknown;
  created_at: string;
  updated_at: string;
};

type AutomationRun = {
  id: string;
  task_id?: string;
  user_id?: string;
  run_number: number;
  status: AutomationStatus;
  trigger_type?: string;
  execution_context?: unknown;
  result?: unknown;
  errors?: unknown;
  created_at: string;
  updated_at: string;
};

type AutomationStep = {
  id: string;
  task_id?: string;
  run_id: string;
  step_number: number;
  name: string;
  description?: string | null;
  tool_name?: string | null;
  status: StepStatus;
  input?: unknown;
  output?: unknown;
  dependencies?: string[] | null;
  retries?: number | null;
  errors?: unknown;
  started_at?: string | null;
  completed_at?: string | null;
};

type PlanStep = {
  step_number?: number;
  name?: string;
  description?: string;
  tool_name?: string;
  dependencies?: number[];
};

type SessionResult = {
  accessToken: string;
  userId: string;
};

type JsonObject = Record<string, unknown>;

const supabase = createClient();

const TOOL_META: Record<
  string,
  {
    label: string;
    icon: string;
    description: string;
  }
> = {
  web_search: {
    label: "Web Search",
    icon: "⌕",
    description: "Search the live web for relevant information.",
  },
  web_research: {
    label: "Web Research",
    icon: "◈",
    description: "Run multi-query research and synthesize findings.",
  },
  browser: {
    label: "Browser",
    icon: "◎",
    description: "Navigate and interact with web pages.",
  },
  email: {
    label: "Email",
    icon: "✉",
    description: "Read, draft and send email when connected.",
  },
  calendar: {
    label: "Calendar",
    icon: "□",
    description: "Create and manage calendar actions.",
  },
  file_read: {
    label: "File Read",
    icon: "▤",
    description: "Read information from connected files.",
  },
  file_write: {
    label: "File Write",
    icon: "▥",
    description: "Create or update connected files.",
  },
  document: {
    label: "Document",
    icon: "▧",
    description: "Generate and transform documents.",
  },
  spreadsheet: {
    label: "Spreadsheet",
    icon: "▦",
    description: "Work with structured spreadsheet data.",
  },
  data_transform: {
    label: "Data Transform",
    icon: "↗",
    description: "Clean, transform and analyze structured data.",
  },
  crm: {
    label: "CRM",
    icon: "♙",
    description: "Perform actions against connected CRM systems.",
  },
  http_request: {
    label: "HTTP Request",
    icon: "↔",
    description: "Call authorized external APIs.",
  },
  notification: {
    label: "Notification",
    icon: "♢",
    description: "Send supported notifications.",
  },
};

const TOOL_NAMES = Object.keys(TOOL_META);

const EXAMPLES = [
  "Research the latest developments in AI agents and prepare a concise report with sources.",
  "Search the web for the information I need and organize the findings into a structured summary.",
  "Analyze the information available for a topic and turn it into a professional report.",
  "Find relevant information online, compare the sources, and explain the important differences.",
];

function formatDate(value?: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatTime(value?: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function safeJson(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value;

  try {
    const serialized = JSON.stringify(value, null, 2);

    if (typeof serialized === "string") {
      return serialized;
    }

    return String(value);
  } catch {
    return String(value);
  }
}

function getToolMeta(toolName?: string | null) {
  if (!toolName) {
    return {
      label: "Automation",
      icon: "✦",
      description: "Automation step",
    };
  }

  return (
    TOOL_META[toolName] || {
      label: toolName.replaceAll("_", " "),
      icon: "✦",
      description: "Automation tool",
    }
  );
}

function statusLabel(status: AutomationStatus | StepStatus) {
  return status.replaceAll("_", " ");
}

function statusClass(status: AutomationStatus | StepStatus) {
  switch (status) {
    case "completed":
      return "text-emerald-300 bg-emerald-400/10 border-emerald-400/20";

    case "running":
      return "text-sky-300 bg-sky-400/10 border-sky-400/20";

    case "planning":
    case "planned":
      return "text-violet-300 bg-violet-400/10 border-violet-400/20";

    case "waiting_approval":
      return "text-amber-300 bg-amber-400/10 border-amber-400/20";

    case "failed":
      return "text-red-300 bg-red-400/10 border-red-400/20";

    case "cancelled":
      return "text-zinc-300 bg-white/5 border-white/10";

    default:
      return "text-zinc-300 bg-white/5 border-white/10";
  }
}

function statusIcon(status: AutomationStatus | StepStatus) {
  switch (status) {
    case "completed":
      return "✓";

    case "running":
      return "◌";

    case "planning":
    case "planned":
      return "✦";

    case "waiting_approval":
      return "!";

    case "failed":
      return "×";

    case "cancelled":
      return "—";

    default:
      return "○";
  }
}

function extractPlanSteps(plan: unknown): PlanStep[] {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    return [];
  }

  const source = plan as JsonObject;

  const candidates = [
    source.steps,
    source.plan,
    source.actions,
    source.execution_plan,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    return candidate.map((item): PlanStep => {
      if (!item || typeof item !== "object") {
        return {};
      }

      const value = item as JsonObject;

      return {
        step_number:
          typeof value.step_number === "number"
            ? value.step_number
            : undefined,

        name:
          typeof value.name === "string"
            ? value.name
            : undefined,

        description:
          typeof value.description === "string"
            ? value.description
            : undefined,

        tool_name:
          typeof value.tool_name === "string"
            ? value.tool_name
            : undefined,

        dependencies: Array.isArray(value.dependencies)
          ? value.dependencies.filter(
              (dependency): dependency is number =>
                typeof dependency === "number"
            )
          : undefined,
      };
    });
  }

  return [];
}

function extractResultObject(result: unknown): JsonObject {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {};
  }

  return result as JsonObject;
}

function isTerminalTaskStatus(status: AutomationStatus) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "waiting_approval"
  );
}

/* -------------------------------------------------------------------------- */
/* UNIVERSE + STAR-TO-Z LOADING ANIMATION                                     */
/* -------------------------------------------------------------------------- */

function UniverseBackground({
  formingZ,
}: {
  formingZ: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const pointerRef = useRef({
    x: -1000,
    y: -1000,
    active: false,
  });

  const formingZRef = useRef(formingZ);

  useEffect(() => {
    formingZRef.current = formingZ;
  }, [formingZ]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext("2d");

    if (!context) return;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let devicePixelRatio = 1;

    let previousFormingZ = formingZ;
    let transitionStartedAt = performance.now();
    let transitionDirection: "forming" | "dispersing" | "none" =
      formingZ ? "forming" : "none";

    type Point = {
      x: number;
      y: number;
    };

    type Star = {
      x: number;
      y: number;
      homeX: number;
      homeY: number;
      z: number;
      size: number;
      speed: number;
      phase: number;
      drift: number;
      targetX: number;
      targetY: number;
      targetOffsetX: number;
      targetOffsetY: number;
    };

    const stars: Star[] = [];

    const starCount = 420;

    const getEaseOut = (value: number) => {
      const clamped = Math.max(0, Math.min(1, value));
      return 1 - Math.pow(1 - clamped, 3);
    };

    const getEaseInOut = (value: number) => {
      const clamped = Math.max(0, Math.min(1, value));
      return clamped < 0.5
        ? 4 * clamped * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
    };

    const buildZTargets = (): Point[] => {
      /*
       * The Z is constructed geometrically instead of using a font/image.
       * This guarantees that the loading logo is a large, unmistakable Z.
       */

      const left = width * 0.28;
      const right = width * 0.72;
      const top = height * 0.29;
      const bottom = height * 0.71;

      const points: Point[] = [];

      const addSegment = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        density: number
      ) => {
        const distance = Math.sqrt(
          Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)
        );

        const count = Math.max(
          2,
          Math.floor(distance / density)
        );

        for (let index = 0; index <= count; index += 1) {
          const progress = index / count;

          points.push({
            x: x1 + (x2 - x1) * progress,
            y: y1 + (y2 - y1) * progress,
          });
        }
      };

      addSegment(left, top, right, top, 8);
      addSegment(right, top, left, bottom, 8);
      addSegment(left, bottom, right, bottom, 8);

      /*
       * Add thickness around the geometric Z so the formation feels like
       * hundreds of stars converging into a luminous constellation.
       */
      const base = [...points];

      for (const point of base) {
        for (const offset of [
          [-4, -2],
          [4, 2],
          [-2, 4],
          [2, -4],
        ]) {
          points.push({
            x: point.x + offset[0],
            y: point.y + offset[1],
          });
        }
      }

      return points;
    };

    const assignZTargets = () => {
      const targets = buildZTargets();

      if (targets.length === 0) return;

      stars.forEach((star, index) => {
        const target = targets[index % targets.length];

        star.targetX = target.x;
        star.targetY = target.y;

        /*
         * Small deterministic-ish offsets keep the Z organic rather than
         * looking like perfectly identical dots.
         */
        const angle =
          star.phase +
          index * 0.37;

        const radius =
          2 +
          ((index * 17) % 11);

        star.targetOffsetX =
          Math.cos(angle) * radius;

        star.targetOffsetY =
          Math.sin(angle) * radius;
      });
    };

    const createStars = () => {
      stars.length = 0;

      for (let index = 0; index < starCount; index += 1) {
        const x = Math.random() * width;
        const y = Math.random() * height;

        stars.push({
          x,
          y,
          homeX: x,
          homeY: y,
          z: 0.2 + Math.random() * 0.8,
          size: 0.35 + Math.random() * 1.45,
          speed: 0.05 + Math.random() * 0.25,
          phase: Math.random() * Math.PI * 2,
          drift: 0.4 + Math.random() * 1.2,
          targetX: x,
          targetY: y,
          targetOffsetX: 0,
          targetOffsetY: 0,
        });
      }

      assignZTargets();
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();

      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      devicePixelRatio = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      canvas.width = Math.floor(
        width * devicePixelRatio
      );

      canvas.height = Math.floor(
        height * devicePixelRatio
      );

      context.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
      );

      createStars();
    };

    const handlePointerMove = (
      event: PointerEvent
    ) => {
      pointerRef.current.x = event.clientX;
      pointerRef.current.y = event.clientY;
      pointerRef.current.active = true;
    };

    const handlePointerLeave = () => {
      pointerRef.current.active = false;
    };

    const drawStar = (
      x: number,
      y: number,
      radius: number,
      alpha: number,
      glow: boolean
    ) => {
      if (glow) {
        context.beginPath();
        context.arc(
          x,
          y,
          radius * 3.2,
          0,
          Math.PI * 2
        );

        context.fillStyle = `rgba(255,255,255,${alpha * 0.08})`;
        context.fill();
      }

      context.beginPath();

      context.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
      );

      context.fillStyle = `rgba(255,255,255,${alpha})`;
      context.fill();
    };

    const draw = (time: number) => {
      context.clearRect(
        0,
        0,
        width,
        height
      );

      const currentlyForming =
        formingZRef.current;

      /*
       * Detect loading state transitions without recreating the canvas.
       */
      if (
        currentlyForming !==
        previousFormingZ
      ) {
        previousFormingZ =
          currentlyForming;

        transitionStartedAt =
          time;

        transitionDirection =
          currentlyForming
            ? "forming"
            : "dispersing";

        if (currentlyForming) {
          assignZTargets();
        }
      }

      let formationProgress = 0;

      if (
        transitionDirection ===
        "forming"
      ) {
        formationProgress =
          getEaseInOut(
            (time -
              transitionStartedAt) /
              1550
          );

        if (
          formationProgress >= 1
        ) {
          formationProgress = 1;
        }
      } else if (
        transitionDirection ===
        "dispersing"
      ) {
        const dispersalProgress =
          getEaseInOut(
            (time -
              transitionStartedAt) /
              1050
          );

        formationProgress =
          1 -
          Math.min(
            1,
            dispersalProgress
          );

        if (
          dispersalProgress >=
          1
        ) {
          formationProgress = 0;
          transitionDirection =
            "none";
        }
      } else {
        formationProgress =
          currentlyForming
            ? 1
            : 0;
      }

      const pointer =
        pointerRef.current;

      const scrollY =
        window.scrollY || 0;

      for (
        let index = 0;
        index < stars.length;
        index += 1
      ) {
        const star = stars[index];

        const twinkle =
          0.55 +
          Math.sin(
            time *
              0.0015 *
              star.speed +
              star.phase
          ) *
            0.25;

        let universeX =
          star.homeX;

        let universeY =
          star.homeY -
          scrollY *
            0.035 *
            star.z;

        if (
          universeY <
          -10
        ) {
          universeY +=
            height + 20;
        }

        if (
          universeY >
          height + 10
        ) {
          universeY -=
            height + 20;
        }

        universeX +=
          Math.sin(
            time *
              0.00015 *
              star.drift +
              star.phase
          ) *
          0.8;

        universeY +=
          Math.cos(
            time *
              0.00012 *
              star.drift +
              star.phase
          ) *
          0.6;

        /*
         * Pointer parallax is only active in normal universe mode.
         * During Z formation the constellation remains stable.
         */
        if (
          formationProgress <
          0.08 &&
          pointer.active
        ) {
          const dx =
            pointer.x -
            universeX;

          const dy =
            pointer.y -
            universeY;

          const distance =
            Math.sqrt(
              dx * dx +
                dy * dy
            );

          if (
            distance < 220
          ) {
            const influence =
              (1 -
                distance /
                  220) *
              star.z;

            universeX +=
              dx *
              influence *
              0.045;

            universeY +=
              dy *
              influence *
              0.045;
          }
        }

        const zX =
          star.targetX +
          star.targetOffsetX;

        const zY =
          star.targetY +
          star.targetOffsetY;

        /*
         * The exact same stars move from their universe coordinates to
         * the Z coordinates. No second loader canvas exists.
         */
        const drawX =
          universeX +
          (zX - universeX) *
            formationProgress;

        const drawY =
          universeY +
          (zY - universeY) *
            formationProgress;

        const pulse =
          0.55 +
          Math.sin(
            time * 0.004 +
              star.phase
          ) *
            0.35;

        const alpha =
          Math.max(
            0.12,
            Math.min(
              0.98,
              twinkle *
                star.z +
                formationProgress *
                  0.25
            )
          );

        const radius =
          star.size *
          star.z *
          (1 +
            formationProgress *
              0.45);

        drawStar(
          drawX,
          drawY,
          radius *
            (0.72 +
              pulse *
                0.32),
          alpha,
          formationProgress >
            0.45
        );
      }

      /*
       * A subtle central glow is rendered by the same canvas only while
       * the stars are forming the Z. There is no DOM overlay or loader box.
       */
      if (
        formationProgress >
        0.2
      ) {
        const glowProgress =
          Math.min(
            1,
            formationProgress *
              1.35
          );

        const gradient =
          context.createRadialGradient(
            width / 2,
            height / 2,
            0,
            width / 2,
            height / 2,
            Math.min(
              width,
              height
            ) *
              0.42
          );

        gradient.addColorStop(
          0,
          `rgba(255,255,255,${
            0.035 *
            glowProgress
          })`
        );

        gradient.addColorStop(
          0.45,
          `rgba(150,120,255,${
            0.018 *
            glowProgress
          })`
        );

        gradient.addColorStop(
          1,
          "rgba(0,0,0,0)"
        );

        context.fillStyle =
          gradient;

        context.fillRect(
          0,
          0,
          width,
          height
        );
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

    window.addEventListener(
      "pointermove",
      handlePointerMove,
      {
        passive: true,
      }
    );

    window.addEventListener(
      "pointerleave",
      handlePointerLeave
    );

    animationFrame =
      requestAnimationFrame(
        draw
      );

    return () => {
      cancelAnimationFrame(
        animationFrame
      );

      window.removeEventListener(
        "resize",
        resize
      );

      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      window.removeEventListener(
        "pointerleave",
        handlePointerLeave
      );
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-90"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                        */
/* -------------------------------------------------------------------------- */

export default function AutomationPage() {
  const [input, setInput] =
    useState("");

  const [task, setTask] =
    useState<AutomationTask | null>(
      null
    );

  const [run, setRun] =
    useState<AutomationRun | null>(
      null
    );

  const [steps, setSteps] =
    useState<AutomationStep[]>(
      []
    );

  const [loading, setLoading] =
    useState(false);

  const [polling, setPolling] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [showExamples, setShowExamples] =
    useState(false);

  const [showTools, setShowTools] =
    useState(false);

  const [sidebarOpen, setSidebarOpen] =
    useState(true);

  const [detailsOpen, setDetailsOpen] =
    useState(true);

  const [history, setHistory] =
    useState<AutomationTask[]>(
      []
    );

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [selectedTool, setSelectedTool] =
    useState<string | null>(null);

  const [deletingTaskId, setDeletingTaskId] =
    useState<string | null>(null);

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(
      null
    );

  const pollTimerRef =
    useRef<ReturnType<
      typeof setInterval
    > | null>(null);

  /*
   * This is the ONLY visual loading state used by the universe animation.
   * Background polling/history synchronization deliberately does not hide
   * the UI because those operations are non-blocking background work.
   */
  const starLoading =
    loading ||
    deletingTaskId !== null;

  const getAutomationSession =
    useCallback(
      async (): Promise<SessionResult> => {
        const {
          data: { session },
          error,
        } =
          await supabase.auth.getSession();

        if (error) {
          throw new Error(
            error.message
          );
        }

        if (
          !session?.access_token ||
          !session.user?.id
        ) {
          throw new Error(
            "Your ZUQEN session is not available. Please refresh the page and try again."
          );
        }

        return {
          accessToken:
            session.access_token,
          userId:
            session.user.id,
        };
      },
      []
    );

  const automationHeaders =
    useCallback(
      (
        accessToken: string
      ) => {
        return {
          "Content-Type":
            "application/json",
          Authorization: `Bearer ${accessToken}`,
        };
      },
      []
    );

  const loadHistory =
    useCallback(async () => {
      try {
        setHistoryLoading(
          true
        );

        const {
          data: { user },
        } =
          await supabase.auth.getUser();

        if (!user) {
          setHistory([]);
          return;
        }

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "automation_tasks"
            )
            .select(
              "id,user_id,title,prompt,status,priority,plan,context,result,errors,created_at,updated_at"
            )
            .eq(
              "user_id",
              user.id
            )
            .order(
              "updated_at",
              {
                ascending:
                  false,
              }
            )
            .limit(30);

        if (error) {
          console.error(
            "Automation history error:",
            error
          );

          setErrorMessage(
            `Unable to load automation history: ${error.message}`
          );

          return;
        }

        setHistory(
          (data ||
            []) as AutomationTask[]
        );
      } finally {
        setHistoryLoading(
          false
        );
      }
    }, []);

  const loadAutomationState =
    useCallback(
      async (
        taskId: string,
        runId: string
      ) => {
        const {
          data: { user },
        } =
          await supabase.auth.getUser();

        if (!user) {
          throw new Error(
            "Authentication required."
          );
        }

        const [
          taskResponse,
          runResponse,
          stepsResponse,
        ] =
          await Promise.all([
            supabase
              .from(
                "automation_tasks"
              )
              .select("*")
              .eq(
                "id",
                taskId
              )
              .eq(
                "user_id",
                user.id
              )
              .single(),

            supabase
              .from(
                "automation_runs"
              )
              .select("*")
              .eq(
                "id",
                runId
              )
              .eq(
                "task_id",
                taskId
              )
              .eq(
                "user_id",
                user.id
              )
              .single(),

            supabase
              .from(
                "automation_steps"
              )
              .select("*")
              .eq(
                "run_id",
                runId
              )
              .eq(
                "task_id",
                taskId
              )
              .order(
                "step_number",
                {
                  ascending:
                    true,
                }
              ),
          ]);

        if (taskResponse.error) {
          throw new Error(
            taskResponse.error.message
          );
        }

        if (runResponse.error) {
          throw new Error(
            runResponse.error.message
          );
        }

        if (
          stepsResponse.error
        ) {
          throw new Error(
            stepsResponse.error.message
          );
        }

        const nextTask =
          taskResponse.data as AutomationTask;

        const nextRun =
          runResponse.data as AutomationRun;

        const nextSteps =
          (stepsResponse.data ||
            []) as AutomationStep[];

        setTask(
          nextTask
        );

        setRun(
          nextRun
        );

        setSteps(
          nextSteps
        );

        return {
          task: nextTask,
          run: nextRun,
          steps: nextSteps,
        };
      },
      []
    );

  const stopPolling =
    useCallback(() => {
      if (
        pollTimerRef.current
      ) {
        clearInterval(
          pollTimerRef.current
        );

        pollTimerRef.current =
          null;
      }

      setPolling(false);
    }, []);

  const startPolling =
    useCallback(
      (
        taskId: string,
        runId: string
      ) => {
        stopPolling();

        setPolling(
          true
        );

        const startedAt =
          Date.now();

        const poll =
          async () => {
            try {
              const state =
                await loadAutomationState(
                  taskId,
                  runId
                );

              if (
                isTerminalTaskStatus(
                  state.task.status
                )
              ) {
                stopPolling();

                await loadHistory();

                return;
              }

              if (
                Date.now() -
                  startedAt >
                5 * 60 * 1000
              ) {
                stopPolling();

                setErrorMessage(
                  "Automation is taking longer than expected. You can continue monitoring this task from history."
                );
              }
            } catch (error) {
              console.error(
                "Automation polling error:",
                error
              );
            }
          };

        void poll();

        pollTimerRef.current =
          setInterval(
            () => {
              void poll();
            },
            1500
          );
      },
      [
        loadAutomationState,
        loadHistory,
        stopPolling,
      ]
    );

  useEffect(() => {
    void loadHistory();

    return () => {
      stopPolling();
    };
  }, [
    loadHistory,
    stopPolling,
  ]);

  useEffect(() => {
    if (
      !textareaRef.current
    ) {
      return;
    }

    textareaRef.current.style.height =
      "auto";

    textareaRef.current.style.height = `${Math.min(
      textareaRef.current
        .scrollHeight,
      220
    )}px`;
  }, [input]);

  /*
   * When the UI disappears into the universe, remove keyboard focus from
   * the textarea so invisible controls cannot continue receiving input.
   */
  useEffect(() => {
    if (starLoading) {
      textareaRef.current?.blur();
    }
  }, [starLoading]);

  const runAutomation =
    useCallback(async () => {
      const prompt =
        input.trim();

      if (!prompt) {
        setErrorMessage(
          "Tell ZUQEN what you want to automate."
        );

        textareaRef.current?.focus();

        return;
      }

      if (
        prompt.length >
        10000
      ) {
        setErrorMessage(
          "Automation prompt cannot exceed 10,000 characters."
        );

        return;
      }

      try {
        setLoading(
          true
        );

        setErrorMessage(
          ""
        );

        stopPolling();

        const {
          accessToken,
        } =
          await getAutomationSession();

        const response =
          await fetch(
            "/api/automation",
            {
              method:
                "POST",
              headers:
                automationHeaders(
                  accessToken
                ),
              body: JSON.stringify(
                {
                  prompt,
                  title:
                    prompt.length >
                    80
                      ? `${prompt.slice(
                          0,
                          80
                        )}…`
                      : prompt,
                }
              ),
            }
          );

        const data: unknown =
          await response
            .json()
            .catch(
              () => null
            );

        if (
          !response.ok
        ) {
          const responseData =
            data &&
            typeof data ===
              "object"
              ? (data as JsonObject)
              : {};

          const message =
            typeof responseData.error ===
            "string"
              ? responseData.error
              : typeof responseData.message ===
                  "string"
                ? responseData.message
                : `Unable to create the automation task. HTTP ${response.status}`;

          throw new Error(
            message
          );
        }

        const responseData =
          data &&
          typeof data ===
            "object"
            ? (data as JsonObject)
            : {};

        const taskId =
          typeof responseData.taskId ===
          "string"
            ? responseData.taskId
            : "";

        const runId =
          typeof responseData.runId ===
          "string"
            ? responseData.runId
            : "";

        if (
          !taskId ||
          !runId
        ) {
          throw new Error(
            "Automation API did not return taskId/runId."
          );
        }

        setInput("");

        await loadAutomationState(
          taskId,
          runId
        );

        const executeResponse =
          await fetch(
            "/api/automation/execute",
            {
              method:
                "POST",
              headers:
                automationHeaders(
                  accessToken
                ),
              body: JSON.stringify(
                {
                  taskId,
                  runId,
                }
              ),
            }
          );

        const executeData: unknown =
          await executeResponse
            .json()
            .catch(
              () => null
            );

        if (
          !executeResponse.ok
        ) {
          /*
           * Refresh the task before throwing so a backend failure becomes
           * visible in the normal task UI after the star animation ends.
           */
          try {
            await loadAutomationState(
              taskId,
              runId
            );
          } catch {
            // Preserve the actual execution error below.
          }

          try {
            await loadHistory();
          } catch {
            // Preserve the actual execution error below.
          }

          const executeObject =
            executeData &&
            typeof executeData ===
              "object"
              ? (executeData as JsonObject)
              : {};

          const backendError =
            typeof executeObject.error ===
            "string"
              ? executeObject.error
              : typeof executeObject.message ===
                  "string"
                ? executeObject.message
                : `Automation execution failed with HTTP ${executeResponse.status}.`;

          const errorCode =
            typeof executeObject.errorCode ===
            "string"
              ? executeObject.errorCode
              : "";

          throw new Error(
            errorCode
              ? `${backendError} [${errorCode}]`
              : backendError
          );
        }

        await loadAutomationState(
          taskId,
          runId
        );

        startPolling(
          taskId,
          runId
        );

        await loadHistory();
      } catch (error) {
        console.error(
          "Automation error:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Something went wrong while starting automation."
        );
      } finally {
        setLoading(
          false
        );
      }
    }, [
      input,
      stopPolling,
      getAutomationSession,
      automationHeaders,
      loadAutomationState,
      startPolling,
      loadHistory,
    ]);

  const deleteAutomationTask =
    useCallback(
      async (
        historyTask: AutomationTask
      ) => {
        const confirmed =
          window.confirm(
            `Delete "${historyTask.title || "Untitled automation"}"?\n\nThis will permanently remove the task, its runs and its execution steps.`
          );

        if (!confirmed) {
          return;
        }

        try {
          setDeletingTaskId(
            historyTask.id
          );

          setErrorMessage(
            ""
          );

          const {
            data: { user },
            error: authError,
          } =
            await supabase.auth.getUser();

          if (authError) {
            throw new Error(
              authError.message
            );
          }

          if (!user) {
            throw new Error(
              "Authentication required."
            );
          }

          if (
            historyTask.user_id !==
            user.id
          ) {
            throw new Error(
              "You are not allowed to delete this automation."
            );
          }

          /*
           * Children first so this also works when foreign keys are not
           * configured with ON DELETE CASCADE.
           */

          const {
            error:
              stepsDeleteError,
          } =
            await supabase
              .from(
                "automation_steps"
              )
              .delete()
              .eq(
                "task_id",
                historyTask.id
              );

          if (
            stepsDeleteError
          ) {
            throw new Error(
              `Unable to delete automation steps: ${stepsDeleteError.message}`
            );
          }

          const {
            error:
              runsDeleteError,
          } =
            await supabase
              .from(
                "automation_runs"
              )
              .delete()
              .eq(
                "task_id",
                historyTask.id
              )
              .eq(
                "user_id",
                user.id
              );

          if (
            runsDeleteError
          ) {
            throw new Error(
              `Unable to delete automation runs: ${runsDeleteError.message}`
            );
          }

          const {
            error:
              taskDeleteError,
          } =
            await supabase
              .from(
                "automation_tasks"
              )
              .delete()
              .eq(
                "id",
                historyTask.id
              )
              .eq(
                "user_id",
                user.id
              );

          if (
            taskDeleteError
          ) {
            throw new Error(
              `Unable to delete automation task: ${taskDeleteError.message}`
            );
          }

          setHistory(
            (current) =>
              current.filter(
                (item) =>
                  item.id !==
                  historyTask.id
              )
          );

          if (
            task?.id ===
            historyTask.id
          ) {
            stopPolling();

            setTask(
              null
            );

            setRun(
              null
            );

            setSteps(
              []
            );

            setSelectedTool(
              null
            );

            setInput(
              ""
            );
          }
        } catch (error) {
          console.error(
            "Automation delete error:",
            error
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to delete automation task."
          );
        } finally {
          setDeletingTaskId(
            null
          );
        }
      },
      [
        stopPolling,
        task?.id,
      ]
    );

  const openHistoryTask =
    useCallback(
      async (
        historyTask: AutomationTask
      ) => {
        try {
          setErrorMessage(
            ""
          );

          const {
            data: { user },
          } =
            await supabase.auth.getUser();

          if (!user) {
            setErrorMessage(
              "Authentication required."
            );

            return;
          }

          const {
            data: runs,
            error,
          } =
            await supabase
              .from(
                "automation_runs"
              )
              .select("*")
              .eq(
                "task_id",
                historyTask.id
              )
              .eq(
                "user_id",
                user.id
              )
              .order(
                "run_number",
                {
                  ascending:
                    false,
                }
              )
              .limit(1);

          if (error) {
            throw new Error(
              error.message
            );
          }

          const latestRun =
            (runs?.[0] as
              | AutomationRun
              | undefined) ??
            undefined;

          if (!latestRun) {
            setTask(
              historyTask
            );

            setRun(
              null
            );

            setSteps(
              []
            );

            return;
          }

          await loadAutomationState(
            historyTask.id,
            latestRun.id
          );

          if (
            !isTerminalTaskStatus(
              historyTask.status
            )
          ) {
            startPolling(
              historyTask.id,
              latestRun.id
            );
          }
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to open automation task."
          );
        }
      },
      [
        loadAutomationState,
        startPolling,
      ]
    );

  const handleKeyDown =
    useCallback(
      (
        event: React.KeyboardEvent<HTMLTextAreaElement>
      ) => {
        if (
          event.key ===
            "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();

          if (!loading) {
            void runAutomation();
          }
        }
      },
      [
        loading,
        runAutomation,
      ]
    );

  const newAutomation =
    useCallback(() => {
      stopPolling();

      setTask(
        null
      );

      setRun(
        null
      );

      setSteps(
        []
      );

      setInput(
        ""
      );

      setErrorMessage(
        ""
      );

      setSelectedTool(
        null
      );

      setShowExamples(
        false
      );

      setShowTools(
        false
      );

      window.setTimeout(
        () => {
          textareaRef.current?.focus();
        },
        50
      );
    }, [stopPolling]);

  const planSteps =
    useMemo(() => {
      return extractPlanSteps(
        task?.plan
      );
    }, [task?.plan]);

  const displaySteps =
    useMemo<AutomationStep[]>(
      () => {
        if (
          steps.length >
          0
        ) {
          return steps;
        }

        return planSteps.map(
          (
            step,
            index
          ) => ({
            id: `plan-${index}`,
            run_id:
              run?.id ||
              "",
            step_number:
              step.step_number ||
              index + 1,
            name:
              step.name ||
              `Automation step ${
                index + 1
              }`,
            description:
              step.description ||
              "",
            tool_name:
              step.tool_name ||
              null,
            status:
              "queued" as StepStatus,
            dependencies: [],
            retries: 0,
          })
        );
      },
      [
        steps,
        planSteps,
        run?.id,
      ]
    );

  const resultObject =
    useMemo(
      () =>
        extractResultObject(
          task?.result ||
            run?.result
        ),
      [
        task?.result,
        run?.result,
      ]
    );

  const researchAnswer =
    typeof resultObject.answer ===
    "string"
      ? resultObject.answer
      : typeof resultObject.summary ===
          "string"
        ? resultObject.summary
        : typeof resultObject.result ===
            "string"
          ? resultObject.result
          : "";

  const researchSources =
    Array.isArray(
      resultObject.sources
    )
      ? resultObject.sources
      : [];

  const completedSteps =
    displaySteps.filter(
      (step) =>
        step.status ===
        "completed"
    ).length;

  const runningStep =
    displaySteps.find(
      (step) =>
        step.status ===
          "running" ||
        step.status ===
          "waiting_approval"
    );

  const activeTools =
    useMemo(() => {
      const names =
        new Set<string>();

      for (const step of displaySteps) {
        if (
          step.tool_name
        ) {
          names.add(
            step.tool_name
          );
        }
      }

      return Array.from(
        names
      );
    }, [displaySteps]);

  const pageHasTask =
    task !== null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020305] text-white">
      {/* ------------------------------------------------------------------ */}
      {/* BACKGROUND                                                         */}
      {/* ------------------------------------------------------------------ */}

      <UniverseBackground
        formingZ={starLoading}
      />

      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_50%_18%,rgba(100,80,180,0.10),transparent_32%),radial-gradient(circle_at_12%_80%,rgba(40,100,180,0.07),transparent_30%),radial-gradient(circle_at_90%_65%,rgba(140,70,190,0.06),transparent_28%)]" />

      {/* ------------------------------------------------------------------ */}
      {/* NORMAL UI                                                           */}
      {/* ------------------------------------------------------------------ */}

      <div
        className={`relative z-10 flex min-h-screen transition-opacity duration-300 ${
          starLoading
            ? "pointer-events-none select-none opacity-0"
            : "opacity-100"
        }`}
        aria-hidden={
          starLoading
        }
      >
        {/* LEFT SIDEBAR */}
        <aside
          className={`${
            sidebarOpen
              ? "w-[285px]"
              : "w-0"
          } hidden overflow-hidden border-r border-white/[0.07] bg-[#05070a]/75 backdrop-blur-xl transition-all duration-300 lg:block`}
        >
          <div className="flex h-full min-w-[285px] flex-col">
            <div className="flex h-[72px] items-center justify-between border-b border-white/[0.07] px-5">
              <button
                onClick={() => {
                  window.location.href =
                    "/";
                }}
                className="text-lg font-semibold tracking-tight"
              >
                ZUQEN
                <span className="ml-1 text-white/30">
                  AI
                </span>
              </button>

              <button
                onClick={
                  newAutomation
                }
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                + New
              </button>
            </div>

            <div className="p-4">
              <button
                onClick={
                  newAutomation
                }
                className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-left transition hover:border-white/[0.13] hover:bg-white/[0.07]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black">
                  +
                </span>

                <span>
                  <span className="block text-sm font-medium">
                    New Automation
                  </span>

                  <span className="block text-[11px] text-white/35">
                    Start a new task
                  </span>
                </span>
              </button>
            </div>

            <div className="px-4 pb-2">
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                  Recent
                </span>

                {historyLoading && (
                  <span className="text-[10px] text-white/25">
                    Syncing
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {history.length ===
              0 ? (
                <div className="px-3 py-8 text-center text-xs text-white/25">
                  No automation history yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {history.map(
                    (item) => (
                      <div
                        key={
                          item.id
                        }
                        className={`group relative rounded-xl transition ${
                          task?.id ===
                          item.id
                            ? "bg-white/[0.08]"
                            : "hover:bg-white/[0.045]"
                        }`}
                      >
                        <button
                          onClick={() =>
                            void openHistoryTask(
                              item
                            )
                          }
                          disabled={
                            deletingTaskId ===
                            item.id
                          }
                          className="w-full rounded-xl px-3 py-3 pr-10 text-left transition disabled:opacity-40"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${statusClass(
                                item.status
                              )}`}
                            >
                              {statusIcon(
                                item.status
                              )}
                            </span>

                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium text-white/80">
                                {item.title ||
                                  "Untitled automation"}
                              </span>

                              <span className="mt-1 block text-[10px] capitalize text-white/25">
                                {statusLabel(
                                  item.status
                                )}{" "}
                                ·{" "}
                                {formatDate(
                                  item.updated_at
                                )}
                              </span>
                            </span>
                          </div>
                        </button>

                        <button
                          onClick={() =>
                            void deleteAutomationTask(
                              item
                            )
                          }
                          disabled={
                            deletingTaskId !==
                            null
                          }
                          aria-label={`Delete ${item.title || "automation"}`}
                          title="Delete automation"
                          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-white/20 opacity-0 transition hover:bg-red-400/10 hover:text-red-300 group-hover:opacity-100 disabled:pointer-events-none"
                        >
                          {deletingTaskId ===
                          item.id ? (
                            <span className="text-[11px]">
                              ×
                            </span>
                          ) : (
                            "×"
                          )}
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.07] p-4">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <div className="text-xs font-medium text-white/65">
                  Automation Engine
                </div>

                <div className="mt-1 text-[10px] leading-4 text-white/25">
                  Plan → Execute → Verify
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <section className="flex min-w-0 flex-1 flex-col">
          {/* HEADER */}
          <header className="flex h-[72px] items-center justify-between border-b border-white/[0.07] bg-[#030507]/55 px-4 backdrop-blur-xl md:px-7">
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setSidebarOpen(
                    (value) =>
                      !value
                  )
                }
                className="rounded-lg p-2 text-white/45 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
                aria-label="Toggle sidebar"
              >
                ☰
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-semibold">
                    Automation
                  </h1>

                  <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-violet-300">
                    Beta
                  </span>
                </div>

                <p className="mt-0.5 text-[10px] text-white/25">
                  Turn instructions into
                  multi-step execution
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {pageHasTask && (
                <button
                  onClick={
                    newAutomation
                  }
                  className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.08] hover:text-white sm:block"
                >
                  New Task
                </button>
              )}

              <button
                onClick={() =>
                  setDetailsOpen(
                    (value) =>
                      !value
                  )
                }
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/50 transition hover:bg-white/[0.07] hover:text-white"
              >
                {detailsOpen
                  ? "Hide details"
                  : "Details"}
              </button>
            </div>
          </header>

          {/* CONTENT */}
          <div className="flex flex-1 overflow-hidden">
            <div className="min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[980px] px-4 py-8 md:px-8 md:py-12">
                {!task ? (
                  <>
                    {/* EMPTY STATE */}
                    <div className="flex min-h-[calc(100vh-190px)] flex-col justify-center">
                      <div className="mx-auto w-full max-w-[760px]">
                        <div className="mb-8 text-center">
                          <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/40">
                            <span className="absolute inset-0 rounded-2xl bg-white/[0.03] blur-xl" />

                            <span className="relative text-2xl text-white">
                              ✦
                            </span>
                          </div>

                          <div className="mb-3 text-[9px] uppercase tracking-[0.35em] text-white/20">
                            ZUQEN AUTOMATION
                          </div>

                          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                            What can I automate
                            for you?
                          </h2>

                          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/35">
                            Describe the outcome
                            you want. ZUQEN can
                            plan the required
                            steps, select tools
                            and execute the
                            workflow.
                          </p>
                        </div>

                        {/* COMPOSER */}
                        <div className="rounded-[24px] border border-white/[0.11] bg-[#080b10]/85 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
                          <textarea
                            ref={
                              textareaRef
                            }
                            value={
                              input
                            }
                            onChange={(
                              event
                            ) =>
                              setInput(
                                event
                                  .target
                                  .value
                              )
                            }
                            onKeyDown={
                              handleKeyDown
                            }
                            disabled={
                              loading
                            }
                            rows={
                              3
                            }
                            maxLength={
                              10000
                            }
                            placeholder="Tell ZUQEN what you want done..."
                            className="max-h-[220px] min-h-[120px] w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-7 text-white outline-none placeholder:text-white/20"
                          />

                          <div className="mt-2 flex items-center justify-between border-t border-white/[0.07] pt-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setShowExamples(
                                    (
                                      value
                                    ) =>
                                      !value
                                  )
                                }
                                className="rounded-lg px-3 py-2 text-xs text-white/40 transition hover:bg-white/[0.05] hover:text-white/75"
                              >
                                Examples
                              </button>

                              <button
                                onClick={() =>
                                  setShowTools(
                                    (
                                      value
                                    ) =>
                                      !value
                                  )
                                }
                                className="rounded-lg px-3 py-2 text-xs text-white/40 transition hover:bg-white/[0.05] hover:text-white/75"
                              >
                                Tools
                              </button>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="hidden text-[10px] text-white/20 sm:block">
                                {input.length.toLocaleString()}
                                /10,000
                              </span>

                              <button
                                onClick={() =>
                                  void runAutomation()
                                }
                                disabled={
                                  loading ||
                                  !input.trim()
                                }
                                className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                Run
                                <span>
                                  ↑
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {showExamples && (
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {EXAMPLES.map(
                              (
                                example
                              ) => (
                                <button
                                  key={
                                    example
                                  }
                                  onClick={() => {
                                    setInput(
                                      example
                                    );

                                    setShowExamples(
                                      false
                                    );

                                    textareaRef.current?.focus();
                                  }}
                                  className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-left text-xs leading-5 text-white/45 transition hover:border-white/[0.13] hover:bg-white/[0.05] hover:text-white/70"
                                >
                                  {
                                    example
                                  }
                                </button>
                              )
                            )}
                          </div>
                        )}

                        {showTools && (
                          <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 backdrop-blur-xl">
                            <div className="mb-3 flex items-center justify-between">
                              <div>
                                <div className="text-xs font-medium text-white/75">
                                  Automation
                                  Toolset
                                </div>

                                <div className="mt-1 text-[10px] text-white/25">
                                  The planner can
                                  select tools
                                  based on the
                                  task.
                                </div>
                              </div>

                              <span className="text-[10px] text-white/20">
                                {
                                  TOOL_NAMES.length
                                }{" "}
                                tools
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                              {TOOL_NAMES.map(
                                (
                                  toolName
                                ) => {
                                  const meta =
                                    TOOL_META[
                                      toolName
                                    ];

                                  return (
                                    <button
                                      key={
                                        toolName
                                      }
                                      onClick={() =>
                                        setSelectedTool(
                                          selectedTool ===
                                            toolName
                                            ? null
                                            : toolName
                                        )
                                      }
                                      className={`rounded-xl border p-3 text-left transition ${
                                        selectedTool ===
                                        toolName
                                          ? "border-white/15 bg-white/[0.08]"
                                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-xs text-white/65">
                                          {
                                            meta.icon
                                          }
                                        </span>

                                        <span className="text-[11px] font-medium text-white/65">
                                          {
                                            meta.label
                                          }
                                        </span>
                                      </div>

                                      {selectedTool ===
                                        toolName && (
                                        <p className="mt-2 text-[9px] leading-4 text-white/25">
                                          {
                                            meta.description
                                          }
                                        </p>
                                      )}
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}

                        <div className="mt-6 text-center text-[10px] text-white/15">
                          Automation Mode is
                          an independent
                          execution system.
                          It does not
                          automatically
                          orchestrate
                          ZUQEN&apos;s Website
                          Builder, Image
                          Generator, Video
                          Generator or Voice
                          Generator.
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* ACTIVE TASK */}
                    <div className="mb-8">
                      <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/20">
                        <span>
                          Automation Task
                        </span>

                        <span>
                          •
                        </span>

                        <span>
                          {formatDate(
                            task.created_at
                          )}
                        </span>
                      </div>

                      <h2 className="max-w-4xl text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
                        {
                          task.title
                        }
                      </h2>

                      <p className="mt-4 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-white/45">
                        {
                          task.prompt
                        }
                      </p>
                    </div>

                    {/* STATUS BAR */}
                    <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 backdrop-blur-xl">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm ${statusClass(
                              task.status
                            )}`}
                          >
                            {statusIcon(
                              task.status
                            )}
                          </span>

                          <div>
                            <div className="text-sm font-medium capitalize">
                              {statusLabel(
                                task.status
                              )}
                            </div>

                            <div className="mt-0.5 text-[10px] text-white/25">
                              {polling
                                ? "Live execution updates"
                                : "Automation state"}
                            </div>
                          </div>
                        </div>

                        {displaySteps.length >
                          0 && (
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {
                                completedSteps
                              }
                              /
                              {
                                displaySteps.length
                              }
                            </div>

                            <div className="text-[10px] text-white/25">
                              steps
                              completed
                            </div>
                          </div>
                        )}
                      </div>

                      {displaySteps.length >
                        0 && (
                        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-white transition-all duration-500"
                            style={{
                              width: `${
                                displaySteps.length >
                                0
                                  ? (completedSteps /
                                      displaySteps.length) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* CURRENT STEP */}
                    {runningStep && (
                      <div className="mb-6 rounded-2xl border border-sky-400/15 bg-sky-400/[0.035] p-5 backdrop-blur-xl">
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/10 text-sky-300">
                            {
                              getToolMeta(
                                runningStep.tool_name
                              ).icon
                            }
                          </div>

                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.15em] text-sky-300/60">
                              Current
                              action
                            </div>

                            <h3 className="mt-1 text-sm font-semibold">
                              {
                                runningStep.name
                              }
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-white/35">
                              {runningStep.description ||
                                getToolMeta(
                                  runningStep.tool_name
                                ).description}
                            </p>
                          </div>

                          <span className="ml-auto shrink-0 rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[9px] uppercase tracking-wider text-sky-300">
                            {statusLabel(
                              runningStep.status
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* EXECUTION STEPS */}
                    {displaySteps.length >
                      0 && (
                      <div className="mb-8">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold">
                              Execution
                            </h3>

                            <p className="mt-1 text-[10px] text-white/25">
                              Planned
                              actions and
                              live tool
                              state
                            </p>
                          </div>

                          <span className="text-[10px] text-white/20">
                            {
                              displaySteps.length
                            }{" "}
                            steps
                          </span>
                        </div>

                        <div className="space-y-2">
                          {displaySteps.map(
                            (
                              step,
                              index
                            ) => {
                              const meta =
                                getToolMeta(
                                  step.tool_name
                                );

                              return (
                                <div
                                  key={
                                    step.id
                                  }
                                  className={`rounded-2xl border p-4 backdrop-blur-xl transition ${
                                    step.status ===
                                    "running"
                                      ? "border-sky-400/15 bg-sky-400/[0.025]"
                                      : "border-white/[0.07] bg-white/[0.02]"
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs ${statusClass(
                                        step.status
                                      )}`}
                                    >
                                      {statusIcon(
                                        step.status
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] text-white/20">
                                          {String(
                                            step.step_number ||
                                              index +
                                                1
                                          ).padStart(
                                            2,
                                            "0"
                                          )}
                                        </span>

                                        <h4 className="text-xs font-medium text-white/75">
                                          {
                                            step.name
                                          }
                                        </h4>

                                        <span className="rounded-md border border-white/[0.06] bg-white/[0.025] px-2 py-0.5 text-[9px] text-white/30">
                                          {
                                            meta.label
                                          }
                                        </span>
                                      </div>

                                      {step.description && (
                                        <p className="mt-2 text-[11px] leading-5 text-white/30">
                                          {
                                            step.description
                                          }
                                        </p>
                                      )}

                                      {step.status ===
                                        "failed" &&
                                        step.errors !==
                                          null &&
                                        step.errors !==
                                          undefined && (
                                          <pre className="mt-3 overflow-x-auto rounded-xl border border-red-400/10 bg-red-400/[0.03] p-3 text-[10px] leading-5 text-red-300/70">
                                            {safeJson(
                                              step.errors
                                            )}
                                          </pre>
                                        )}

                                      {step.status ===
                                        "completed" &&
                                        step.output !==
                                          null &&
                                        step.output !==
                                          undefined && (
                                          <details className="mt-3">
                                            <summary className="cursor-pointer text-[10px] text-white/25 hover:text-white/50">
                                              View
                                              step
                                              output
                                            </summary>

                                            <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-white/[0.06] bg-black/20 p-3 text-[10px] leading-5 text-white/35">
                                              {safeJson(
                                                step.output
                                              )}
                                            </pre>
                                          </details>
                                        )}
                                    </div>

                                    <span
                                      className={`shrink-0 rounded-full border px-2 py-1 text-[9px] capitalize ${statusClass(
                                        step.status
                                      )}`}
                                    >
                                      {statusLabel(
                                        step.status
                                      )}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )}

                    {/* PLAN */}
                    {task.plan !==
                      null &&
                      task.plan !==
                        undefined && (
                        <details className="mb-8 rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-xl">
                          <summary className="cursor-pointer list-none p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-sm font-semibold">
                                  Automation
                                  Plan
                                </h3>

                                <p className="mt-1 text-[10px] text-white/25">
                                  Planner
                                  output
                                </p>
                              </div>

                              <span className="text-xs text-white/25">
                                +
                              </span>
                            </div>
                          </summary>

                          <div className="border-t border-white/[0.06] p-5">
                            <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap break-words text-[11px] leading-6 text-white/35">
                              {safeJson(
                                task.plan
                              )}
                            </pre>
                          </div>
                        </details>
                      )}

                    {/* RESULT */}
                    {(task.status ===
                      "completed" ||
                      researchAnswer.length >
                        0 ||
                      researchSources.length >
                        0) && (
                      <div className="mb-8">
                        <div className="mb-3">
                          <h3 className="text-sm font-semibold">
                            Result
                          </h3>

                          <p className="mt-1 text-[10px] text-white/25">
                            Verified
                            automation
                            output
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 backdrop-blur-xl">
                          {researchAnswer.length >
                          0 ? (
                            <div className="whitespace-pre-wrap text-sm leading-7 text-white/70">
                              {
                                researchAnswer
                              }
                            </div>
                          ) : (
                            <>
                              {task.result !==
                                null &&
                              task.result !==
                                undefined ? (
                                <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-white/45">
                                  {safeJson(
                                    task.result
                                  )}
                                </pre>
                              ) : (
                                <div className="text-sm text-white/25">
                                  Automation
                                  completed
                                  without a
                                  textual
                                  result.
                                </div>
                              )}
                            </>
                          )}

                          {researchSources.length >
                            0 && (
                            <div className="mt-7 border-t border-white/[0.07] pt-5">
                              <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/25">
                                Sources
                              </div>

                              <div className="space-y-2">
                                {researchSources.map(
                                  (
                                    source,
                                    index
                                  ) => {
                                    const item: JsonObject =
                                      source &&
                                      typeof source ===
                                        "object" &&
                                      !Array.isArray(
                                        source
                                      )
                                        ? (source as JsonObject)
                                        : {};

                                    const title =
                                      typeof item.title ===
                                      "string"
                                        ? item.title
                                        : `Source ${
                                            index +
                                            1
                                          }`;

                                    const url =
                                      typeof item.url ===
                                      "string"
                                        ? item.url
                                        : "";

                                    const snippet =
                                      typeof item.content ===
                                      "string"
                                        ? item.content
                                        : typeof item.snippet ===
                                            "string"
                                          ? item.snippet
                                          : "";

                                    return (
                                      <div
                                        key={`${url}-${index}`}
                                        className="rounded-xl border border-white/[0.06] bg-black/10 p-4"
                                      >
                                        <div className="text-xs font-medium text-white/65">
                                          {
                                            title
                                          }
                                        </div>

                                        {url.length >
                                          0 && (
                                          <div className="mt-1 truncate text-[10px] text-sky-300/50">
                                            {
                                              url
                                            }
                                          </div>
                                        )}

                                        {snippet.length >
                                          0 && (
                                          <p className="mt-2 line-clamp-3 text-[10px] leading-5 text-white/25">
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
                      </div>
                    )}

                    {/* WAITING APPROVAL */}
                    {task.status ===
                      "waiting_approval" && (
                      <div className="mb-8 rounded-2xl border border-amber-400/15 bg-amber-400/[0.035] p-5">
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/10 text-amber-300">
                            !
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold">
                              Approval
                              required
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-white/35">
                              This automation
                              is waiting
                              for an approval
                              step before
                              continuing.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* FAILURE */}
                    {task.status ===
                      "failed" && (
                      <div className="mb-8 rounded-2xl border border-red-400/15 bg-red-400/[0.035] p-5 backdrop-blur-xl">
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/15 bg-red-400/10 text-red-300">
                            ×
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold">
                              Automation
                              failed
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-white/35">
                              The execution
                              engine
                              reported an
                              error.
                            </p>

                            {task.errors !==
                              null &&
                              task.errors !==
                                undefined && (
                                <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-red-400/10 bg-black/20 p-3 text-[10px] leading-5 text-red-300/60">
                                  {safeJson(
                                    task.errors
                                  )}
                                </pre>
                              )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* COMPOSER AGAIN */}
                    {(task.status ===
                      "completed" ||
                      task.status ===
                        "failed" ||
                      task.status ===
                        "cancelled") && (
                      <div className="mt-8">
                        <div className="rounded-[22px] border border-white/[0.09] bg-[#080b10]/85 p-3 backdrop-blur-xl">
                          <textarea
                            value={
                              input
                            }
                            onChange={(
                              event
                            ) =>
                              setInput(
                                event
                                  .target
                                  .value
                              )
                            }
                            onKeyDown={
                              handleKeyDown
                            }
                            disabled={
                              loading
                            }
                            rows={2}
                            maxLength={
                              10000
                            }
                            placeholder="Run another automation..."
                            className="min-h-[82px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/20"
                          />

                          <div className="flex items-center justify-end border-t border-white/[0.07] pt-3">
                            <button
                              onClick={() =>
                                void runAutomation()
                              }
                              disabled={
                                loading ||
                                !input.trim()
                              }
                              className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-30"
                            >
                              Run automation
                              ↑
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <footer className="mt-10 border-t border-white/[0.06] pt-5 text-center text-[10px] text-white/15">
                      ZUQEN Automation •
                      Independent execution
                      engine
                    </footer>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT DETAILS */}
            {task &&
              detailsOpen && (
                <aside className="hidden w-[285px] shrink-0 border-l border-white/[0.07] bg-[#05070a]/70 backdrop-blur-xl xl:block">
                  <div className="sticky top-0 p-5">
                    <div className="mb-5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/20">
                        Task Details
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="text-[9px] uppercase tracking-wider text-white/20">
                          Status
                        </div>

                        <div className="mt-2">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-[9px] capitalize ${statusClass(
                              task.status
                            )}`}
                          >
                            {statusLabel(
                              task.status
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                          <div className="text-[9px] uppercase tracking-wider text-white/20">
                            Run
                          </div>

                          <div className="mt-1 text-sm text-white/70">
                            #
                            {
                              run?.run_number ||
                              1
                            }
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                          <div className="text-[9px] uppercase tracking-wider text-white/20">
                            Steps
                          </div>

                          <div className="mt-1 text-sm text-white/70">
                            {
                              displaySteps.length
                            }
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="text-[9px] uppercase tracking-wider text-white/20">
                          Created
                        </div>

                        <div className="mt-1 text-xs text-white/55">
                          {formatDate(
                            task.created_at
                          )}
                        </div>

                        <div className="mt-0.5 text-[10px] text-white/20">
                          {formatTime(
                            task.created_at
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="text-[9px] uppercase tracking-wider text-white/20">
                          Tools selected
                        </div>

                        <div className="mt-3 space-y-2">
                          {activeTools.length ===
                          0 ? (
                            <div className="text-[10px] text-white/20">
                              Waiting for
                              planner
                            </div>
                          ) : (
                            activeTools.map(
                              (
                                toolName
                              ) => {
                                const meta =
                                  getToolMeta(
                                    toolName
                                  );

                                return (
                                  <div
                                    key={
                                      toolName
                                    }
                                    className="flex items-center gap-2"
                                  >
                                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.05] text-[10px] text-white/45">
                                      {
                                        meta.icon
                                      }
                                    </span>

                                    <span className="text-[10px] text-white/40">
                                      {
                                        meta.label
                                      }
                                    </span>
                                  </div>
                                );
                              }
                            )
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="text-[9px] uppercase tracking-wider text-white/20">
                          Task ID
                        </div>

                        <div className="mt-2 break-all font-mono text-[9px] leading-4 text-white/20">
                          {
                            task.id
                          }
                        </div>
                      </div>

                      {run?.id && (
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                          <div className="text-[9px] uppercase tracking-wider text-white/20">
                            Run ID
                          </div>

                          <div className="mt-2 break-all font-mono text-[9px] leading-4 text-white/20">
                            {
                              run.id
                            }
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() =>
                          void deleteAutomationTask(
                            task
                          )
                        }
                        disabled={
                          deletingTaskId !==
                          null
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/10 bg-red-400/[0.035] px-3 py-3 text-xs text-red-300/65 transition hover:border-red-400/20 hover:bg-red-400/[0.07] hover:text-red-300 disabled:opacity-40"
                      >
                        <span>
                          ×
                        </span>

                        Delete
                        automation
                      </button>
                    </div>
                  </div>
                </aside>
              )}
          </div>

          {errorMessage && (
            <div className="border-t border-red-400/10 bg-red-400/[0.035] px-5 py-3 backdrop-blur-xl">
              <div className="mx-auto flex max-w-[1200px] items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-red-300/45">
                    Automation error
                  </div>

                  <div className="mt-1 break-words text-xs text-red-300/80">
                    {
                      errorMessage
                    }
                  </div>
                </div>

                <button
                  onClick={() =>
                    setErrorMessage(
                      ""
                    )
                  }
                  className="shrink-0 text-xs text-white/25 hover:text-white/60"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}