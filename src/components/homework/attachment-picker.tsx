"use client";

import { Microphone, Paperclip, Stop, X } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/routing";
import { localDigits } from "@/lib/format";
import { fileSize } from "./file-link";
import { MAX_FILES } from "@/server/files/limits";

const ACCEPT = ".pdf,.docx,image/jpeg,image/png,image/webp,audio/*";

type Kept = { id: string; name: string; mime?: string; size?: number };

const ext = (name: string) => name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "";

/**
 * Files for a form, sent as the `files` field. Anyone can also record their voice, which is
 * added like any other file. `recorder` only picks the learner's wording. `kept` are files already stored: removing one drops its `keep` id.
 */
export function AttachmentPicker({
  recorder = false,
  kept = [],
  disabled,
  recordLabel,
}: {
  /** Wording of the record button (e.g. a teacher's voice sample for a speaking task). */
  recordLabel?: string;
  recorder?: boolean;
  kept?: Kept[];
  disabled?: boolean;
}) {
  const t = useTranslations(recorder ? "Student.homework" : "Admin.homework.assignDialog");
  const locale = useLocale() as Locale;
  const [picked, setPicked] = useState<File[]>([]);
  const [keep, setKeep] = useState(kept);
  const [seconds, setSeconds] = useState<number | null>(null);
  // Length of what was recorded here, by file; uploaded audio shows it in the player.
  const [lengths, setLengths] = useState(() => new Map<File, number>());
  const [micDenied, setMicDenied] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const chooser = useRef<HTMLInputElement>(null);
  const media = useRef<{ recorder: MediaRecorder; stream: MediaStream; timer: number } | null>(
    null,
  );
  const full = picked.length + keep.length >= MAX_FILES;

  // The named input is what the form submits; keep its files in step with the list.
  useEffect(() => {
    const transfer = new DataTransfer();
    for (const file of picked) transfer.items.add(file);
    if (field.current) field.current.files = transfer.files;
  }, [picked]);

  function stopTracks() {
    if (!media.current) return;
    clearInterval(media.current.timer);
    media.current.stream.getTracks().forEach((track) => track.stop());
    media.current = null;
  }

  useEffect(() => stopTracks, []);

  async function start() {
    setMicDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Safari records MP4 audio; the others WebM.
      const type = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const started = Date.now();
      const rec = new MediaRecorder(stream, { mimeType: type });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        const ext = type === "audio/webm" ? "webm" : "m4a";
        const file = new File(chunks, `voice.${ext}`, { type });
        setLengths((m) => new Map(m).set(file, Math.round((Date.now() - started) / 1000)));
        setPicked((files) => [...files, file]);
        setSeconds(null);
        stopTracks();
      };
      setSeconds(0);
      media.current = {
        recorder: rec,
        stream,
        timer: window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500),
      };
      rec.start();
    } catch {
      setMicDenied(true);
    }
  }

  const clock = (s: number) =>
    localDigits(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, locale);
  const attachLabel = recorder ? t("addFile") : t("attach");
  const urls = useMemo(() => picked.map((f) => URL.createObjectURL(f)), [picked]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const names = [
    ...keep.map((k) => ({
      key: k.id,
      name: k.name,
      size: k.size,
      audio: k.mime?.startsWith("audio/") ?? false,
      url: `/api/files/${k.id}`,
      length: undefined as number | undefined,
      remove: () => setKeep(keep.filter((x) => x !== k)),
    })),
    ...picked.map((f, i) => ({
      key: `${f.name}-${i}`,
      name: f.name,
      size: f.size,
      audio: f.type.startsWith("audio/"),
      url: urls[i],
      length: lengths.get(f),
      remove: () => setPicked(picked.filter((_, j) => j !== i)),
    })),
  ];

  return (
    <div className="space-y-3">
      <input ref={field} type="file" name="files" multiple hidden tabIndex={-1} aria-hidden />
      {keep.map((k) => (
        <input key={k.id} type="hidden" name="keep" value={k.id} />
      ))}
      <input
        ref={chooser}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          setPicked((files) =>
            [...files, ...Array.from(e.target.files ?? [])].slice(0, MAX_FILES - keep.length),
          );
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={disabled || full || seconds !== null}
          onClick={() => chooser.current?.click()}
          className="inline-flex min-h-touch flex-1 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line px-4 font-bold text-brand hover:border-brand disabled:opacity-60"
        >
          <Paperclip aria-hidden size={18} />
          {attachLabel}
        </button>
        {seconds === null ? (
          <button
            type="button"
            disabled={disabled || full}
            onClick={start}
            className="inline-flex min-h-touch flex-1 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line px-4 font-bold text-brand hover:border-brand disabled:opacity-60"
          >
            <Microphone aria-hidden size={18} />
            {recordLabel ?? t("record")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => media.current?.recorder.stop()}
            className="inline-flex min-h-touch flex-1 items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 font-bold text-white"
          >
            <Stop aria-hidden size={18} weight="fill" />
            {t("stop")} · {clock(seconds)}
          </button>
        )}
      </div>
      {!recorder && <p className="text-sm">{t("attachHint")}</p>}
      {micDenied && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {t("micDenied")}
        </p>
      )}
      {names.length > 0 && (
        <ul className="space-y-2">
          {names.map(({ key, name, size, audio, url, length, remove }) => (
            <li key={key} className="space-y-1.5 rounded-2xl bg-surface px-3.5 py-2 text-ocean">
              <div className="flex items-center gap-2">
                <span
                  dir="ltr"
                  className="grid h-7 min-w-11 shrink-0 place-items-center rounded-lg bg-white px-1.5 text-xs font-extrabold text-brand"
                >
                  {ext(name)}
                </span>
                <span dir="auto" className="min-w-0 flex-1 truncate font-semibold">
                  {name}
                </span>
                <span className="shrink-0 text-sm text-body">
                  {[size ? fileSize(size, locale) : null, length ? clock(length) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={
                    recorder ? t("removeAttachment", { name }) : t("removeFile", { name })
                  }
                  onClick={remove}
                  className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-mist"
                >
                  <X aria-hidden size={16} />
                </button>
              </div>
              {audio && (
                <audio controls preload="metadata" src={url} aria-label={name} className="w-full" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
