CREATE TABLE IF NOT EXISTS payments (
    payment_id BIGINT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    payment_value DOUBLE PRECISION NOT NULL,
    overdue_penalty DOUBLE PRECISION,
    due_date TIMESTAMPTZ NOT NULL,
    title TEXT NOT NULL,
    has_submission BOOLEAN NOT NULL,
    is_dojo_due BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS events (
    event_id BIGINT PRIMARY KEY,
    event_date TIMESTAMPTZ NOT NULL,
    event_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_deadline TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_location TEXT NOT NULL,
    description TEXT,
    maps_link TEXT,
    payment_id BIGINT REFERENCES payments(payment_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assigned_payments (
    payment_id BIGINT NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL,
    due_status TEXT NOT NULL,
    assigned_on TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (payment_id, member_id)
);

CREATE TABLE IF NOT EXISTS seminar_registrations (
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL,
    registration_date TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (event_id, member_id)
);

CREATE TABLE IF NOT EXISTS seminars (
    event_id BIGINT PRIMARY KEY REFERENCES events(event_id) ON DELETE CASCADE,
    seminar_guests TEXT[] NOT NULL DEFAULT '{}',
    bring_your_lunch BOOLEAN NOT NULL,
    external_signup_url TEXT
);

CREATE TABLE IF NOT EXISTS special_event_registrations (
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL,
    registration_date TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (event_id, member_id)
);

CREATE TABLE IF NOT EXISTS special_events (
    event_id BIGINT PRIMARY KEY REFERENCES events(event_id) ON DELETE CASCADE,
    bring_your_lunch BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS shinsa_registrations (
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL,
    registration_date TIMESTAMPTZ NOT NULL,
    testing_for TEXT NOT NULL,
    PRIMARY KEY (event_id, member_id)
);

CREATE TABLE IF NOT EXISTS shinsa_exams (
    event_id BIGINT PRIMARY KEY REFERENCES events(event_id) ON DELETE CASCADE,
    shinsa_levels TEXT[] NOT NULL DEFAULT '{}',
    external_signup_url TEXT
);

CREATE TABLE IF NOT EXISTS submitted_payments (
    payment_id BIGINT NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL,
    submitted_on TIMESTAMPTZ NOT NULL,
    total_paid DOUBLE PRECISION NOT NULL,
    overdue BOOLEAN NOT NULL,
    assigned_on TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (payment_id, member_id)
);

CREATE TABLE IF NOT EXISTS tournament_registrations (
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL,
    registration_date TIMESTAMPTZ NOT NULL,
    shinpanning BOOLEAN NOT NULL,
    divisions TEXT[] NOT NULL DEFAULT '{}',
    doing_teams BOOLEAN NOT NULL,
    weight NUMERIC,
    height NUMERIC,
    age INTEGER,
    PRIMARY KEY (event_id, member_id)
);

CREATE TABLE IF NOT EXISTS tournaments (
    event_id BIGINT PRIMARY KEY REFERENCES events(event_id) ON DELETE CASCADE,
    shinpan_needed BOOLEAN NOT NULL,
    divisions TEXT[] NOT NULL DEFAULT '{}',
    teams_included BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
    counter_title TEXT PRIMARY KEY,
    counter_value BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
    announcement_id BIGINT PRIMARY KEY,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    pdf_url TEXT,
    target TEXT NOT NULL DEFAULT 'all',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS families (
    family_id BIGINT PRIMARY KEY,
    family_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_members (
    family_id BIGINT NOT NULL REFERENCES families(family_id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL,
    PRIMARY KEY (family_id, member_id)
);

CREATE TABLE IF NOT EXISTS recurring_payments (
    payment_id BIGINT PRIMARY KEY REFERENCES payments(payment_id) ON DELETE CASCADE,
    interval_months INTEGER NOT NULL,
    broadcast_target TEXT NOT NULL,
    next_due_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    designated_parents JSONB,
    youth_payment_value NUMERIC,
    student_payment_value NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tournament_results (
    result_id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    member_id BIGINT,
    member_name TEXT NOT NULL,
    division TEXT NOT NULL,
    placement TEXT NOT NULL,
    is_teams BOOLEAN NOT NULL DEFAULT FALSE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);