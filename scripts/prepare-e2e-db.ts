// Recreates the dedicated e2e database before the app server under test starts.
import { recreateDatabase } from "../src/test/database";
import { E2E_DATABASE_URL } from "../src/test/urls";

recreateDatabase(E2E_DATABASE_URL).then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
