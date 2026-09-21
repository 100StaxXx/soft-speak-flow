#!/usr/bin/env bash
set -euo pipefail

HIGGSFIELD_BIN="${HIGGSFIELD_BIN:-/Users/macbookair/.local/bin/higgsfield}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_ROOT="${OUTPUT_ROOT:-$REPO_ROOT/output/companion-premade}"
MAX_PARALLEL="${MAX_PARALLEL:-4}"
DRY_RUN="${DRY_RUN:-0}"
SPECIES_FILTER="${SPECIES_FILTER:-lamb wolf lion stag dove eagle}"
ELEMENT_FILTER="${ELEMENT_FILTER:-fire ice storm nature void light}"

species_reference() {
  printf '%s/src/assets/companions/symbolic/%s.webp' "$REPO_ROOT" "$1"
}

species_identity() {
  case "$1" in
    lamb) printf '%s' "the same gentle lamb, with its exact face, ears, wool pattern, four-legged anatomy, and proportions" ;;
    lion) printf '%s' "the same golden lion, with its exact face, mane identity, four-legged anatomy, and proportions" ;;
    stag) printf '%s' "the same noble stag, with its exact face, antler identity, four-legged anatomy, and proportions" ;;
    dove) printf '%s' "the same white dove, with its exact face, beak, plumage, two wings, two legs, and proportions" ;;
    eagle) printf '%s' "the same eagle, with its exact face, beak, plumage, two wings, two legs, and proportions" ;;
    wolf) printf '%s' "the same wolf, with its exact face, ears, coat markings, four-legged anatomy, and proportions" ;;
    *) return 1 ;;
  esac
}

element_direction() {
  case "$1" in
    fire) printf '%s' "Warm ember-gold energy, restrained flame-shaped light, and subtle copper highlights express the Fire element without touching or obscuring the companion." ;;
    ice) printf '%s' "Clear blue-white crystalline light, a few delicate frost motes, and cool silver highlights express the Ice element without covering the companion." ;;
    storm) printf '%s' "Deep blue-violet atmosphere, restrained arcs of distant light, and wind-touched particles express the Storm element without frightening or obscuring the companion." ;;
    nature) printf '%s' "Living-green light, a few leaf motes, moss highlights, and delicate curling vines express the Nature element without covering the companion." ;;
    void) printf '%s' "Midnight indigo light, sparse star-like motes, and a restrained cosmic halo express the Void element without turning the scene dark or sinister." ;;
    light) printf '%s' "Dawn-gold light, restrained halo rays, and a few warm luminous dust motes express the Light element without obscuring the companion." ;;
    *) return 1 ;;
  esac
}

stage_direction() {
  case "$1" in
    1) printf '%s' "Render the Young Level 1 form: a newly hatched juvenile version of the reference character, smaller and visibly youthful but healthy, capable, and unmistakably the same individual." ;;
    5) printf '%s' "Render the Growing Level 5 form: the exact same individual as the supplied Young portrait, slightly taller and more developed, with calm new confidence. This is a meaningful early growth step, not an adult or final form." ;;
    *) return 1 ;;
  esac
}

activity_direction() {
  local species="$1"
  local asset="$2"
  local is_bird=0
  if [[ "$species" == "dove" || "$species" == "eagle" ]]; then
    is_bird=1
  fi

  case "$asset" in
    mind-1) printf '%s' "A small open book made of warm ivory light appears on the pedestal. The companion studies the pages with calm curiosity, then looks forward with quiet understanding." ;;
    mind-2)
      if [[ "$is_bird" == "1" ]]; then
        printf '%s' "Three small points of light form a gentle visual puzzle. The companion studies them, taps the center light into place with its beak, and watches the pattern resolve."
      else
        printf '%s' "Three small points of light form a gentle visual puzzle. The companion studies them, nudges the center light into place with one front paw, and watches the pattern resolve."
      fi
      ;;
    mind-3) printf '%s' "A ribbon of soft light traces a slow path around the companion. It follows the path with focused eyes, breathes calmly, and settles into attentive stillness." ;;
    body-1)
      if [[ "$is_bird" == "1" ]]; then
        printf '%s' "The companion performs a natural wing-and-body stretch, opening both wings evenly, lifting its chest, then folding its wings into a healthy balanced stance."
      else
        printf '%s' "The companion performs a natural full-body quadruped stretch, lengthens through the shoulders and back, then rises into a healthy balanced stance."
      fi
      ;;
    body-2)
      if [[ "$is_bird" == "1" ]]; then
        printf '%s' "The companion lifts into a short controlled hover with two strong wingbeats, turns once, and lands safely where it began."
      else
        printf '%s' "The companion takes two energetic controlled steps around the pedestal, gives one light athletic bound, and lands safely where it began."
      fi
      ;;
    body-3) printf '%s' "A small clear spring-water bowl appears. The companion takes a refreshing drink, lifts its head with one subtle satisfied breath, and settles." ;;
    soul-1) printf '%s' "The companion slowly bows its head in a peaceful posture of prayer and reverence. Gentle light gathers without forming text or symbols, then the companion lifts its head calmly." ;;
    soul-2) printf '%s' "A warm shaft of light opens through the forest canopy. The companion looks upward in humble awe, then returns its gaze forward with peace." ;;
    soul-3)
      if [[ "$is_bird" == "1" ]]; then
        printf '%s' "A fragile green shoot emerges nearby. The companion notices it and gently shelters it beneath one opened wing as it grows one new leaf."
      else
        printf '%s' "A fragile green shoot emerges beside one paw. The companion notices it and gently shields it with its body as it grows one new leaf."
      fi
      ;;
    *) return 1 ;;
  esac
}

