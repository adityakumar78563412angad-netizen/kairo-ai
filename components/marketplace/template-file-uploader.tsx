"use client";

import { useState } from "react";
import {
  CheckCircle2,
  FileArchive,
  FileText,
  Image as ImageIcon,
  Loader2,
  Upload,
  Video,
  X,
} from "lucide-react";

type UploadRole =
  | "template"
  | "thumbnail"
  | "screenshot"
  | "demo_video"
  | "documentation"
  | "asset";

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  role: UploadRole;
  status: "uploading" | "complete" | "error";
  error?: string;
};

type Props = {
  templateId: string;
  defaultRole?: UploadRole;
};

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

const ROLE_CONFIG: Record<
  UploadRole,
  {
    label: string;
    description: string;
    accept: string;
    icon: typeof FileArchive;
    multiple: boolean;
  }
> = {
  template: {
    label: "Template Package",
    description: "ZIP/source package of your template.",
    accept: ".zip,application/zip,application/x-zip-compressed",
    icon: FileArchive,
    multiple: false,
  },

  thumbnail: {
    label: "Thumbnail",
    description: "Main marketplace thumbnail.",
    accept: "image/jpeg,image/png,image/webp",
    icon: ImageIcon,
    multiple: false,
  },

  screenshot: {
    label: "Screenshots",
    description: "Screenshots showing the actual template.",
    accept: "image/jpeg,image/png,image/webp",
    icon: ImageIcon,
    multiple: true,
  },

  demo_video: {
    label: "Demo Video",
    description: "Video demonstrating the actual template.",
    accept: "video/mp4,video/webm",
    icon: Video,
    multiple: false,
  },

  documentation: {
    label: "Documentation",
    description: "PDF or Markdown documentation.",
    accept:
      ".pdf,.md,.txt,application/pdf,text/markdown,text/plain",
    icon: FileText,
    multiple: true,
  },

  asset: {
    label: "Additional Assets",
    description: "Optional supporting assets.",
    accept:
      ".zip,.pdf,.txt,.md,image/jpeg,image/png,image/webp",
    icon: FileText,
    multiple: true,
  },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function isValidUploadRole(value: string): value is UploadRole {
  return (
    value === "template" ||
    value === "thumbnail" ||
    value === "screenshot" ||
    value === "demo_video" ||
    value === "documentation" ||
    value === "asset"
  );
}

export default function TemplateFileUploader({
  templateId,
  defaultRole = "template",
}: Props) {
  const initialRole: UploadRole = isValidUploadRole(defaultRole)
    ? defaultRole
    : "template";

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [activeRole, setActiveRole] =
    useState<UploadRole>(initialRole);

  async function uploadFile(
    file: File,
    role: UploadRole
  ) {
    if (!templateId) {
      throw new Error(
        "Save the template draft before uploading files."
      );
    }

    if (file.size <= 0) {
      throw new Error("The selected file is empty.");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Maximum file size is 2 GB.");
    }

    const localId = crypto.randomUUID();

    const contentType =
      file.type || "application/octet-stream";

    setFiles((current) => [
      ...current,
      {
        id: localId,
        name: file.name,
        size: file.size,
        role,
        status: "uploading",
      },
    ]);

    try {
      /*
       * Step 1:
       * Ask ZUQEN server for a temporary B2 upload URL.
       */
      const urlResponse = await fetch(
        "/api/marketplace/storage/upload-url",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            templateId,
            filename: file.name,
            contentType,
            contentLength: file.size,
            role,
          }),
        }
      );

      let urlData: {
        uploadUrl?: string;
        objectKey?: string;
        error?: string;
      };

      try {
        urlData = await urlResponse.json();
      } catch {
        throw new Error(
          "The upload preparation server returned an invalid response."
        );
      }

      if (!urlResponse.ok) {
        throw new Error(
          urlData.error ||
            "Unable to prepare the file upload."
        );
      }

      if (!urlData.uploadUrl || !urlData.objectKey) {
        throw new Error(
          "The upload server did not return valid storage information."
        );
      }

      /*
       * Step 2:
       * Upload the actual file directly to Backblaze B2.
       *
       * The application server never receives the large file.
       */
      const uploadResponse = await fetch(
        urlData.uploadUrl,
        {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
          },
          body: file,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(
          `Storage upload failed with status ${uploadResponse.status}.`
        );
      }

      /*
       * Step 3:
       * Tell ZUQEN server that the B2 object exists.
       *
       * The server performs a HeadObject verification before
       * saving the metadata in Supabase.
       */
      const completeResponse = await fetch(
        "/api/marketplace/storage/complete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            templateId,
            objectKey: urlData.objectKey,
            fileName: file.name,
            contentType,
            fileSize: file.size,
            fileRole: role,
          }),
        }
      );

      let completeData: {
        error?: string;
      };

      try {
        completeData = await completeResponse.json();
      } catch {
        throw new Error(
          "The upload completion server returned an invalid response."
        );
      }

      if (!completeResponse.ok) {
        throw new Error(
          completeData.error ||
            "Unable to save uploaded file metadata."
        );
      }

      setFiles((current) =>
        current.map((item) =>
          item.id === localId
            ? {
                ...item,
                status: "complete",
              }
            : item
        )
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Upload failed.";

      setFiles((current) =>
        current.map((item) =>
          item.id === localId
            ? {
                ...item,
                status: "error",
                error: message,
              }
            : item
        )
      );
    }
  }

  function handleFiles(
    selectedFiles: FileList | null,
    role: UploadRole
  ) {
    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }

    const selected = Array.from(selectedFiles);

    /*
     * Single-file roles should only ever start one upload.
     * The browser normally enforces this through `multiple={false}`,
     * but we enforce it here as well.
     */
    const filesToUpload = ROLE_CONFIG[role].multiple
      ? selected
      : selected.slice(0, 1);

    for (const file of filesToUpload) {
      void uploadFile(file, role);
    }
  }

  function removeLocalFile(id: string) {
    /*
     * This only removes the item from the current UI.
     *
     * The actual B2 object remains stored because a server-side
     * delete endpoint has not been requested by this component.
     */
    setFiles((current) =>
      current.filter((file) => file.id !== id)
    );
  }

  const config = ROLE_CONFIG[activeRole];
  const Icon = config.icon;

  return (
    <section className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Template Files & Media
        </h2>

        <p className="mt-1 text-sm text-white/50">
          Upload the real files that buyers will receive and
          the media used to present your template.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(ROLE_CONFIG) as UploadRole[]).map(
          (role) => {
            const item = ROLE_CONFIG[role];
            const ItemIcon = item.icon;

            return (
              <button
                key={role}
                type="button"
                onClick={() => setActiveRole(role)}
                className={`rounded-xl border p-4 text-left transition ${
                  activeRole === role
                    ? "border-white/25 bg-white/[0.08]"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                }`}
              >
                <ItemIcon className="h-5 w-5 text-white/70" />

                <div className="mt-3 text-sm font-medium text-white">
                  {item.label}
                </div>

                <div className="mt-1 text-xs leading-5 text-white/40">
                  {item.description}
                </div>
              </button>
            );
          }
        )}
      </div>

      <label className="group block cursor-pointer rounded-2xl border border-dashed border-white/15 bg-black/10 p-8 text-center transition hover:border-white/30 hover:bg-white/[0.03]">
        <input
          type="file"
          className="hidden"
          accept={config.accept}
          multiple={config.multiple}
          onChange={(event) => {
            handleFiles(event.target.files, activeRole);
            event.currentTarget.value = "";
          }}
        />

        <Upload className="mx-auto h-8 w-8 text-white/50 transition group-hover:text-white" />

        <div className="mt-4 text-sm font-medium text-white">
          Upload {config.label}
        </div>

        <div className="mt-1 text-xs text-white/40">
          Maximum individual file size: 2 GB
          {config.multiple
            ? " · Multiple files allowed"
            : " · One file"}
        </div>
      </label>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                {file.status === "uploading" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                ) : file.status === "complete" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <X className="h-4 w-4 text-red-400" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-white">
                  {file.name}
                </div>

                <div className="mt-0.5 text-xs text-white/40">
                  {formatBytes(file.size)} ·{" "}
                  {ROLE_CONFIG[file.role].label}
                </div>

                {file.status === "uploading" && (
                  <div className="mt-1 text-xs text-white/40">
                    Uploading to secure storage…
                  </div>
                )}

                {file.status === "complete" && (
                  <div className="mt-1 text-xs text-emerald-400/80">
                    Upload completed successfully.
                  </div>
                )}

                {file.error && (
                  <div className="mt-1 text-xs text-red-400">
                    {file.error}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  removeLocalFile(file.id)
                }
                className="rounded-lg p-2 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Remove upload from list"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] p-4 text-xs leading-5 text-white/50">
        Files are stored privately in Backblaze B2. Paid
        template files will not be exposed through permanent
        public URLs. Buyer downloads will use temporary
        authenticated download URLs.
      </div>
    </section>
  );
}