#!/usr/bin/env bash
set -euo pipefail

HIGGSFIELD_BIN="${HIGGSFIELD_BIN:-/Users/macbookair/.local/bin/higgsfield}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_ROOT="${OUTPUT_ROOT:-$REPO_ROOT/public/graceward-motion/v1}"
MAX_PARALLEL="${MAX_PARALLEL:-8}"

species_reference() {
  case "$1" in
    lion) printf '%s/src/assets/companions/symbolic/lion.webp' "$REPO_ROOT" ;;
    dove) printf '%s/src/assets/companions/symbolic/dove.webp' "$REPO_ROOT" ;;
    *) return 1 ;;
  esac
}

species_direction() {
  case "$1" in
    lion)
      printf '%s' "The same adult golden lion remains centered on the same round stone pedestal. Preserve its exact face, mane, four-legged anatomy, proportions, golden palette, and painted storybook rendering."
      ;;
    dove)
      printf '%s' "The same white dove remains centered on the same round stone pedestal. Preserve its exact face, beak, two-wing two-leg anatomy, proportions, white plumage, and painted storybook rendering."
      ;;
    *) return 1 ;;
  esac
}

element_direction() {
  case "$1" in
    light)
      printf '%s' "Dawn-gold light responds with restrained halo rays and a few warm luminous dust motes."
      ;;
    nature)
      printf '%s' "Living-green energy responds with restrained leaf motes, soft moss light, and one or two delicate curling vines around the pedestal."
      ;;
    *) return 1 ;;
  esac
}

activity_direction() {
  local species="$1"
  local asset="$2"

  case "$asset" in
    mind-1)
      if [[ "$species" == "lion" ]]; then
        printf '%s' "A small open book made of warm ivory light gently appears between its front paws. The lion lowers its gaze, studies the glowing pages with calm intelligence, then raises its eyes with quiet understanding. End perfectly still, calmly guarding the open book."
      else
        printf '%s' "A small open book made of warm ivory light gently appears on the pedestal. The dove steps closer, studies the glowing pages with alert curiosity, then lifts its head with quiet understanding. End perfectly still beside the open book."
      fi
      ;;
    mind-2)
      if [[ "$species" == "lion" ]]; then
        printf '%s' "Three small points of light form a gentle visual puzzle above the pedestal. The lion tracks them thoughtfully, nudges the center light into place with one paw, and watches the pattern resolve. End perfectly still with the ordered lights hovering nearby."
      else
        printf '%s' "Three small points of light form a gentle visual puzzle above the pedestal. The dove studies them, taps the center light into place with its beak, and watches the pattern resolve. End perfectly still with the ordered lights hovering nearby."
      fi
      ;;
    mind-3)
      if [[ "$species" == "lion" ]]; then
        printf '%s' "A ribbon of soft light traces a slow path around the lion. It follows the path with focused eyes, breathes calmly, and settles into attentive stillness. End perfectly still with one small light resting near its front paws."
      else
        printf '%s' "A ribbon of soft light traces a slow path around the dove. It follows the path with focused eyes and a precise turn of the head, then settles into attentive stillness. End perfectly still with one small light resting near its feet."
      fi
      ;;
    body-1)
      if [[ "$species" == "lion" ]]; then
        printf '%s' "The lion performs a natural full-body feline stretch: front paws forward, shoulders lowering, back lengthening, then it rises into a strong balanced stance. End perfectly still in that healthy grounded stance."
      else
        printf '%s' "The dove performs a natural wing-and-body stretch, opening both wings evenly, lifting its chest, then folding its wings into a healthy balanced stance. End perfectly still in that refreshed posture."
      fi
      ;;
    body-2)
      if [[ "$species" == "lion" ]]; then
        printf '%s' "The lion takes two energetic controlled steps around the pedestal, gives one light athletic bound, and lands safely where it began. End perfectly still in a confident ready stance."
      else
        printf '%s' "The dove lifts into a short controlled hover above the pedestal with two strong wingbeats, turns once, and lands safely where it began. End perfectly still in a confident ready stance."
      fi
      ;;
    body-3)
      if [[ "$species" == "lion" ]]; then
        printf '%s' "A small clear spring-water bowl appears on the pedestal. The lion lowers its head, takes a refreshing drink, lifts its head with one subtle satisfied breath, and settles. End perfectly still beside the water."
      else
        printf '%s' "A small clear spring-water bowl appears on the pedestal. The dove steps to it, takes a refreshing sip, lifts its head with one subtle bright flutter, and settles. End perfectly still beside the water."
      fi
      ;;
    soul-1)
      if [[ "$species" == "lion" ]]; then
        printf '%s' "The lion slowly bows its head in a peaceful posture of prayer and reverence. A gentle light gathers without forming text or symbols. It lifts its head calmly. End perfectly still in quiet peace."
      else
        printf '%s' "The dove gently lowers its head and folds its wings close in a peaceful posture of prayer and reverence. A gentle light gathers without forming text or symbols. It lifts its head calmly. End perfectly still in quiet peace."
      fi
      ;;
    soul-2)
      if [[ "$species" == "lion" ]]; then
        printf '%s' "A warm shaft of light opens through the forest canopy. The lion looks upward in humble awe, mane moving softly in the breeze, then returns its gaze forward with peace. End perfectly still within the warm light."
      else
        printf '%s' "A warm shaft of light opens through the forest canopy. The dove looks upward in humble awe, wings opening slightly in the breeze, then returns its gaze forward with peace. End perfectly still within the warm light."
      fi
      ;;
    soul-3)
      if [[ "$species" == "lion" ]]; then
        printf '%s' "A small fragile green shoot emerges beside one paw. The lion notices it and gently shields it with its body as it grows one new leaf. End perfectly still in a caring protective pose beside the shoot."
      else
        printf '%s' "A small fragile green shoot emerges beside its feet. The dove notices it and gently shelters it beneath one opened wing as it grows one new leaf. End perfectly still in a caring protective pose beside the shoot."
      fi
      ;;
    reaction-encourage)
      if [[ "$species" == "lion" ]]; then
        printf '%s' "The lion notices the viewer, softens its expression, gives one steady encouraging nod, and places one front paw forward as if inviting the next step. End perfectly still in the supportive pose."
      else
        printf '%s' "The dove notices the viewer, gives one warm encouraging head tilt and a small hopeful wing lift as if inviting the next step. End perfectly still in the supportive pose."
      fi
      ;;
    reaction-celebrate)
      if [[ "$species" == "lion" ]]; then
        printf '%s' "The lion gives one joyful controlled upward bound as a restrained burst of light circles the pedestal, lands cleanly, and lifts its head with proud warmth. End perfectly still in the victorious pose."
      else
        printf '%s' "The dove gives one joyful upward flutter as a restrained burst of light circles the pedestal, lands cleanly, and lifts its wings with bright warmth. End perfectly still in the victorious pose."
      fi
      ;;
    reaction-rest)
      if [[ "$species" == "lion" ]]; then
        printf '%s' "The lion turns once naturally, lowers itself onto the pedestal, rests its head on its front paws, and gives one calm sleepy blink. End perfectly still in the cozy resting pose."
      else
        printf '%s' "The dove fluffs its feathers once, tucks its head gently toward one wing, and gives one calm sleepy blink. End perfectly still in the cozy resting pose."
      fi
      ;;
    *) return 1 ;;
  esac
}

