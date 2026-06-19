-- PostgreSQL schema for sports_EMS
-- Uses IF NOT EXISTS so it's safe to re-run and won't clobber existing tables.

CREATE SCHEMA IF NOT EXISTS sports_ems;
SET search_path TO sports_ems;

-- Session store table (used by connect-pg-simple)
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR      NOT NULL PRIMARY KEY,
  sess   JSON         NOT NULL,
  expire TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expire_idx ON session (expire);

-- 1. Lookup tables (no foreign-key dependencies)

CREATE TABLE IF NOT EXISTS departments (
  depID    SERIAL PRIMARY KEY,
  depName  VARCHAR(100) NOT NULL,
  depDesc  TEXT         NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS organizations (
  orgID   SERIAL PRIMARY KEY,
  orgName VARCHAR(100) NOT NULL,
  SLUorg  SMALLINT     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS venues (
  venueID      SERIAL PRIMARY KEY,
  venueName    VARCHAR(100) NOT NULL,
  venueAddress VARCHAR(255),
  status       VARCHAR(20)  NOT NULL DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS schedules (
  scheduleID SERIAL PRIMARY KEY,
  duration   VARCHAR(45),
  startDate  DATE NOT NULL,
  endDate    DATE NOT NULL
);

-- 2. Core entity tables

CREATE TABLE IF NOT EXISTS events (
  eventID       SERIAL PRIMARY KEY,
  depID         INT REFERENCES departments(depID)  ON DELETE SET NULL ON UPDATE CASCADE,
  orgID         INT REFERENCES organizations(orgID) ON DELETE SET NULL ON UPDATE CASCADE,
  venueID       INT REFERENCES venues(venueID)      ON DELETE SET NULL ON UPDATE CASCADE,
  scheduleID    INT REFERENCES schedules(scheduleID) ON DELETE SET NULL ON UPDATE CASCADE,
  eventCategory VARCHAR(45)  NOT NULL,
  eventName     VARCHAR(100) NOT NULL,
  description   TEXT,
  eventStatus   VARCHAR(20)  NOT NULL DEFAULT 'upcoming'
                  CHECK (eventStatus IN ('upcoming','ongoing','done')),
  event_img     TEXT   -- stored as base64 string
);

CREATE TABLE IF NOT EXISTS sessions (
  sessionID   SERIAL PRIMARY KEY,
  eventID     INT REFERENCES events(eventID)      ON DELETE SET NULL ON UPDATE CASCADE,
  scheduleID  INT REFERENCES schedules(scheduleID) ON DELETE SET NULL ON UPDATE CASCADE,
  sessionDesc VARCHAR(100),
  firstDay    DATE NOT NULL,
  lastDay     DATE NOT NULL,
  startTime   TIME NOT NULL,
  endTime     TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  userID           SERIAL PRIMARY KEY,
  depID            INT REFERENCES departments(depID)   ON DELETE SET NULL ON UPDATE CASCADE,
  orgID            INT REFERENCES organizations(orgID)  ON DELETE SET NULL ON UPDATE CASCADE,
  firstName        VARCHAR(100) NOT NULL,
  lastName         VARCHAR(100) NOT NULL,
  password         VARCHAR(255) NOT NULL,
  email            VARCHAR(100) NOT NULL UNIQUE,
  userType         VARCHAR(10)  NOT NULL DEFAULT 'user'
                     CHECK (userType IN ('admin','user')),
  registrationDate TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Transactional / junction tables

CREATE TABLE IF NOT EXISTS event_reg (
  eventRegID       SERIAL PRIMARY KEY,
  userID           INT REFERENCES users(userID)   ON DELETE SET NULL ON UPDATE CASCADE,
  eventID          INT REFERENCES events(eventID) ON DELETE SET NULL ON UPDATE CASCADE,
  registrationDate TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_attendance (
  attendanceID      SERIAL PRIMARY KEY,
  eventID           INT NOT NULL REFERENCES events(eventID)   ON DELETE CASCADE ON UPDATE CASCADE,
  userID            INT NOT NULL REFERENCES users(userID)     ON DELETE CASCADE ON UPDATE CASCADE,
  sessionID         INT NOT NULL REFERENCES sessions(sessionID) ON DELETE CASCADE ON UPDATE CASCADE,
  attendanceDateTime TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_qr (
  userID         INT NOT NULL REFERENCES users(userID)        ON DELETE CASCADE ON UPDATE CASCADE,
  registrationID INT NOT NULL REFERENCES event_reg(eventRegID) ON DELETE CASCADE ON UPDATE CASCADE,
  eventID        INT NOT NULL REFERENCES events(eventID)      ON DELETE CASCADE ON UPDATE CASCADE,
  qr_img         TEXT NOT NULL,
  PRIMARY KEY (userID, registrationID, eventID)
);

CREATE TABLE IF NOT EXISTS status (
  eventID        INT NOT NULL REFERENCES events(eventID)       ON DELETE CASCADE ON UPDATE CASCADE,
  registrationID INT NOT NULL REFERENCES event_reg(eventRegID) ON DELETE CASCADE ON UPDATE CASCADE,
  comment        TEXT NOT NULL,
  PRIMARY KEY (eventID, registrationID)
);
