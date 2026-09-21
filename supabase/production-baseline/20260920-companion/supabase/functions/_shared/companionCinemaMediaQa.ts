export interface CompanionCinemaMediaQaResult {
  containerValid: boolean;
  videoTrackPresent: boolean;
  audioTrackPresent: boolean;
  audioExpected: boolean;
  durationSeconds: number | null;
  expectedDurationSeconds: number;
  durationWithinTolerance: boolean;
  fileSizeBytes: number;
  brands: string[];
  errors: string[];
}

interface IsoBox {
  type: string;
  start: number;
  dataStart: number;
  end: number;
}

const CONTAINER_BOX_TYPES = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "dinf",
  "udta",
  "meta",
]);

const readAscii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.slice(start, start + length));

const readUint64 = (view: DataView, offset: number): number => {
  const high = view.getUint32(offset);
  const low = view.getUint32(offset + 4);
  return high * 2 ** 32 + low;
};

const scanIsoBoxes = (
  bytes: Uint8Array,
  start = 0,
  end = bytes.byteLength,
  depth = 0,
): IsoBox[] => {
  if (depth > 8) return [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxes: IsoBox[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset);
    const type = readAscii(bytes, offset + 4, 4);
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      size = readUint64(view, offset + 8);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (
      !Number.isSafeInteger(size) || size < headerSize || offset + size > end
    ) {
      break;
    }
    const box = {
      type,
      start: offset,
      dataStart: offset + headerSize,
      end: offset + size,
    };
    boxes.push(box);
    if (CONTAINER_BOX_TYPES.has(type)) {
      const childStart = type === "meta" ? box.dataStart + 4 : box.dataStart;
      boxes.push(...scanIsoBoxes(bytes, childStart, box.end, depth + 1));
    }
    offset += size;
  }
  return boxes;
};

const readMovieDurationSeconds = (
  bytes: Uint8Array,
  movieHeader: IsoBox | undefined,
): number | null => {
  if (!movieHeader) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const payload = movieHeader.dataStart;
  if (payload + 20 > movieHeader.end) return null;
  const version = view.getUint8(payload);
  const timescaleOffset = version === 1 ? payload + 20 : payload + 12;
  const durationOffset = version === 1 ? payload + 24 : payload + 16;
  const durationBytes = version === 1 ? 8 : 4;
  if (durationOffset + durationBytes > movieHeader.end) return null;
  const timescale = view.getUint32(timescaleOffset);
  const duration = version === 1
    ? readUint64(view, durationOffset)
    : view.getUint32(durationOffset);
  return timescale > 0 && Number.isFinite(duration)
    ? duration / timescale
    : null;
};

const readBrands = (bytes: Uint8Array, ftyp: IsoBox | undefined): string[] => {
  if (!ftyp || ftyp.dataStart + 8 > ftyp.end) return [];
  const brands = [readAscii(bytes, ftyp.dataStart, 4)];
  for (let offset = ftyp.dataStart + 8; offset + 4 <= ftyp.end; offset += 4) {
    brands.push(readAscii(bytes, offset, 4));
  }
  return [...new Set(brands.filter((brand) => /^[\x20-\x7e]{4}$/.test(brand)))];
};

export const inspectCompanionCinemaMp4 = ({
  bytes,
  expectedDurationSeconds,
  audioExpected,
}: {
  bytes: Uint8Array;
  expectedDurationSeconds: number;
  audioExpected: boolean;
}): CompanionCinemaMediaQaResult => {
  const boxes = scanIsoBoxes(bytes);
  const ftyp = boxes.find((box) => box.type === "ftyp");
  const moov = boxes.find((box) => box.type === "moov");
  const mdat = boxes.find((box) => box.type === "mdat");
  const handlers = boxes
    .filter((box) => box.type === "hdlr" && box.dataStart + 12 <= box.end)
    .map((box) => readAscii(bytes, box.dataStart + 8, 4));
  const durationSeconds = readMovieDurationSeconds(
    bytes,
    boxes.find((box) => box.type === "mvhd"),
  );
  const tolerance = Math.max(2, expectedDurationSeconds * 0.35);
  const durationWithinTolerance = durationSeconds !== null &&
    Math.abs(durationSeconds - expectedDurationSeconds) <= tolerance;
  const videoTrackPresent = handlers.includes("vide");
  const audioTrackPresent = handlers.includes("soun");
  const errors: string[] = [];
  if (bytes.byteLength < 1024) errors.push("file_too_small");
  if (!ftyp) errors.push("missing_ftyp");
  if (!moov) errors.push("missing_moov");
  if (!mdat) errors.push("missing_mdat");
  if (!videoTrackPresent) errors.push("missing_video_track");
  if (audioExpected && !audioTrackPresent) errors.push("missing_audio_track");
  if (!durationWithinTolerance) errors.push("duration_out_of_tolerance");

  return {
    containerValid: Boolean(ftyp && moov && mdat && bytes.byteLength >= 1024),
    videoTrackPresent,
    audioTrackPresent,
    audioExpected,
    durationSeconds,
    expectedDurationSeconds,
    durationWithinTolerance,
    fileSizeBytes: bytes.byteLength,
    brands: readBrands(bytes, ftyp),
    errors,
  };
};

export const assertCompanionCinemaMediaQa = (
  result: CompanionCinemaMediaQaResult,
): void => {
  if (result.errors.length > 0) {
    throw new Error(`cinema_media_qa_failed:${result.errors.join(",")}`);
  }
};
