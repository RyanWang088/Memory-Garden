-- user -> subjects -> seeds (topic decks) -> cards
-- mastery is stored on cards only; deck/subject mastery is calculated from card_mastery
CREATE TABLE profiles (
id uuid NOT NULL,
email text,
display_name text,
onboarding_answers jsonb DEFAULT '{}'::jsonb,
avatar text,
coins integer NOT NULL DEFAULT 50,
streak integer NOT NULL DEFAULT 0,
last_tended timestamp with time zone,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT profiles_pkey PRIMARY KEY (id),
CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE subjects (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL DEFAULT auth.uid(),
name text NOT NULL,
exam_date date,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT subjects_pkey PRIMARY KEY (id),
CONSTRAINT subjects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
CONSTRAINT subjects_name_user_unique UNIQUE (user_id, name)
);
CREATE TABLE seeds (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL DEFAULT auth.uid(),
subject_id uuid NOT NULL,
title text NOT NULL,
tags jsonb DEFAULT '[]'::jsonb,
row smallint,
col smallint,
flower text,
color text NOT NULL DEFAULT 'red',
last_reviewed timestamp with time zone,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT seeds_pkey PRIMARY KEY (id),
CONSTRAINT seeds_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
CONSTRAINT seeds_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT
);
CREATE TABLE cards (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL DEFAULT auth.uid(),
seed_id uuid NOT NULL,
question text NOT NULL,
answer text NOT NULL,
card_mastery smallint NOT NULL DEFAULT 0 CHECK (card_mastery >= 0 AND card_mastery <= 100),
next_review timestamp with time zone,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT cards_pkey PRIMARY KEY (id),
CONSTRAINT cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
CONSTRAINT cards_seed_id_fkey FOREIGN KEY (seed_id) REFERENCES seeds(id) ON DELETE CASCADE
);