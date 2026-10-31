-- Memory Garden database schema: a snapshot of the live Supabase project (taken 2026-10-23).
--
-- Change the schema in the Supabase dashboard,
-- then refresh this file so the repo keeps an up-to-date copy (see Consistent.md 3.5).
-- In case Supabase is bombed then use this sql file to rebuild from scratch
-- To rebuild on a new, empty Supabase project: paste this whole file into the SQL editor and run it.
-- It holds structure plus the flower/shop catalogue only, w/o user data.

-- =========================================================
-- Tables
-- =========================================================
CREATE TABLE public.cards (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  seed_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  card_mastery smallint DEFAULT 0 NOT NULL,
  next_review timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  wrong_options text[] DEFAULT '{}'::text[] NOT NULL,
  CONSTRAINT cards_pkey PRIMARY KEY (id),
  CONSTRAINT cards_card_mastery_check CHECK (((card_mastery >= 0) AND (card_mastery <= 100)))
);

-- A subject can have many exams; exam_choice is set only by choose_exam_outcome
CREATE TABLE public.exams (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  subject_id uuid NOT NULL,
  name text NOT NULL,
  exam_date date,
  exam_choice text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT exams_pkey PRIMARY KEY (id),
  CONSTRAINT exams_id_subject_unique UNIQUE (id, subject_id),
  CONSTRAINT exams_name_check CHECK ((length(btrim(name)) > 0)),
  CONSTRAINT exams_exam_choice_check CHECK ((exam_choice = ANY (ARRAY['garden'::text, 'house'::text])))
);

CREATE TABLE public.flowers (
  id text NOT NULL,
  name text NOT NULL,
  price integer NOT NULL,
  CONSTRAINT flowers_pkey PRIMARY KEY (id),
  CONSTRAINT flowers_price_check CHECK ((price >= 0))
);