generate_one() {
  local species="$1"
  local element="$2"
  local asset="$3"
  local output_dir="$OUTPUT_ROOT/$species/$element"
  local output_video="$output_dir/$asset.mp4"
  local output_still="$output_dir/$asset.jpg"
  local reference
  local prompt
  local generation_output
  local result_url

  if [[ -s "$output_video" && -s "$output_still" ]]; then
    printf 'skip %s/%s/%s\n' "$species" "$element" "$asset"
    return 0
  fi

  if [[ -s "$output_video" ]]; then
    mkdir -p "$output_dir"
    ffmpeg -hide_banner -loglevel error -y -sseof -0.10 -i "$output_video" \
      -frames:v 1 -q:v 2 "$output_still.tmp.jpg"
    mv "$output_still.tmp.jpg" "$output_still"
    printf 'still %s/%s/%s\n' "$species" "$element" "$asset"
    return 0
  fi

  reference="$(species_reference "$species")"
  prompt="Use the supplied image as the exact character, environment, composition, and painted illustration style reference. Five-second square companion interaction. $(species_direction "$species") $(activity_direction "$species" "$asset") $(element_direction "$element") Fixed camera, single continuous shot, subtle natural secondary motion only. Keep the original sunlit forest and stone pedestal. No text, no letters, no logos, no humans, no extra animals, no duplicate limbs, no anatomy changes, no morphing, no camera movement, no cuts, and no audio."

  mkdir -p "$output_dir"
  printf 'generate %s/%s/%s\n' "$species" "$element" "$asset"
  generation_output="$($HIGGSFIELD_BIN generate create seedance_2_0 \
    --prompt "$prompt" \
    --start-image "$reference" \
    --mode fast \
    --duration 5 \
    --aspect_ratio 1:1 \
    --resolution 720p \
    --generate_audio false \
    --wait \
    --wait-timeout 20m \
    --wait-interval 5s)"
  result_url="$(printf '%s\n' "$generation_output" | grep -Eo 'https://[^[:space:]]+\.mp4' | tail -1)"
  if [[ -z "$result_url" ]]; then
    printf 'No result URL for %s/%s/%s\n' "$species" "$element" "$asset" >&2
    return 1
  fi

  curl --fail --location --silent --show-error --retry 3 "$result_url" -o "$output_video.tmp"
  mv "$output_video.tmp" "$output_video"
  ffmpeg -hide_banner -loglevel error -y -sseof -0.10 -i "$output_video" \
    -frames:v 1 -q:v 2 "$output_still.tmp.jpg"
  mv "$output_still.tmp.jpg" "$output_still"
  printf 'done %s/%s/%s\n' "$species" "$element" "$asset"
}

if [[ "${1:-}" == "--generate-one" ]]; then
  generate_one "$2" "$3" "$4"
  exit 0
fi

assets=(
  mind-1 mind-2 mind-3
  body-1 body-2 body-3
  soul-1 soul-2 soul-3
  reaction-encourage reaction-celebrate reaction-rest
)

task_args=()
for species in lion dove; do
  for element in light nature; do
    for asset in "${assets[@]}"; do
      task_args+=("$species" "$element" "$asset")
    done
  done
done

printf '%s\0' "${task_args[@]}" \
  | xargs -0 -n 3 -P "$MAX_PARALLEL" "$0" --generate-one

printf 'Graceward motion pack complete: %s\n' "$OUTPUT_ROOT"