extract_media_url() {
  local extension_pattern="$1"
  grep -Eo "https://[^[:space:]\"]+\.(${extension_pattern})(\?[^[:space:]\"]*)?" \
    | tail -1 \
    | tr -d '"'
}

generate_portrait() {
  local species="$1"
  local element="$2"
  local boundary_level="$3"
  local output_dir="$OUTPUT_ROOT/premade/v1/graceward/$species/$element/portraits"
  local output_image="$output_dir/level-$boundary_level.webp"
  local reference
  local prompt
  local generation_output
  local result_url

  if [[ -s "$output_image" ]]; then
    printf 'skip portrait %s/%s/level-%s\n' "$species" "$element" "$boundary_level"
    return 0
  fi

  if [[ "$boundary_level" == "1" ]]; then
    reference="$(species_reference "$species")"
  else
    reference="$output_dir/level-1.webp"
  fi

  prompt="Use the supplied image as the exact character identity and painted storybook style reference. Create a square Graceward companion portrait of $(species_identity "$species"). $(stage_direction "$boundary_level") $(element_direction "$element") Center the full companion on one round pale-stone pedestal in a serene sunlit forest clearing. Front three-quarter view, generous breathing room, warm premium mobile-game illustration, crisp subject, consistent camera and composition across stages. No text, letters, logos, humans, extra animals, duplicate limbs, anatomy errors, cropped anatomy, costumes, armor, or photorealism."

  if [[ "$DRY_RUN" == "1" ]]; then
    printf 'would generate portrait %s/%s/level-%s\n' "$species" "$element" "$boundary_level"
    return 0
  fi
  if [[ ! -s "$reference" ]]; then
    printf 'Missing portrait reference: %s\n' "$reference" >&2
    return 1
  fi

  mkdir -p "$output_dir"
  generation_output="$($HIGGSFIELD_BIN generate create gpt_image_2 \
    --prompt "$prompt" \
    --image "$reference" \
    --aspect_ratio 1:1 \
    --resolution 2k \
    --quality high \
    --wait \
    --wait-timeout 20m \
    --wait-interval 5s)"
  result_url="$(printf '%s\n' "$generation_output" | extract_media_url 'png|webp|jpg|jpeg')"
  if [[ -z "$result_url" ]]; then
    printf 'No image result URL for %s/%s/level-%s\n' "$species" "$element" "$boundary_level" >&2
    return 1
  fi

  curl --fail --location --silent --show-error --retry 3 "$result_url" -o "$output_image.source"
  node "$REPO_ROOT/scripts/convert-companion-portrait-to-webp.mjs" \
    "$output_image.source" "$output_image.tmp.webp"
  mv "$output_image.tmp.webp" "$output_image"
  rm "$output_image.source"
  printf 'done portrait %s/%s/level-%s\n' "$species" "$element" "$boundary_level"
}

