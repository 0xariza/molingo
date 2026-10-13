import { recreateDatabase } from "./database";
import { TEST_DATABASE_URL } from "./urls";

export default async function setup() {
  await recreateDatabase(TEST_DATABASE_URL);
}
