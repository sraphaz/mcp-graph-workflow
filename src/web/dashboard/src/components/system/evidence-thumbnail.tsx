/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 3.1: EvidenceThumbnail — image thumbnail
 * Used in: Browser Tests, Agent Trail
 */

interface EvidenceThumbnailProps {
  src: string;
  alt: string;
  label?: string;
}

export function EvidenceThumbnail({ src, alt, label }: EvidenceThumbnailProps): React.JSX.Element {
  return (
    <figure className="flex flex-col items-center gap-1">
      <div className="rounded-md border border-slate-700 overflow-hidden bg-slate-900 w-full">
        <img
          src={src}
          alt={alt}
          className="w-full h-auto object-cover"
          loading="lazy"
        />
      </div>
      {label && (
        <figcaption className="text-[10px] text-slate-500 text-center truncate w-full">
          {label}
        </figcaption>
      )}
    </figure>
  );
}