generate_transition() {
  local species="$1"
  local element="$2"
  local boundary_level="$3"
  local previous_level=0
  local start_image
  local end_image="$OUTPUT_ROOT/premade/v1/graceward/$species/$element/portraits/level-$boundary_level.webp"
  local output_dir="$OUTPUT_ROOT/premade/v1/graceward/$species/$element/videos"
  local output_video
  local prompt
  local generation_output
  local result_url
  local reference_image
  local anchor_mode="exact"
  local -a generation_args

  if [[ "$boundary_level" == "1" ]]; then
    start_image="$REPO_ROOT/public/companion-eggs/v2/egg__t0_egg__normal__$element.webp"
  else
    previous_level=1
    start_image="$OUTPUT_ROOT/premade/v1/graceward/$species/$element/portraits/level-1.webp"
  fi
  output_video="$output_dir/level-$previous_level-to-$boundary_level.mp4"
  reference_image="$(species_reference "$species")"

  if [[ -s "$output_video" ]]; then
    if [[ ! -s "$end_image" ]]; then
      if [[ "$DRY_RUN" == "1" ]]; then
        printf 'would extract portrait %s/%s/level-%s\n' "$species" "$element" "$boundary_level"
      else
        mkdir -p "$(dirname "$end_image")"
        ffmpeg -hide_banner -loglevel error -y -sseof -0.10 -i "$output_video" \
          -frames:v 1 "$end_image.source.png"
        node "$REPO_ROOT/scripts/convert-companion-portrait-to-webp.mjs" \
          "$end_image.source.png" "$end_image.tmp.webp"
        mv "$end_image.tmp.webp" "$end_image"
        rm "$end_image.source.png"
        printf 'done portrait extraction %s/%s/level-%s\n' "$species" "$element" "$boundary_level"
      fi
    fi
    printf 'skip transition %s/%s/%s-to-%s\n' "$species" "$element" "$previous_level" "$boundary_level"
    return 0
  fi
  if [[ -s "$end_image" && "$boundary_level" == "1" ]]; then
    prompt="Five-second square Graceward hatch reveal. The supplied elemental egg is the exact first frame and the supplied Young companion portrait is the exact final frame. The egg glows, opens in a gentle burst of $(element_direction "$element"), and reveals $(species_identity "$species") on the same centered pedestal. Smooth magical continuity, one fixed camera, one continuous shot, restrained particles. Finish perfectly aligned to the supplied final portrait. No text, logos, humans, extra animals, anatomy changes, cuts, camera movement, or audio."
  elif [[ -s "$end_image" ]]; then
    prompt="Five-second square Graceward early evolution. The supplied Young portrait is the exact first frame and the supplied Growing portrait is the exact final frame. $(species_identity "$species") is surrounded by $(element_direction "$element") and grows naturally into the slightly older Level 5 form without changing identity or anatomy. One fixed camera, one continuous shot, restrained particles. Finish perfectly aligned to the supplied final portrait. No text, logos, humans, extra animals, morphing artifacts, cuts, camera movement, or audio."
  elif [[ "$boundary_level" == "1" ]]; then
    anchor_mode="extract"
    prompt="Five-second square Graceward hatch reveal. The supplied elemental egg is the exact first frame. Use the separate supplied species image as the exact identity, facial design, proportions, illustrated linework, and painted storybook style reference for $(species_identity "$species"). The egg glows and opens in a gentle burst of $(element_direction "$element"), revealing the Young Level 1 form: newly hatched, smaller and visibly youthful but healthy and capable. Preserve the supplied premium mobile-game illustration style throughout; never become photorealistic. The shell dissolves completely into elemental light before the reveal ends; no shell, shards, fragments, or debris remain in the final composition. End in a clean, still, full-body portrait on one centered round pale-stone pedestal in the same serene forest, front three-quarter view with generous breathing room. One fixed camera, one continuous shot, restrained particles. Hold the final portrait pose. No text, logos, humans, extra animals, anatomy changes, cuts, camera movement, or audio."
  else
    anchor_mode="extract"
    prompt="Five-second square Graceward early evolution. The supplied Young portrait is the exact first frame and the separate supplied species image is the identity and illustrated-style reference. Preserve $(species_identity "$species") while $(element_direction "$element") surrounds the companion and it grows naturally into the slightly taller, more developed Growing Level 5 form. Preserve the illustrated linework and premium painted mobile-game rendering; never become photorealistic. This is a meaningful early growth step, not an adult or final form. End in a clean, still, full-body portrait on the same centered pedestal with the same forest, camera, composition, markings, and elemental styling. One continuous shot, restrained particles. Hold the final portrait pose. No text, logos, humans, extra animals, morphing artifacts, cuts, camera movement, or audio."
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    printf 'would generate transition %s/%s/%s-to-%s portrait-anchor=%s\n' "$species" "$element" "$previous_level" "$boundary_level" "$anchor_mode"
    return 0
  fi
  if [[ ! -s "$start_image" || ! -s "$reference_image" ]]; then
    printf 'Missing transition input for %s/%s/%s-to-%s\n' "$species" "$element" "$previous_level" "$boundary_level" >&2
    return 1
  fi

  mkdir -p "$output_dir"
  generation_args=(generate create seedance_2_0
    --prompt "$prompt" \
    --start-image "$start_image" \
    --mode fast \
    --duration 5 \
    --aspect_ratio 1:1 \
    --resolution 720p \
    --generate_audio false \
    --wait \
    --wait-timeout 20m \
    --wait-interval 5s)
  if [[ "$anchor_mode" == "exact" ]]; then
    generation_args+=(--end-image "$end_image")
  else
    generation_args+=(--image "$reference_image")
  fi
  generation_output="$($HIGGSFIELD_BIN "${generation_args[@]}")"
  result_url="$(printf '%s\n' "$generation_output" | extract_media_url 'mp4')"
  if [[ -z "$result_url" ]]; then
    printf 'No transition result URL for %s/%s/%s-to-%s\n' "$species" "$element" "$previous_level" "$boundary_level" >&2
    return 1
  fi

  curl --fail --location --silent --show-error --retry 3 "$result_url" -o "$output_video.tmp"
  mv "$output_video.tmp" "$output_video"
  if [[ "$anchor_mode" == "extract" ]]; then
    mkdir -p "$(dirname "$end_image")"
    ffmpeg -hide_banner -loglevel error -y -sseof -0.10 -i "$output_video" \
      -frames:v 1 "$end_image.source.png"
    node "$REPO_ROOT/scripts/convert-companion-portrait-to-webp.mjs" \
      "$end_image.source.png" "$end_image.tmp.webp"
    mv "$end_image.tmp.webp" "$end_image"
    rm "$end_image.source.png"
    printf 'done portrait extraction %s/%s/level-%s\n' "$species" "$element" "$boundary_level"
  fi
  printf 'done transition %s/%s/%s-to-%s\n' "$species" "$element" "$previous_level" "$boundary_level"
}

