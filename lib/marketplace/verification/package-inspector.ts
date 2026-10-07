import "server-only";

import fs from "node:fs";
import path from "node:path";
import yauzl from "yauzl";

const MAX_ARCHIVE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_ENTRIES = 100_000;
const MAX_TOTAL_UNCOMPRESSED_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB
const MAX_SINGLE_FILE_SIZE = 1 * 1024 * 1024 * 1024; // 1 GB
const MAX_PATH_LENGTH = 1024;

const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".com",
  ".scr",
  ".msi",
  ".bat",
  ".cmd",
  ".ps1",
  ".vbs",
  ".vbe",
  ".wsf",
  ".wsh",
  ".jar",
  ".class",
]);

const IMPORTANT_FILES = [
  "package.json",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "vite.config.js",
  "vite.config.ts",
  "tsconfig.json",
  "src",
  "app",
  "pages",
  "public",
  "components",
];

export type PackageInspectionSeverity = "info" | "warning" | "critical";

export interface PackageInspectionFinding {
  severity: PackageInspectionSeverity;
  code: string;
  message: string;
  path?: string;
}

export interface PackageInspectionEntry {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
  isDirectory: boolean;
  extension: string | null;
}

export interface PackageInspectionResult {
  status: "pass" | "warning" | "fail";
  packageType: "zip";
  archiveSize: number;
  entryCount: number;
  totalUncompressedSize: number;
  compressionRatio: number | null;
  frameworkHints: string[];
  importantFiles: string[];
  suspiciousFiles: string[];
  findings: PackageInspectionFinding[];
  entries: PackageInspectionEntry[];
}

function normalizeArchivePath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\/+/, "");
}

function getExtension(filePath: string): string | null {
  const ext = path.posix.extname(filePath).toLowerCase();
  return ext || null;
}

function isDirectoryEntry(filePath: string): boolean {
  return filePath.endsWith("/");
}

function isPathTraversal(filePath: string): boolean {
  const normalized = path.posix.normalize(filePath);

  return (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  );
}

function detectFrameworkHints(entries: PackageInspectionEntry[]): string[] {
  const files = new Set(
    entries
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.path.toLowerCase()),
  );

  const hints = new Set<string>();

  if (files.has("package.json")) {
    hints.add("Node.js");
  }

  if (
    files.has("next.config.js") ||
    files.has("next.config.mjs") ||
    files.has("next.config.ts") ||
    [...files].some((file) => file.includes("/next.config."))
  ) {
    hints.add("Next.js");
  }

  if (
    files.has("vite.config.js") ||
    files.has("vite.config.ts") ||
    [...files].some((file) => file.includes("/vite.config."))
  ) {
    hints.add("Vite");
  }

  if (files.has("angular.json")) {
    hints.add("Angular");
  }

  if (files.has("nuxt.config.ts") || files.has("nuxt.config.js")) {
    hints.add("Nuxt");
  }

  if (files.has("svelte.config.js") || files.has("svelte.config.ts")) {
    hints.add("Svelte");
  }

  if (
    files.has("astro.config.mjs") ||
    files.has("astro.config.ts") ||
    files.has("astro.config.js")
  ) {
    hints.add("Astro");
  }

  if (files.has("manage.py")) {
    hints.add("Django");
  }

  if (
    files.has("requirements.txt") ||
    files.has("pyproject.toml") ||
    files.has("setup.py")
  ) {
    hints.add("Python");
  }

  if (files.has("composer.json")) {
    hints.add("PHP/Composer");
  }

  if (files.has("go.mod")) {
    hints.add("Go");
  }

  if (files.has("cargo.toml")) {
    hints.add("Rust");
  }

  return [...hints];
}

function collectImportantFiles(
  entries: PackageInspectionEntry[],
): string[] {
  const result: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const lower = entry.path.toLowerCase();

    if (
      IMPORTANT_FILES.some(
        (important) =>
          lower === important.toLowerCase() ||
          lower.startsWith(`${important.toLowerCase()}/`),
      )
    ) {
      result.push(entry.path);
    }
  }

  return result.slice(0, 500);
}

