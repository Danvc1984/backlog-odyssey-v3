import Image from "next/image";

export function ArtworkBackdrop({
  src,
  fit = "contain",
  backgroundBlur = "blur-2xl",
}: {
  src: string;
  fit?: "contain" | "cover";
  backgroundBlur?: "blur-xl" | "blur-2xl";
}) {
  return (
    <>
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 1280px) 33vw, 100vw"
        className={`z-0 scale-110 object-cover ${backgroundBlur} opacity-85`}
        loading="lazy"
        unoptimized
      />
      <div className="absolute inset-0 z-10 bg-black/35" aria-hidden="true" />
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 1280px) 33vw, 100vw"
        className={`z-20 object-${fit}`}
        loading="lazy"
        unoptimized
      />
    </>
  );
}