generate_formation() {
  local species="$1"
  local element="$2"
  local boundary_level="$3"
  local asset="$4"
  local portrait="$OUTPUT_ROOT/premade/v1/graceward/$species/$element/portraits/level-$boundary_level.webp"
  local output_dir="$OUTPUT_ROOT/premade/v1/graceward/$species/$element/formation/level-$boundary_level"
  local output_video="$output_dir/$asset.mp4"
  local output_still="$output_dir/$asset.jpg"
  local prompt
  local generation_output
  local result_url

  if [[ -s "$output_video" && -s "$output_still" ]]; then
    printf 'skip formation %s/%s/level-%s/%s\n' "$species" "$element" "$boundary_level" "$asset"
    return 0
  fi
  if [[ -s "$output_video" ]]; then
    mkdir -p "$output_dir"
    ffmpeg -hide_banner -loglevel error -y -sseof -0.10 -i "$output_video" \
      -frames:v 1 -q:v 2 "$output_still.tmp.jpg"
    mv "$output_still.tmp.jpg" "$output_still"
    printf 'done formation still %s/%s/level-%s/%s\n' "$species" "$element" "$boundary_level" "$asset"
    return 0
  fi

  prompt="Use the supplied portrait as both the exact first frame and exact final frame of a five-second square Graceward companion interaction. Preserve $(species_identity "$species"), including the exact Level $boundary_level age, face, markings, anatomy, elemental styling, pedestal, forest, camera, and painted storybook rendering. $(activity_direction "$species" "$asset") $(element_direction "$element") Return naturally to the supplied resting pose for the final frame. Single continuous shot, fixed camera, subtle secondary motion. No text, letters, logos, humans, extra animals, duplicate limbs, anatomy changes, age changes, morphing, cuts, camera movement, or audio."

  if [[ "$DRY_RUN" == "1" ]]; then
    printf 'would generate formation %s/%s/level-%s/%s\n' "$species" "$element" "$boundary_level" "$asset"
    return 0
  fi
  if [[ ! -s "$portrait" ]]; then
    printf 'Missing formation portrait: %s\n' "$portrait" >&2
    return 1
  fi

  mkdir -p "$output_dir"
  generation_output="$($HIGGSFIELD_BIN generate create seedance_2_0 \
    --prompt "$prompt" \
    --start-image "$portrait" \
    --end-image "$portrait" \
    --mode fast \
    --duration 5 \
    --aspect_ratio 1:1 \
    --resolution 720p \
    --generate_audio false \
    --wait \
    --wait-timeout 20m \
    --wait-interval 5s)"
  result_url="$(printf '%s\n' "$generation_output" | extract_media_url 'mp4')"
  if [[ -z "$result_url" ]]; then
    printf 'No formation result URL for %s/%s/level-%s/%s\n' "$species" "$element" "$boundary_level" "$asset" >&2
    return 1
  fi

  curl --fail --location --silent --show-error --retry 3 "$result_url" -o "$output_video.tmp"
  mv "$output_video.tmp" "$output_video"
  ffmpeg -hide_banner -loglevel error -y -sseof -0.10 -i "$output_video" \
    -frames:v 1 -q:v 2 "$output_still.tmp.jpg"
  mv "$output_still.tmp.jpg" "$output_still"
  printf 'done formation %s/%s/level-%s/%s\n' "$species" "$element" "$boundary_level" "$asset"
}

