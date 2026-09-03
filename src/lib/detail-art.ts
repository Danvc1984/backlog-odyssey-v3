export type DetailArtKind = "artwork" | "gradient" | "token";

export interface DetailArtDecision {
  kind: DetailArtKind;
  imageUrl: string | null;
}

export function resolveDetailArt({
  metadataImage,
  reducedData,
}: {
  metadataImage: string | null;
  reducedData: boolean;
}): DetailArtDecision {
  if (reducedData) return { kind: "token", imageUrl: null };
  const image = metadataImage?.trim();
  if (!image) return { kind: "gradient", imageUrl: null };
  return { kind: "artwork", imageUrl: image };
}