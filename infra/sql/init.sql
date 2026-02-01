CREATE TABLE IF NOT EXISTS payments (
    payment_id BIGINT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    payment_value DOUBLE PRECISION NOT NULL,
    overdue_penalty DOUBLE PRECISION,
    due_date TIMESTAMPTZ NOT NULL,
    title TEXT NOT NULL,
    has_submission BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    event_id BIGINT PRIMARY KEY,
    event_date TIMESTAMPTZ NOT NULL,
    event_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_deadline TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_location TEXT NOT NULL,
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
    shinsa_levels TEXT[] NOT NULL DEFAULT '{}'
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
    division TEXT NOT NULL,
    doing_teams BOOLEAN NOT NULL,
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