generate_combination() {
  local species="$1"
  local element="$2"
  local boundary_level
  local asset

  for boundary_level in 1 5; do
    generate_transition "$species" "$element" "$boundary_level"
  done
  for boundary_level in 1 5; do
    for asset in mind-1 mind-2 mind-3 body-1 body-2 body-3 soul-1 soul-2 soul-3; do
      generate_formation "$species" "$element" "$boundary_level" "$asset"
    done
  done
}

if [[ "${1:-}" == "--generate-combination" ]]; then
  generate_combination "$2" "$3"
  exit 0
fi

if [[ "${1:-}" == "--generate-transition" ]]; then
  generate_transition "$2" "$3" "$4"
  exit 0
fi

if [[ "${1:-}" == "--generate-formation" ]]; then
  generate_formation "$2" "$3" "$4" "$5"
  exit 0
fi

if [[ ! -x "$HIGGSFIELD_BIN" && "$DRY_RUN" != "1" ]]; then
  printf 'Higgsfield CLI is not executable at %s\n' "$HIGGSFIELD_BIN" >&2
  exit 1
fi

combination_args=()
for species in $SPECIES_FILTER; do
  for element in $ELEMENT_FILTER; do
    combination_args+=("$species" "$element")
  done
done

# Finish the reusable evolution chain for every combination before spending
# queue capacity on optional interaction variants. This gives every selectable
# companion a hatch and Level 5 form as early as possible in a resumable run.
for boundary_level in 1 5; do
  transition_args=()
  for ((combination_index = 0; combination_index < ${#combination_args[@]}; combination_index += 2)); do
    transition_args+=(
      "${combination_args[$combination_index]}"
      "${combination_args[$((combination_index + 1))]}"
      "$boundary_level"
    )
  done
  printf '%s\0' "${transition_args[@]}" \
    | xargs -0 -n 3 -P "$MAX_PARALLEL" env \
        HIGGSFIELD_BIN="$HIGGSFIELD_BIN" \
        OUTPUT_ROOT="$OUTPUT_ROOT" \
        DRY_RUN="$DRY_RUN" \
        "$0" --generate-transition
done

# Spread coverage across Mind, Body, and Soul before producing alternates.
for asset in mind-1 body-1 soul-1 mind-2 body-2 soul-2 mind-3 body-3 soul-3; do
  for boundary_level in 1 5; do
    formation_args=()
    for ((combination_index = 0; combination_index < ${#combination_args[@]}; combination_index += 2)); do
      formation_args+=(
        "${combination_args[$combination_index]}"
        "${combination_args[$((combination_index + 1))]}"
        "$boundary_level"
        "$asset"
      )
    done
    printf '%s\0' "${formation_args[@]}" \
      | xargs -0 -n 4 -P "$MAX_PARALLEL" env \
          HIGGSFIELD_BIN="$HIGGSFIELD_BIN" \
          OUTPUT_ROOT="$OUTPUT_ROOT" \
          DRY_RUN="$DRY_RUN" \
          "$0" --generate-formation
  done
done

printf 'Graceward complete Level 1–5 pack complete: %s\n' "$OUTPUT_ROOT"
