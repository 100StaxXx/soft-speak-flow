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
    )
  on conflict (id) do nothing;

  update public.profiles
  set
    referred_by = null,
    referred_by_code = null,
    streak_freezes_available = 1,
    life_status = 'alive'
  where id in (v_user_a, v_user_b);

  insert into public.account_entitlements (
    user_id,
    source,
    status,
    plan,
    is_active
  )
  values
    (v_user_a, 'subscription', 'active', 'monthly', false),
    (v_user_b, 'none', 'inactive', null, false)
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
    perform public.apply_referral_code_secure(
      '22222222-2222-2222-2222-222222222222',
      'USERA-CODE'
    );
    raise exception 'apply_referral_code_secure should reject impersonation attempts';
  exception
    when others then
      perform public.test_assert(
        position('another user' in lower(sqlerrm)) > 0,
        'apply_referral_code_secure should reject cross-user application attempts'
      );
  end;

  execute 'reset role';

  perform public.test_assert(
    (select referred_by_code is null from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
    'cross-user referral attempts must not mutate victim profiles'
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