function inspectEntry(
  entry: yauzl.Entry,
  findings: PackageInspectionFinding[],
  suspiciousFiles: string[],
): PackageInspectionEntry {
  const archivePath = normalizeArchivePath(entry.fileName);
  const isDirectory = isDirectoryEntry(archivePath);
  const extension = isDirectory ? null : getExtension(archivePath);

  if (archivePath.length > MAX_PATH_LENGTH) {
    findings.push({
      severity: "warning",
      code: "LONG_PATH",
      message: "Archive contains an unusually long file path.",
      path: archivePath.slice(0, MAX_PATH_LENGTH),
    });
  }

  if (isPathTraversal(archivePath)) {
    findings.push({
      severity: "critical",
      code: "PATH_TRAVERSAL",
      message: "Archive contains a path traversal entry.",
      path: archivePath,
    });
  }

  if (
    extension &&
    BLOCKED_EXTENSIONS.has(extension)
  ) {
    suspiciousFiles.push(archivePath);

    findings.push({
      severity: "critical",
      code: "EXECUTABLE_FILE",
      message:
        "Archive contains an executable or script-like file type that requires manual security review.",
      path: archivePath,
    });
  }

  if (entry.uncompressedSize > MAX_SINGLE_FILE_SIZE) {
    findings.push({
      severity: "warning",
      code: "LARGE_FILE",
      message: "Archive contains an unusually large individual file.",
      path: archivePath,
    });
  }

  return {
    path: archivePath,
    compressedSize: entry.compressedSize,
    uncompressedSize: entry.uncompressedSize,
    isDirectory,
    extension,
  };
}

function calculateStatus(
  findings: PackageInspectionFinding[],
): PackageInspectionResult["status"] {
  if (findings.some((finding) => finding.severity === "critical")) {
    return "fail";
  }

  if (findings.some((finding) => finding.severity === "warning")) {
    return "warning";
  }

  return "pass";
}

export async function inspectTemplatePackage(
  filePath: string,
  expectedSize?: number,
): Promise<PackageInspectionResult> {
  const stat = await fs.promises.stat(filePath);

  if (!stat.isFile()) {
    throw new Error("Template package path is not a file.");
  }

  const archiveSize = stat.size;

  if (expectedSize !== undefined && expectedSize !== archiveSize) {
    throw new Error(
      "Template package size does not match the stored file metadata.",
    );
  }

  if (archiveSize > MAX_ARCHIVE_SIZE) {
    throw new Error("Template package exceeds the maximum supported size.");
  }

  const findings: PackageInspectionFinding[] = [];
  const suspiciousFiles: string[] = [];
  const entries: PackageInspectionEntry[] = [];

  let totalUncompressedSize = 0;

  return new Promise((resolve, reject) => {
    yauzl.open(
      filePath,
      {
        lazyEntries: true,
        validateEntrySizes: true,
      },
      (openError, zipFile) => {
        if (openError || !zipFile) {
          reject(
            openError ??
              new Error("Unable to open template ZIP package."),
          );
          return;
        }

        let finished = false;

        const fail = (error: Error) => {
          if (finished) return;

          finished = true;

          try {
            zipFile.close();
          } catch {
            // Ignore close errors.
          }

          reject(error);
        };

        const finish = () => {
          if (finished) return;

          finished = true;

          const compressionRatio =
            totalUncompressedSize > 0
              ? archiveSize / totalUncompressedSize
              : null;

          const result: PackageInspectionResult = {
            status: calculateStatus(findings),
            packageType: "zip",
            archiveSize,
            entryCount: entries.length,
            totalUncompressedSize,
            compressionRatio,
            frameworkHints: detectFrameworkHints(entries),
            importantFiles: collectImportantFiles(entries),
            suspiciousFiles: suspiciousFiles.slice(0, 500),
            findings: findings.slice(0, 1_000),
            entries: entries.slice(0, 5_000),
          };

          try {
            zipFile.close();
          } catch {
            // Ignore close errors.
          }

          resolve(result);
        };

        zipFile.on("error", fail);

        zipFile.readEntry();

        zipFile.on("entry", (entry) => {
          if (finished) return;

          if (entries.length >= MAX_ENTRIES) {
            fail(
              new Error(
                `Template package contains more than ${MAX_ENTRIES.toLocaleString()} entries.`,
              ),
            );
            return;
          }

          let inspected: PackageInspectionEntry;

          try {
            inspected = inspectEntry(
              entry,
              findings,
              suspiciousFiles,
            );
          } catch (error) {
            fail(
              error instanceof Error
                ? error
                : new Error("Failed to inspect ZIP entry."),
            );
            return;
          }

          entries.push(inspected);

          totalUncompressedSize += entry.uncompressedSize;

          if (
            totalUncompressedSize >
            MAX_TOTAL_UNCOMPRESSED_SIZE
          ) {
            fail(
              new Error(
                "Template package expands beyond the allowed inspection limit.",
              ),
            );
            return;
          }

          zipFile.readEntry();
        });

        zipFile.on("end", finish);
      },
    );
  });
}