-- Flower house (profile page): profile stats, the keepsake shelf and the "exam is over" choice.
-- Run once in the Supabase SQL editor (after setup.sql and auth.sql). Safe to re-run.

-- ---- profile stats + shelf ----
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS study_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shelf_unlocked boolean NOT NULL DEFAULT false; -- row 3 bought
UPDATE profiles SET best_streak = streak WHERE best_streak < streak;

-- ---- "exam is over" choice, per subject ----
-- exam_choice: null = not asked yet. shelf_slot: the subject's one flower on the shelf (rows of 6: 0-5, 6-11, 12-17).
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS exam_choice text CHECK (exam_choice IN ('garden', 'house'));
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS shelf_slot smallint CHECK (shelf_slot BETWEEN 0 AND 17);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_user_shelf_slot ON subjects (user_id, shelf_slot);

-- seeds dug up and moved to the house: hidden from the garden, kept in the database
ALTER TABLE seeds ADD COLUMN IF NOT EXISTS in_house boolean NOT NULL DEFAULT false;

-- ---- RPCs: each runs as one transaction, so a double click or a dropped connection can't half-apply it ----

-- Row 3 of the shelf for 80 coins. Returns { coins, shelf_unlocked }.
CREATE OR REPLACE FUNCTION public.unlock_shelf() RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;

-- Adds study time (Pomodoro focus blocks, Flexible Deck, Structured Quiz). At most 3 hours per call.
-- Returns the new total in seconds.
CREATE OR REPLACE FUNCTION public.add_study_time(p_seconds integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_seconds IS NULL OR p_seconds <= 0 THEN RAISE EXCEPTION 'INVALID_SECONDS'; END IF;
  UPDATE profiles SET study_seconds = study_seconds + LEAST(p_seconds, 10800) WHERE id = auth.uid()
    RETURNING study_seconds INTO total;
  RETURN total;
END;
$$;

-- Answers "exam is over" for one subject: 'garden' keeps its plants, 'house' moves every seed of the subject
-- out of the garden and gives the subject the lowest free shelf slot (12 slots, 18 once unlocked).
-- A subject that already has a slot (housed before, then given a new exam date) keeps it.
-- Returns { exam_choice, shelf_slot }.
CREATE OR REPLACE FUNCTION public.choose_exam_outcome(p_subject uuid, p_choice text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s subjects%ROWTYPE;
  slots integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_choice IS NULL OR p_choice NOT IN ('garden', 'house') THEN RAISE EXCEPTION 'INVALID_CHOICE'; END IF;
  SELECT * INTO s FROM subjects WHERE id = p_subject AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  -- CURRENT_DATE is UTC; a user ahead of UTC already sees the next day, so the exam day itself is allowed here
  IF s.exam_date IS NULL OR s.exam_date > CURRENT_DATE THEN RAISE EXCEPTION 'EXAM_NOT_OVER'; END IF;
  IF s.exam_choice IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_CHOSEN'; END IF;

  IF p_choice = 'house' THEN
    IF s.shelf_slot IS NULL THEN
      -- locking the profile row makes two moves at once queue up instead of taking the same slot
      SELECT CASE WHEN shelf_unlocked THEN 18 ELSE 12 END INTO slots FROM profiles WHERE id = auth.uid() FOR UPDATE;
      SELECT min(n) INTO s.shelf_slot FROM generate_series(0, slots - 1) AS n
        WHERE n NOT IN (SELECT shelf_slot FROM subjects WHERE user_id = auth.uid() AND shelf_slot IS NOT NULL);
      IF s.shelf_slot IS NULL THEN RAISE EXCEPTION 'SHELF_FULL'; END IF;
    END IF;
    UPDATE seeds SET in_house = true WHERE subject_id = s.id AND user_id = auth.uid();
  END IF;

  UPDATE subjects SET exam_choice = p_choice, shelf_slot = s.shelf_slot WHERE id = s.id;
  RETURN json_build_object('exam_choice', p_choice, 'shelf_slot', s.shelf_slot);
END;
$$;
