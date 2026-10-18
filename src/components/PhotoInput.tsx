"use client";

import { useRef } from "react";

/** A normal photo picker plus a "Take photo" button that opens the phone camera and drops the shot into the same input. */
export function PhotoInput({
  id,
  name = "photo",
  required,
  disabled,
  className = "field mt-1 !text-base",
  front,
  onPicked,
}: {
  id: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  front?: boolean; // selfie camera (profile pictures)
  onPicked?: (picked: boolean) => void;
}) {
  const main = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);

  function fromCamera(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !main.current) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    main.current.files = dt.files;
    e.target.value = "";
    onPicked?.(true);
  }

  return (
    <div className="mt-1 space-y-2">
      <input ref={main} id={id} name={name} type="file" accept="image/*" required={required} disabled={disabled} className={className.replace(/\bmt-1\b/, "")} onChange={(e) => onPicked?.(Boolean(e.target.files?.length))} />
      <input ref={cam} type="file" accept="image/*" capture={front ? "user" : "environment"} hidden tabIndex={-1} aria-hidden onChange={fromCamera} />
      <button type="button" className="btn btn-blue w-full" disabled={disabled} onClick={() => cam.current?.click()}>
        Take a photo with camera
      </button>
    </div>
  );
}
