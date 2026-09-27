import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
export const groups = sqliteTable(
  "groups",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    owner: text("owner").notNull(),
    inviteHash: text("invite_hash").notNull(),
    preferences: text("preferences").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [
    index("idx_groups_owner").on(t.owner),
    index("idx_groups_expiry").on(t.expiresAt),
  ],
);
export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    artists: text("artists").notNull(),
    genres: text("genres").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("idx_members_group").on(t.groupId),
    index("idx_members_owner").on(t.owner),
  ],
);
export const saved = sqliteTable(
  "saved",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.eventId] })],
);
export const votes = sqliteTable(
  "votes",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.eventId, t.memberId] })],
);
export const cache = sqliteTable("cache", {
  key: text("key").primaryKey(),
  data: text("data").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const oauth = sqliteTable("oauth", {
  state: text("state").primaryKey(),
  owner: text("owner").notNull(),
  verifier: text("verifier").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
