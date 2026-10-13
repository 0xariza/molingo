import { customType, timestamp, uuid } from "drizzle-orm/pg-core";

/** Case-insensitive text (requires the `citext` extension). */
export const citext = customType<{ data: string }>({
  dataType: () => "citext",
});

export const id = () => uuid().primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