CREATE TABLE public.inventory (
  user_id uuid DEFAULT auth.uid() NOT NULL,
  item_id text NOT NULL,
  qty integer DEFAULT 0 NOT NULL,
  CONSTRAINT inventory_pkey PRIMARY KEY (user_id, item_id),
  CONSTRAINT inventory_qty_check CHECK ((qty >= 0))
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  display_name text,
  onboarding_answers jsonb DEFAULT '{}'::jsonb,
  avatar text,
  coins integer DEFAULT 100 NOT NULL,
  streak integer DEFAULT 0 NOT NULL,
  last_tended timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  onboarded boolean DEFAULT false NOT NULL,
  unlocked_flowers text[] DEFAULT '{tulip}'::text[] NOT NULL,
  best_streak integer DEFAULT 0 NOT NULL,
  study_seconds integer DEFAULT 0 NOT NULL,
  shelf_unlocked boolean DEFAULT false NOT NULL,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.seeds (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  subject_id uuid NOT NULL,
  title text NOT NULL,
  tags jsonb DEFAULT '[]'::jsonb,
  "row" smallint,
  col smallint,
  flower text DEFAULT 'tulip'::text NOT NULL,
  last_reviewed timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  color text DEFAULT 'pink'::text NOT NULL,
  in_house boolean DEFAULT false NOT NULL,
  exam_id uuid,
  CONSTRAINT seeds_pkey PRIMARY KEY (id),
  CONSTRAINT seeds_color_check CHECK ((color = ANY (ARRAY['pink'::text, 'red'::text, 'purple'::text, 'yellow'::text])))
);

CREATE TABLE public.shop_items (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  price integer NOT NULL,
  kind text DEFAULT 'booster'::text NOT NULL,
  icon text,
  sort_order smallint DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  CONSTRAINT shop_items_pkey PRIMARY KEY (id),
  CONSTRAINT shop_items_price_check CHECK ((price > 0))
);

CREATE TABLE public.subjects (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  color character varying(50) DEFAULT 'peri'::character varying,
  shelf_slot smallint,
  CONSTRAINT subjects_name_user_unique UNIQUE (user_id, name),
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_shelf_slot_check CHECK (((shelf_slot >= 0) AND (shelf_slot <= 17)))
);

-- Foreign keys (added after all tables exist)
ALTER TABLE public.cards ADD CONSTRAINT cards_seed_id_fkey FOREIGN KEY (seed_id) REFERENCES seeds(id) ON DELETE CASCADE;
ALTER TABLE public.cards ADD CONSTRAINT cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES shop_items(id);
ALTER TABLE public.inventory ADD CONSTRAINT inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.exams ADD CONSTRAINT exams_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.exams ADD CONSTRAINT exams_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
-- a seed's exam must belong to the seed's own subject; deleting the exam keeps the seed and clears exam_id
ALTER TABLE public.seeds ADD CONSTRAINT seeds_exam_fkey FOREIGN KEY (exam_id, subject_id) REFERENCES exams(id, subject_id) ON DELETE SET NULL (exam_id);
ALTER TABLE public.seeds ADD CONSTRAINT seeds_flower_fkey FOREIGN KEY (flower) REFERENCES flowers(id);
ALTER TABLE public.seeds ADD CONSTRAINT seeds_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT;
ALTER TABLE public.seeds ADD CONSTRAINT seeds_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.subjects ADD CONSTRAINT subjects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Indexes
CREATE UNIQUE INDEX exams_subject_name_unique ON public.exams USING btree (subject_id, lower(name)); -- "Midterm" = "midterm"
CREATE INDEX seeds_exam_id ON public.seeds USING btree (exam_id);
CREATE UNIQUE INDEX subjects_user_shelf_slot ON public.subjects USING btree (user_id, shelf_slot);

-- =========================================================
-- Row level security
-- =========================================================
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own cards" ON public.cards AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "own exams" ON public.exams AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "flowers readable by signed-in users" ON public.flowers AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "inventory readable by owner" ON public.inventory AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "own profile" ON public.profiles AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "own seeds" ON public.seeds AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "shop items readable by signed-in users" ON public.shop_items AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "own subjects" ON public.subjects AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

-- =========================================================
-- Grants
-- =========================================================
-- Supabase gives anon and authenticated full rights on public tables by default; RLS above
-- limits which rows they reach. These are the exceptions:

-- exam_choice changes only through choose_exam_outcome.
REVOKE UPDATE ON public.exams FROM anon, authenticated;
GRANT UPDATE (name, exam_date) ON public.exams TO authenticated;

-- Inventory changes only through buy_item / use_item.
REVOKE INSERT, UPDATE, DELETE ON public.inventory FROM anon, authenticated;

-- The client may update only these profile columns. unlocked_flowers, study_seconds and
-- shelf_unlocked change only through RPCs.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (email, display_name, onboarding_answers, avatar, coins, streak, last_tended, onboarded, best_streak)
  ON public.profiles TO authenticated;

-- =========================================================
-- Functions (RPCs and trigger functions)
-- =========================================================
CREATE OR REPLACE FUNCTION public.add_study_time(p_seconds integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_seconds IS NULL OR p_seconds <= 0 THEN RAISE EXCEPTION 'INVALID_SECONDS'; END IF;
  UPDATE profiles SET study_seconds = study_seconds + LEAST(p_seconds, 10800) WHERE id = auth.uid()
    RETURNING study_seconds INTO total;
  RETURN total;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buy_flower(p_flower text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_price integer;
  v_coins integer;
  v_owned text[];
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select price into v_price from public.flowers where id = p_flower;
  if not found then
    raise exception 'UNKNOWN_FLOWER';
  end if;

  -- Row lock: concurrent purchases for the same user queue up (no double-spend)
  select coins, unlocked_flowers into v_coins, v_owned
    from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_flower = any(v_owned) then
    raise exception 'ALREADY_OWNED';
  end if;

  if v_coins < v_price then
    raise exception 'INSUFFICIENT_COINS';
  end if;

  update public.profiles
     set coins = coins - v_price,
         unlocked_flowers = array_append(unlocked_flowers, p_flower)
   where id = v_uid
   returning coins, unlocked_flowers into v_coins, v_owned;

  return jsonb_build_object('coins', v_coins, 'unlocked_flowers', to_jsonb(v_owned));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.buy_item(p_item text, p_qty integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c_max_stack constant integer := 99;
  v_uid   uuid := auth.uid();
  v_price integer;
  v_coins integer;
  v_have  integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_qty is null or p_qty < 1 or p_qty > c_max_stack then
    raise exception 'INVALID_QUANTITY';
  end if;

  select price into v_price from public.shop_items where id = p_item and is_active;
  if not found then
    raise exception 'UNKNOWN_ITEM';
  end if;

  -- Row lock on the profile serialises this user's purchases (no double-spend)
  select coins into v_coins from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select coalesce(
           (select qty from public.inventory where user_id = v_uid and item_id = p_item), 0)
    into v_have;
  if v_have + p_qty > c_max_stack then
    raise exception 'STACK_LIMIT';
  end if;

  if v_coins < v_price * p_qty then
    raise exception 'INSUFFICIENT_COINS';
  end if;

  update public.profiles set coins = coins - v_price * p_qty
   where id = v_uid returning coins into v_coins;

  insert into public.inventory (user_id, item_id, qty)
  values (v_uid, p_item, p_qty)
  on conflict (user_id, item_id) do update set qty = public.inventory.qty + p_qty
  returning qty into v_have;

  return jsonb_build_object('coins', v_coins, 'item_id', p_item, 'qty', v_have);
end;
$function$
;

-- "Exam is over" per exam: 'house' moves only that exam's seeds. The shelf slot belongs to the subject,
-- so the first exam moved gets one and later exams of the same subject reuse it.
CREATE OR REPLACE FUNCTION public.choose_exam_outcome(p_exam uuid, p_choice text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e exams%ROWTYPE;
  slot smallint;
  slots integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_choice IS NULL OR p_choice NOT IN ('garden', 'house') THEN RAISE EXCEPTION 'INVALID_CHOICE'; END IF;
  SELECT * INTO e FROM exams WHERE id = p_exam AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  -- CURRENT_DATE is UTC; a user ahead of UTC already sees the next day, so the exam day itself is allowed here
  IF e.exam_date IS NULL OR e.exam_date > CURRENT_DATE THEN RAISE EXCEPTION 'EXAM_NOT_OVER'; END IF;
  IF e.exam_choice IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_CHOSEN'; END IF;

  SELECT shelf_slot INTO slot FROM subjects WHERE id = e.subject_id FOR UPDATE;
  IF p_choice = 'house' THEN
    IF slot IS NULL THEN
      -- locking the profile row makes two moves at once queue up instead of taking the same slot
      SELECT CASE WHEN shelf_unlocked THEN 18 ELSE 12 END INTO slots FROM profiles WHERE id = auth.uid() FOR UPDATE;
      SELECT min(n) INTO slot FROM generate_series(0, slots - 1) AS n
        WHERE n NOT IN (SELECT shelf_slot FROM subjects WHERE user_id = auth.uid() AND shelf_slot IS NOT NULL);
      IF slot IS NULL THEN RAISE EXCEPTION 'SHELF_FULL'; END IF;
      UPDATE subjects SET shelf_slot = slot WHERE id = e.subject_id;
    END IF;
    UPDATE seeds SET in_house = true WHERE exam_id = e.id AND user_id = auth.uid();
  END IF;

  UPDATE exams SET exam_choice = p_choice WHERE id = e.id;
  RETURN json_build_object('exam_choice', p_choice, 'shelf_slot', slot);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_seed_flower()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.flower is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.flower is not distinct from old.flower then
    return new;
  end if;
  if not exists (
    select 1 from public.profiles
     where id = new.user_id and new.flower = any(unlocked_flowers)
  ) then
    raise exception 'FLOWER_NOT_OWNED';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.unlock_shelf()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO p FROM profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT p.shelf_unlocked THEN
    IF p.coins < 80 THEN RAISE EXCEPTION 'INSUFFICIENT_COINS'; END IF;
    UPDATE profiles SET coins = coins - 80, shelf_unlocked = true WHERE id = auth.uid() RETURNING coins INTO p.coins;
  END IF;
  RETURN json_build_object('coins', p.coins, 'shelf_unlocked', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.use_item(p_item text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_qty integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select qty into v_qty from public.inventory
   where user_id = v_uid and item_id = p_item for update;
  if not found or v_qty < 1 then
    raise exception 'NOT_IN_INVENTORY';
  end if;

  update public.inventory set qty = qty - 1
   where user_id = v_uid and item_id = p_item returning qty into v_qty;

  return jsonb_build_object('item_id', p_item, 'qty', v_qty);
end;
$function$
;

-- Function execute rights. The other RPCs keep Supabase's default (anon + authenticated) and
-- reject callers without auth.uid() themselves.
REVOKE ALL ON FUNCTION public.choose_exam_outcome(p_exam uuid, p_choice text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_exam_outcome(p_exam uuid, p_choice text) TO authenticated;
REVOKE ALL ON FUNCTION public.buy_flower(p_flower text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_flower(p_flower text) TO authenticated;
REVOKE ALL ON FUNCTION public.buy_item(p_item text, p_qty integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_item(p_item text, p_qty integer) TO authenticated;
REVOKE ALL ON FUNCTION public.use_item(p_item text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.use_item(p_item text) TO authenticated;

-- =========================================================
-- Triggers
-- =========================================================
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER seeds_guard_flower BEFORE INSERT OR UPDATE OF flower ON public.seeds FOR EACH ROW EXECUTE FUNCTION guard_seed_flower();

-- Turns on RLS for every new public table (Supabase's "automatic RLS" option). Skipped if the
-- project already has it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') EXECUTE FUNCTION rls_auto_enable();
  END IF;
END $$;

-- =========================================================
-- Catalogue data (shop and flower prices, not user data)
-- =========================================================
INSERT INTO public.flowers (id, name, price) VALUES
  ('tulip', 'Tulip', 0),
  ('daisy', 'Daisy', 50),
  ('pansy', 'Pansy', 100),
  ('lily', 'Lily', 200),
  ('rose', 'Rose', 400);

INSERT INTO public.shop_items (id, name, description, price, kind, icon, sort_order, is_active) VALUES
  ('fertiliser', 'Fertiliser', 'Helps a plant grow faster.', 20, 'booster', '🧪', 1, true),
  ('streak-freeze', 'Streak freeze', 'Protects your streak for one day.', 30, 'booster', '🧊', 2, true);