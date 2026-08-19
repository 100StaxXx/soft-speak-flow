import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  assertCompanionCinemaMediaQa,
  inspectCompanionCinemaMp4,
} from "./companionCinemaMediaQa.ts";

const ascii = (value: string) => new TextEncoder().encode(value);
const uint32 = (value: number) =>
  new Uint8Array([
    value >>> 24,
    value >>> 16 & 0xff,
    value >>> 8 & 0xff,
    value & 0xff,
  ]);
const join = (...parts: Uint8Array[]) => {
  const output = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};
const box = (type: string, payload: Uint8Array) =>
  join(uint32(payload.length + 8), ascii(type), payload);
const handler = (type: "vide" | "soun") =>
  box("hdlr", join(new Uint8Array(8), ascii(type), new Uint8Array(4)));

const syntheticMp4 = ({ audio = true, duration = 12 } = {}) => {
  const mvhd = box(
    "mvhd",
    join(
      new Uint8Array(12),
      uint32(1_000),
      uint32(duration * 1_000),
      new Uint8Array(16),
    ),
  );
  const videoTrack = box("trak", box("mdia", handler("vide")));
  const audioTrack = audio
    ? box("trak", box("mdia", handler("soun")))
    : new Uint8Array();
  const mp4 = join(
    box("ftyp", join(ascii("isom"), uint32(0), ascii("isom"), ascii("mp42"))),
    box("moov", join(mvhd, videoTrack, audioTrack)),
    box("mdat", new Uint8Array(1_024)),
  );
  return mp4;
};

Deno.test("media QA accepts an MP4 with video, audio, and matching duration", () => {
  const qa = inspectCompanionCinemaMp4({
    bytes: syntheticMp4(),
    expectedDurationSeconds: 12,
    audioExpected: true,
  });
  assertEquals(qa.errors, []);
  assertEquals(qa.videoTrackPresent, true);
  assertEquals(qa.audioTrackPresent, true);
  assertEquals(qa.durationSeconds, 12);
  assertCompanionCinemaMediaQa(qa);
});

Deno.test("media QA rejects missing native audio and a bad duration", () => {
  const qa = inspectCompanionCinemaMp4({
    bytes: syntheticMp4({ audio: false, duration: 2 }),
    expectedDurationSeconds: 12,
    audioExpected: true,
  });
  assertEquals(qa.errors.includes("missing_audio_track"), true);
  assertEquals(qa.errors.includes("duration_out_of_tolerance"), true);
  assertThrows(() => assertCompanionCinemaMediaQa(qa));
});

Deno.test("media QA rejects arbitrary bytes instead of trusting file size", () => {
  const qa = inspectCompanionCinemaMp4({
    bytes: new Uint8Array(2_048),
    expectedDurationSeconds: 12,
    audioExpected: false,
  });
  assertEquals(qa.containerValid, false);
  assertThrows(() => assertCompanionCinemaMediaQa(qa));
});
