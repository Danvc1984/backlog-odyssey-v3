import Image from "next/image";

export function ArtworkBackdrop({ src }: { src: string }) {
  return (
    <>
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 1280px) 33vw, 100vw"
        className="z-0 scale-110 object-cover blur-2xl opacity-85"
        loading="lazy"
        unoptimized
      />
      <div className="absolute inset-0 z-10 bg-black/35" aria-hidden="true" />
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 1280px) 33vw, 100vw"
        className="z-20 object-contain"
        loading="lazy"
        unoptimized
      />
    </>
  );
}
