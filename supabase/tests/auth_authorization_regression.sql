begin;

create or replace function public.test_assert(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception '%', p_message;
  end if;
end;
$$;

create or replace function public.test_try_insert_storage_object(
  p_object_id uuid,
  p_bucket_id text,
  p_name text,
  p_owner uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns text
language plpgsql
as $$
begin
  insert into storage.objects (
    id,
    bucket_id,
    name,
    owner,
    owner_id,
    metadata,
    user_metadata,
    version,
    created_at,
    updated_at,
    last_accessed_at
  )
  values (
    p_object_id,
    p_bucket_id,
    p_name,
    p_owner,
    p_owner::text,
    coalesce(p_metadata, '{}'::jsonb),
    '{}'::jsonb,
    '1',
    now(),
    now(),
    now()
  );

  return null;
exception
  when others then
    return sqlerrm;
end;
$$;

do $$
declare
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b uuid := '22222222-2222-2222-2222-222222222222';
  v_user_c uuid := '99999999-9999-9999-9999-999999999999';
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_a,
      'authenticated',
      'authenticated',
      'user-a@example.com',
      crypt('password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_b,
      'authenticated',
      'authenticated',
      'user-b@example.com',
      crypt('password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_c,
      'authenticated',
      'authenticated',
      'user-c@example.com',
      crypt('password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
  on conflict (id) do nothing;

  update public.profiles
  set
    referred_by = null,
    referred_by_code = null,
    streak_freezes_available = 1,
    life_status = 'alive'
  where id in (v_user_a, v_user_b, v_user_c);

  insert into public.account_entitlements (
    user_id,
    source,
    status,
    plan,
    is_active
  )
  values
    (v_user_a, 'subscription', 'active', 'monthly', false),
    (v_user_b, 'none', 'inactive', null, false),
    (v_user_c, 'none', 'inactive', null, false)
  on conflict (user_id) do update
  set
    source = excluded.source,
    status = excluded.status,
    plan = excluded.plan,
    is_active = excluded.is_active,
    updated_at = now();

  insert into public.user_companion (
    id,
    user_id,
    favorite_color,
    spirit_animal,
    core_element,
    story_tone,
    current_image_url
  )
  values
    (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      v_user_a,
      'blue',
      'fox',
      'water',
      'epic_adventure',
      'https://example.com/a.png'
    ),
    (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      v_user_b,
      'green',
      'owl',
      'earth',
      'epic_adventure',
      'https://example.com/b.png'
    )
  on conflict (user_id) do nothing;

  insert into public.referral_codes (
    id,
    code,
    owner_type,
    owner_user_id,
    is_active
  )
  values (
    '33333333-3333-3333-3333-333333333333',
    'USERA-CODE',
    'user',
    v_user_a,
    true
  )
  on conflict (code) do nothing;

  insert into public.epics (
    id,
    user_id,
    title,
    target_days,
    start_date,
    status
  )
  values (
    '66666666-6666-6666-6666-666666666661',
    v_user_a,
    'Security Fixture Epic',
    30,
    current_date,
    'active'
  )
  on conflict (id) do nothing;

  insert into public.evening_reflections (
    id,
    user_id,
    reflection_date,
    mood,
    wins,
    gratitude,
    mentor_response,
    additional_reflection,
    tomorrow_adjustment
  )
  values (
    '66666666-6666-6666-6666-666666666662',
    v_user_a,
    current_date,
    'calm',
    'Protected win',
    'Rest and support',
    'Server-authored reflection response',
    'Stayed steady',
    'Keep the boundary'
  )
  on conflict (id) do nothing;

  insert into public.weekly_recaps (
    id,
    user_id,
    week_start_date,
    week_end_date,
    win_highlights,
    stats,
    mentor_insight,
    mentor_story,
    viewed_at
  )
  values
    (
      '66666666-6666-6666-6666-666666666663',
      v_user_a,
      date '2026-03-16',
      date '2026-03-22',
      array['Protected weekly win'],
      '{"checkIns":2,"reflections":1,"quests":3,"habits":4}'::jsonb,
      'Server weekly insight',
      'Server weekly story',
      null
    ),
    (
      '66666666-6666-6666-6666-666666666664',
      v_user_b,
      date '2026-03-16',
      date '2026-03-22',
      array['Other user weekly win'],
      '{"checkIns":1,"reflections":1,"quests":1,"habits":1}'::jsonb,
      'Other user weekly insight',
      'Other user weekly story',
      null
    )
  on conflict (id) do nothing;

  insert into public.epic_journey_paths (
    id,
    epic_id,
    user_id,
    milestone_index,
    image_url,
    prompt_context,
    generated_at
  )
  values (
    '66666666-6666-6666-6666-666666666665',
    '66666666-6666-6666-6666-666666666661',
    v_user_a,
    0,
    'https://example.com/journey-path.png',
    '{}'::jsonb,
    now()
  )
  on conflict do nothing;

  if to_regclass('public.achievements') is not null then
    insert into public.achievements (
      id,
      user_id,
      achievement_type,
      title,
      description,
      icon,
      tier
    )
    values (
      '44444444-4444-4444-4444-444444444444',
      v_user_b,
      'test_achievement',
      'Test Achievement',
      'Fixture row',
      'star',
      'bronze'
    )
    on conflict do nothing;
  end if;

  if to_regclass('public.user_reflections') is not null then
    insert into public.user_reflections (
      id,
      user_id,
      reflection_date,
      mood,
      note
    )
    values (
      '55555555-5555-5555-5555-555555555555',
      v_user_b,
      current_date,
      'calm',
      'Fixture reflection'
    )
    on conflict do nothing;
  end if;
end
$$;

do $$
declare
  v_companion record;
  v_award record;
  v_preset_bound record;
  v_hatched record;
  v_stage0_count integer;
  v_stage1_count integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);

  select *
  into v_companion
  from public.create_companion_if_not_exists(
    '99999999-9999-9999-9999-999999999999',
    null,
    '#33cc66',
    'Egg',
    'nature',
    'epic_adventure',
    '/companion-eggs/egg__t0_egg__normal__nature.png',
    0.5,
    0.45,
    '/companion-eggs/egg__t0_egg__normal__nature.png',
    0.5,
    0.45,
    '',
    ''
  )
  limit 1;

  perform public.test_assert(
    coalesce(v_companion.current_stage, -1) = 0,
    'create_companion_if_not_exists should create only a stage 0 companion'
  );

  select count(*)
  into v_stage0_count
  from public.companion_evolutions
  where companion_id = v_companion.id
    and stage = 0;

  select count(*)
  into v_stage1_count
  from public.companion_evolutions
  where companion_id = v_companion.id
    and stage = 1;

  perform public.test_assert(
    v_stage0_count = 1,
    'create_companion_if_not_exists should create exactly one stage 0 evolution row'
  );

  perform public.test_assert(
    v_stage1_count = 0,
    'create_companion_if_not_exists must not create a stage 1 evolution row'
  );

  select *
  into v_award
  from public.award_xp_v2(
    'focus_session',
    10,
    '{}'::jsonb,
    'stage0-earned-progress'
  )
  limit 1;

  perform public.test_assert(
    coalesce(v_award.should_evolve, false),
    'pre-hatch XP at the level 1 threshold should mark the egg ready to hatch'
  );

  perform public.test_assert(
    coalesce(v_award.claimed_stage_after, -1) = 0,
    'pre-hatch XP must not claim stage 1'
  );

  perform public.test_assert(
    coalesce(v_award.pending_evolution_count, -1) = 1,
    'pre-hatch XP should report one pending evolution'
  );

  perform public.test_assert(
    (
      select current_stage = 0
      from public.user_companion
      where id = v_companion.id
    ),
    'pre-hatch XP must leave current_stage at 0'
  );

  perform public.test_assert(
    (
      select current_xp = 10
      from public.user_companion
      where id = v_companion.id
    ),
    'pre-hatch XP should still persist earned XP'
  );

  select *
  into v_preset_bound
  from public.apply_companion_preset_selection(
    v_companion.id,
    'fox',
    'Fox',
    '#33cc66',
    'nature',
    'epic_adventure',
    1,
    '/companion-presets/fox/t1_youth/normal/fox__t1_youth__normal__nature.png',
    '/companion-eggs/egg__t0_egg__normal__nature.png'
  )
  limit 1;

  perform public.test_assert(
    coalesce(v_preset_bound.current_stage, -1) = 0,
    'preset selection must not advance an unhatched companion past stage 0'
  );

  perform public.test_assert(
    coalesce(v_preset_bound.current_image_url, '') = '/companion-eggs/egg__t0_egg__normal__nature.png',
    'preset selection must keep the egg art until hatch'
  );

  select count(*)
  into v_stage1_count
  from public.companion_evolutions
  where companion_id = v_companion.id
    and stage = 1;

  perform public.test_assert(
    v_stage1_count = 0,
    'preset selection must not create a stage 1 evolution row'
  );

  select *
  into v_hatched
  from public.hatch_companion_with_preset(
    v_companion.id,
    'fox',
    'Fox',
    '#33cc66',
    'nature',
    'epic_adventure',
    '/companion-eggs/egg__t0_egg__normal__nature.png',
    0.5,
    0.45,
    '/companion-presets/fox/t1_youth/normal/fox__t1_youth__normal__nature.png',
    0.53,
    0.49,
    10
  )
  limit 1;

  perform public.test_assert(
    coalesce(v_hatched.current_stage, -1) = 1,
    'hatch_companion_with_preset should be the first writer that claims stage 1'
  );

  perform public.test_assert(
    coalesce(v_hatched.current_image_url, '') = '/companion-presets/fox/t1_youth/normal/fox__t1_youth__normal__nature.png',
    'hatch_companion_with_preset should swap the egg art for stage 1 art'
  );

  select count(*)
  into v_stage1_count
  from public.companion_evolutions
  where companion_id = v_companion.id
    and stage = 1;

  perform public.test_assert(
    v_stage1_count = 1,
    'only hatch_companion_with_preset should create the first stage 1 evolution row'
  );

  execute 'reset role';
end
$$;

do $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  begin
    update public.evening_reflections
    set mentor_response = 'Client override'
    where id = '66666666-6666-6666-6666-666666666662';
  exception
    when others then
      null;
  end;

  execute 'reset role';

  perform public.test_assert(
    (
      select mentor_response = 'Server-authored reflection response'
      from public.evening_reflections
      where id = '66666666-6666-6666-6666-666666666662'
    ),
    'mentor responses must remain server-authored'
  );
end
$$;

do $$
declare
  v_community_id uuid := '33333333-3333-3333-3333-333333333333';
  v_owner_membership_id uuid := '44444444-4444-4444-4444-444444444444';
  v_member_membership_id uuid := '55555555-5555-5555-5555-555555555555';
begin
  insert into public.communities (
    id,
    name,
    invite_code,
    is_public,
    owner_id
  )
  values (
    v_community_id,
    'Regression Guild',
    'REGTEST1',
    false,
    '11111111-1111-1111-1111-111111111111'
  )
  on conflict (id) do update
  set owner_id = excluded.owner_id;

  insert into public.community_members (
    id,
    community_id,
    user_id,
    role
  )
  values
    (
      v_owner_membership_id,
      v_community_id,
      '11111111-1111-1111-1111-111111111111',
      'owner'
    ),
    (
      v_member_membership_id,
      v_community_id,
      '22222222-2222-2222-2222-222222222222',
      'member'
    )
  on conflict (community_id, user_id) do update
  set role = excluded.role;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  begin
    update public.community_members
    set role = 'admin'
    where id = v_member_membership_id;
    raise exception 'community member role should not be directly editable by clients';
  exception
    when others then
      perform public.test_assert(
        position('new row violates row-level security policy' in lower(sqlerrm)) > 0,
        'community member role changes should require server-owned rpc enforcement'
      );
  end;

  begin
    update public.communities
    set owner_id = '22222222-2222-2222-2222-222222222222'
    where id = v_community_id;
    raise exception 'community owner_id should not be directly editable by clients';
  exception
    when others then
      perform public.test_assert(
        position('new row violates row-level security policy' in lower(sqlerrm)) > 0,
        'community owner_id changes should require transfer_community_ownership'
      );
  end;

  execute 'reset role';

  perform public.test_assert(
    (
      select role = 'member'
      from public.community_members
      where id = v_member_membership_id
    ),
    'direct client writes must not change community member roles'
  );

  perform public.test_assert(
    (
      select owner_id = '11111111-1111-1111-1111-111111111111'
      from public.communities
      where id = v_community_id
    ),
    'direct client writes must not change communities.owner_id'
  );
end
$$;

do $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  begin
    perform *
    from public.repair_auto_advanced_companion_state(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    );
    raise exception 'repair_auto_advanced_companion_state should reject cross-user companion writes';
  exception
    when others then
      perform public.test_assert(
        position('companion not found' in lower(sqlerrm)) > 0,
        'repair_auto_advanced_companion_state should bind writes to auth.uid()'
      );
  end;

  execute 'reset role';
end
$$;

do $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  begin
    update public.weekly_recaps
    set mentor_insight = 'Client tamper attempt'
    where id = '66666666-6666-6666-6666-666666666663';
  exception
    when others then
      null;
  end;

  execute 'reset role';

  perform public.test_assert(
    (
      select mentor_insight = 'Server weekly insight'
      from public.weekly_recaps
      where id = '66666666-6666-6666-6666-666666666663'
    ),
    'weekly recap narrative fields must remain server-managed'
  );
end
$$;

do $$
declare
  v_viewed_at timestamptz;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  select public.mark_weekly_recap_viewed('66666666-6666-6666-6666-666666666663')
  into v_viewed_at;

  execute 'reset role';

  perform public.test_assert(
    v_viewed_at is not null
      and (
        select viewed_at is not null
        from public.weekly_recaps
        where id = '66666666-6666-6666-6666-666666666663'
      ),
    'owners can mark their own weekly recap as viewed through the RPC'
  );
end
$$;

do $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  begin
    perform public.mark_weekly_recap_viewed('66666666-6666-6666-6666-666666666664');
    raise exception 'mark_weekly_recap_viewed should reject cross-user recap access';
  exception
    when others then
      perform public.test_assert(
        position('not found' in lower(sqlerrm)) > 0,
        'weekly recap view RPC should stay scoped to auth.uid()'
      );
  end;

  execute 'reset role';

  perform public.test_assert(
    (
      select viewed_at is null
      from public.weekly_recaps
      where id = '66666666-6666-6666-6666-666666666664'
    ),
    'cross-user recap view attempts must not mutate another user row'
  );
end
$$;

do $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  begin
    insert into public.epic_journey_paths (
      id,
      epic_id,
      user_id,
      milestone_index,
      image_url,
      prompt_context
    )
    values (
      '66666666-6666-6666-6666-666666666666',
      '66666666-6666-6666-6666-666666666661',
      '11111111-1111-1111-1111-111111111111',
      1,
      'https://example.com/hijack-path.png',
      '{}'::jsonb
    );
  exception
    when others then
      null;
  end;

  begin
    update public.epic_journey_paths
    set image_url = 'https://example.com/hijack-update.png'
    where id = '66666666-6666-6666-6666-666666666665';
  exception
    when others then
      null;
  end;

  execute 'reset role';

  perform public.test_assert(
    not exists (
      select 1
      from public.epic_journey_paths
      where id = '66666666-6666-6666-6666-666666666666'
    ),
    'clients must not directly insert journey path cache rows'
  );

  perform public.test_assert(
    (
      select image_url = 'https://example.com/journey-path.png'
      from public.epic_journey_paths
      where id = '66666666-6666-6666-6666-666666666665'
    ),
    'clients must not directly update generated journey path rows'
  );
end
$$;

do $$
declare
  v_visible_count integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  select count(*)
  into v_visible_count
  from public.profiles
  where id = '22222222-2222-2222-2222-222222222222';

  execute 'reset role';

  perform public.test_assert(
    v_visible_count = 0,
    'authenticated users must not read another user''s profile row'
  );
end
$$;

do $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  begin
    update public.account_entitlements
    set is_active = true
    where user_id = '11111111-1111-1111-1111-111111111111';
  exception
    when others then
      null;
  end;

  execute 'reset role';

  perform public.test_assert(
    (select is_active = false from public.account_entitlements where user_id = '11111111-1111-1111-1111-111111111111'),
    'account entitlements must remain server-managed'
  );
end
$$;

do $$
declare
  v_upload_error text;
begin
  execute 'set local role anon';
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claim.sub', '', true);

  v_upload_error := public.test_try_insert_storage_object(
    '77777777-7777-7777-7777-777777777771',
    'quest-attachments',
    '11111111-1111-1111-1111-111111111111/anon.txt',
    '11111111-1111-1111-1111-111111111111',
    '{"mimetype":"text/plain","size":"128"}'::jsonb
  );

  execute 'reset role';

  perform public.test_assert(
    v_upload_error is not null,
    'anonymous users must not upload quest attachments'
  );
end
$$;

do $$
declare
  v_cross_folder_error text;
  v_invalid_extension_error text;
  v_invalid_mime_error text;
  v_oversize_error text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  insert into storage.objects (
    id,
    bucket_id,
    name,
    owner,
    owner_id,
    metadata,
    user_metadata,
    version,
    created_at,
    updated_at,
    last_accessed_at
  )
  values (
    '77777777-7777-7777-7777-777777777772',
    'quest-attachments',
    '11111111-1111-1111-1111-111111111111/allowed.txt',
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '{"mimetype":"text/plain","size":"1024"}'::jsonb,
    '{}'::jsonb,
    '1',
    now(),
    now(),
    now()
  );

  v_cross_folder_error := public.test_try_insert_storage_object(
    '77777777-7777-7777-7777-777777777773',
    'quest-attachments',
    '22222222-2222-2222-2222-222222222222/hijack.txt',
    '11111111-1111-1111-1111-111111111111',
    '{"mimetype":"text/plain","size":"1024"}'::jsonb
  );

  v_invalid_extension_error := public.test_try_insert_storage_object(
    '77777777-7777-7777-7777-777777777774',
    'quest-attachments',
    '11111111-1111-1111-1111-111111111111/malware.exe',
    '11111111-1111-1111-1111-111111111111',
    '{"mimetype":"application/octet-stream","size":"1024"}'::jsonb
  );

  v_invalid_mime_error := public.test_try_insert_storage_object(
    '77777777-7777-7777-7777-777777777775',
    'quest-attachments',
    '11111111-1111-1111-1111-111111111111/bad-mime.txt',
    '11111111-1111-1111-1111-111111111111',
    '{"mimetype":"application/x-msdownload","size":"1024"}'::jsonb
  );

  v_oversize_error := public.test_try_insert_storage_object(
    '77777777-7777-7777-7777-777777777776',
    'quest-attachments',
    '11111111-1111-1111-1111-111111111111/too-big.pdf',
    '11111111-1111-1111-1111-111111111111',
    '{"mimetype":"application/pdf","size":"20971520"}'::jsonb
  );

  perform public.test_assert(
    public.test_try_insert_storage_object(
      '77777777-7777-7777-7777-777777777777',
      'mentor-audio',
      'generated/blocked.mp3',
      '11111111-1111-1111-1111-111111111111',
      '{"mimetype":"audio/mpeg","size":"2048"}'::jsonb
    ) is not null,
    'authenticated users must not upload mentor audio assets directly'
  );

  perform public.test_assert(
    public.test_try_insert_storage_object(
      '77777777-7777-7777-7777-777777777778',
      'journey-paths',
      'epic/blocked.png',
      '11111111-1111-1111-1111-111111111111',
      '{"mimetype":"image/png","size":"2048"}'::jsonb
    ) is not null,
    'authenticated users must not upload journey path assets directly'
  );

  execute 'reset role';

  perform public.test_assert(
    exists (
      select 1
      from storage.objects
      where id = '77777777-7777-7777-7777-777777777772'
    ),
    'authenticated users can upload valid quest attachments in their own folder'
  );

  perform public.test_assert(
    v_cross_folder_error is not null,
    'authenticated users must not upload quest attachments into another user folder'
  );

  perform public.test_assert(
    v_invalid_extension_error is not null,
    'quest attachment validation must reject unsafe file extensions'
  );

  perform public.test_assert(
    v_invalid_mime_error is not null,
    'quest attachment validation must reject unsafe MIME types'
  );

  perform public.test_assert(
    v_oversize_error is not null,
    'quest attachment validation must reject oversized uploads'
  );
end
$$;

do $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  update public.profiles
  set timezone = 'UTC'
  where id = '11111111-1111-1111-1111-111111111111';

  execute 'reset role';

  perform public.test_assert(
    (select timezone = 'UTC' from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
    'users should still be able to update ordinary profile preferences'
  );
end
$$;

do $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  begin
    update public.user_companion
    set current_xp = 999999
    where user_id = '11111111-1111-1111-1111-111111111111';
  exception
    when others then
      null;
  end;

  execute 'reset role';

  perform public.test_assert(
    (select current_xp = 0 from public.user_companion where user_id = '11111111-1111-1111-1111-111111111111'),
    'companion XP must remain immutable from client table writes'
  );
end
$$;

do $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  begin
    update public.profiles
    set referred_by = '22222222-2222-2222-2222-222222222222',
        referred_by_code = 'USERA-CODE'
    where id = '11111111-1111-1111-1111-111111111111';
    raise exception 'profiles update policy should reject client-side referral field edits';
  exception
    when others then
      perform public.test_assert(
        position('new row violates row-level security policy' in lower(sqlerrm)) > 0,
        'profiles policy should block client-side referral field edits'
      );
  end;

  execute 'reset role';

  perform public.test_assert(
    (select referred_by_code is null from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
    'client-side referral edits must not mutate the authenticated profile'
  );
end
$$;

do $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  begin
    perform *
    from public.consume_companion_regeneration(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'https://example.com/hijack.png'
    );
    raise exception 'consume_companion_regeneration should reject cross-user companion writes';
  exception
    when others then
      perform public.test_assert(
        position('companion not found' in lower(sqlerrm)) > 0,
        'companion regeneration RPC should bind writes to auth.uid()'
      );
  end;

  execute 'reset role';

  perform public.test_assert(
    (select current_image_url = 'https://example.com/b.png' from public.user_companion where user_id = '22222222-2222-2222-2222-222222222222'),
    'cross-user regeneration attempts must not change another companion image'
  );
end
$$;

do $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  begin
    perform *
    from public.award_xp_v2(
      'epic_complete',
      999,
      '{"epic_id":"epic-test"}'::jsonb,
      'xp-test-guard'
    );
    raise exception 'award_xp_v2 should reject over-limit XP grants';
  exception
    when others then
      perform public.test_assert(
        position('allowed maximum' in lower(sqlerrm)) > 0,
        'award_xp_v2 should reject arbitrarily large XP awards'
      );
  end;

  execute 'reset role';
end
$$;

do $$
declare
  v_mission_id uuid := '44444444-4444-4444-4444-444444444441';
  v_first_result record;
  v_second_result record;
  v_xp_before integer;
begin
  delete from public.daily_missions
  where id = v_mission_id;

  insert into public.daily_missions (
    id,
    user_id,
    mission_type,
    mission_text,
    xp_reward,
    mission_date,
    completed,
    category
  )
  values (
    v_mission_id,
    '11111111-1111-1111-1111-111111111111',
    'library_explore',
    'Complete the atomic mission',
    8,
    current_date,
    false,
    'atomic-rpc-success'
  );

  select current_xp
  into v_xp_before
  from public.user_companion
  where user_id = '11111111-1111-1111-1111-111111111111';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  select *
  into v_first_result
  from public.complete_daily_mission_with_xp(v_mission_id, 'manual', null);

  perform public.test_assert(
    v_first_result.status = 'completed',
    'complete_daily_mission_with_xp should complete eligible missions'
  );

  execute 'reset role';

  perform public.test_assert(
    (select completed = true from public.daily_missions where id = v_mission_id),
    'complete_daily_mission_with_xp should mark the mission complete after a successful XP award'
  );

  perform public.test_assert(
    (select current_xp = v_xp_before + 8 from public.user_companion where user_id = '11111111-1111-1111-1111-111111111111'),
    'complete_daily_mission_with_xp should award mission XP atomically'
  );

  perform public.test_assert(
    (
      select count(*) = 1
      from public.xp_events
      where user_id = '11111111-1111-1111-1111-111111111111'
        and event_type = 'mission_complete'
        and event_metadata ->> 'mission_id' = v_mission_id::text
    ),
    'complete_daily_mission_with_xp should log exactly one mission_complete XP event'
  );

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  select *
  into v_second_result
  from public.complete_daily_mission_with_xp(v_mission_id, 'manual', null);

  perform public.test_assert(
    v_second_result.status = 'already_completed',
    'complete_daily_mission_with_xp should return already_completed on duplicate claims'
  );

  execute 'reset role';

  perform public.test_assert(
    (
      select count(*) = 1
      from public.xp_events
      where user_id = '11111111-1111-1111-1111-111111111111'
        and event_type = 'mission_complete'
        and event_metadata ->> 'mission_id' = v_mission_id::text
    ),
    'duplicate mission claims must not create a second XP event'
  );
end
$$;

do $$
declare
  v_mission_id uuid := '44444444-4444-4444-4444-444444444442';
  v_result record;
begin
  delete from public.daily_missions
  where id = v_mission_id;

  insert into public.daily_missions (
    id,
    user_id,
    mission_type,
    mission_text,
    xp_reward,
    mission_date,
    completed,
    category
  )
  values (
    v_mission_id,
    '22222222-2222-2222-2222-222222222222',
    'library_explore',
    'User B mission',
    8,
    current_date,
    false,
    'atomic-rpc-cross-user'
  );

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  select *
  into v_result
  from public.complete_daily_mission_with_xp(v_mission_id, 'manual', null);

  execute 'reset role';

  perform public.test_assert(
    v_result.status = 'failed'
      and position('mission not found' in lower(coalesce(v_result.message, ''))) > 0,
    'complete_daily_mission_with_xp should reject cross-user mission claims'
  );

  perform public.test_assert(
    (select completed = false from public.daily_missions where id = v_mission_id),
    'cross-user mission completion attempts must not mutate another users mission'
  );
end
$$;

do $$
declare
  v_mission_id uuid := '44444444-4444-4444-4444-444444444443';
  v_result record;
begin
  delete from public.daily_missions
  where id = v_mission_id;

  insert into public.daily_missions (
    id,
    user_id,
    mission_type,
    mission_text,
    xp_reward,
    mission_date,
    completed,
    category
  )
  values (
    v_mission_id,
    '99999999-9999-9999-9999-999999999999',
    'library_explore',
    'Missing companion mission',
    8,
    current_date,
    false,
    'atomic-rpc-missing-companion'
  );

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);

  select *
  into v_result
  from public.complete_daily_mission_with_xp(v_mission_id, 'manual', null);

  execute 'reset role';

  perform public.test_assert(
    v_result.status = 'failed'
      and position('companion' in lower(coalesce(v_result.message, ''))) > 0,
    'complete_daily_mission_with_xp should surface companion failures'
  );

  perform public.test_assert(
    (select completed = false from public.daily_missions where id = v_mission_id),
    'mission completion should roll back when the XP award fails'
  );

  perform public.test_assert(
    (
      select count(*) = 0
      from public.xp_events
      where event_type = 'mission_complete'
        and event_metadata ->> 'mission_id' = v_mission_id::text
    ),
    'mission completion rollback should not leave behind mission XP events'
  );
end
$$;

do $$
declare
  v_visible_count integer;
begin
  if to_regclass('public.achievements') is not null then
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

    select count(*)
    into v_visible_count
    from public.achievements
    where user_id = '22222222-2222-2222-2222-222222222222';

    execute 'reset role';

    perform public.test_assert(
      v_visible_count = 0,
      'achievements rows must remain scoped to the owning user'
    );
  end if;

  if to_regclass('public.user_reflections') is not null then
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

    select count(*)
    into v_visible_count
    from public.user_reflections
    where user_id = '22222222-2222-2222-2222-222222222222';

    execute 'reset role';

    perform public.test_assert(
      v_visible_count = 0,
      'user_reflections rows must remain scoped to the owning user'
    );
  end if;
end
$$;

rollback;
